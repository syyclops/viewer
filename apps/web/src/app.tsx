import {
  Viewer,
  ViewerProvider,
  useViewer,
  type ViewerConfig,
} from "@syyclops/ifc-viewer";
import { useCallback, useRef, useState } from "react";
import { ViewerToolbar } from "./components/viewer-toolbar";

const viewerConfig: ViewerConfig = {
  backgroundColor: "#1c1b18",
  gridEnabled: true,
  showGizmo: true,
};

function ViewerApp() {
  const { loadModel, isInitialized, loadedModels } = useViewer();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!isInitialized || isLoading) return;

      setIsLoading(true);
      setProgress(0);

      try {
        const buffer = await file.arrayBuffer();
        await loadModel(buffer, file.name, (p) => {
          setProgress(Math.round(p * 100));
        });
      } catch (error) {
        console.error("Failed to load model:", error);
      } finally {
        setIsLoading(false);
        setProgress(0);
      }
    },
    [isInitialized, isLoading, loadModel],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset so same file can be re-selected
      e.target.value = "";
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.toLowerCase().endsWith(".ifc")) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const hasModels = loadedModels.size > 0;

  return (
    <div className="app">
      <div className="toolbar">
        <span className="toolbar-title">Syyclops IFC Viewer</span>
        <div className="toolbar-actions">
          {hasModels && (
            <span className="model-info">
              {loadedModels.size} model{loadedModels.size > 1 ? "s" : ""} loaded
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".ifc"
            onChange={handleFileInput}
            style={{ display: "none" }}
          />
          <button
            className="upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isInitialized || isLoading}
          >
            Upload IFC
          </button>
        </div>
      </div>

      <div
        className={`viewer-container${isDragOver ? " drop-active" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Viewer />
        <ViewerToolbar />

        {!hasModels && !isLoading && (
          <div className="empty-state">
            <span className="empty-state-text">
              Drop an IFC file here or click Upload
            </span>
            <span className="empty-state-hint">Supports .ifc files</span>
          </div>
        )}

        {isLoading && (
          <div className="progress-overlay">
            <div className="progress-card">
              <span className="progress-text">
                Loading model... {progress}%
              </span>
              <div className="progress-bar-container">
                <div
                  className="progress-bar"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function App() {
  return (
    <ViewerProvider config={viewerConfig}>
      <ViewerApp />
    </ViewerProvider>
  );
}
