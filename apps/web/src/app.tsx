import {
  Viewer,
  ViewerProvider,
  useViewer,
  type ViewerConfig,
} from "@syyclops/ifc-viewer";
import { useCallback, useRef, useState } from "react";
import { ElementPanel } from "./components/element-panel";
import { ViewerToolbar } from "./components/viewer-toolbar";

const viewerConfig: ViewerConfig = {
  backgroundColor: "#1c1b18",
  gridEnabled: false,
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".ifc"
        onChange={handleFileInput}
        style={{ display: "none" }}
      />

      <div
        className={`viewer-container${isDragOver ? " drop-active" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Viewer />
        <ViewerToolbar />
        <ElementPanel />

        {!hasModels && !isLoading && (
          <div className={`empty-state${isDragOver ? " empty-state--drag" : ""}`}>
            <div className="empty-state-dropzone">
              <button
                type="button"
                className="empty-state-upload-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload
              </button>
              <div className="empty-state-copy">
                <span className="empty-state-title">
                  Choose a file or drag &amp; drop it here
                </span>
                <span className="empty-state-subtitle">
                  Supports .ifc files
                </span>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="loading-bar">
            <div className="loading-bar-top">
              <div className="loading-bar-left">
                <svg
                  className="loading-bar-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span className="loading-bar-percent">{progress}%</span>
                <span className="loading-bar-status">Loading model</span>
              </div>
            </div>
            <div className="loading-bar-track">
              <div
                className="loading-bar-fill"
                style={{ width: `${progress}%` }}
              />
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
