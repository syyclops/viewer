import {
  useViewer,
  useViewerEvents,
  type ElementInfo,
  type ElementSelectedEvent,
} from "@syyclops/ifc-viewer";
import { useCallback, useState } from "react";

// ============================================================================
// Helpers
// ============================================================================

/** IFC type string (e.g. "IFCWALLSTANDARDCASE") → readable label ("Wall Standard Case") */
function formatIfcType(raw: string): string {
  const stripped = raw.replace(/^IFC/i, "");
  return stripped.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)/g, (m) =>
    m.length > 1 ? m : m,
  );
}

/** Turn a camelCase or PascalCase key into a readable label */
function formatKey(key: string): string {
  return key
    .replace(/^__/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

/** Try to extract a displayable string from an IFC property value.
 *  IFC values are often `{ value: "...", type: N }` objects. */
function unwrapValue(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === "string") return val || null;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    // Most IFC attrs: { value: "...", type: N }
    if ("value" in obj) return unwrapValue(obj.value);
    // Sometimes it's { Name: { value: "..." }, ... }
    if ("Name" in obj) return unwrapValue(obj.Name);
  }
  return null;
}

/** Keys to skip — internal / noisy / geometric */
const SKIP_KEYS = new Set([
  "ObjectPlacement",
  "Representation",
  "OwnerHistory",
  "ObjectType",
  "type",
  "expressID",
]);

/** Keys to show first, in order */
const PRIORITY_KEYS = ["Name", "Description", "__ifcType", "GlobalId", "Tag"];

type PropertyEntry = { label: string; value: string };

function extractProperties(data: ElementInfo): {
  name: string;
  ifcType: string;
  properties: PropertyEntry[];
} {
  const rawName = unwrapValue(data.Name);
  const name = rawName || "Unnamed Element";
  const ifcType =
    typeof data.__ifcType === "string" ? formatIfcType(data.__ifcType) : "Element";

  const seen = new Set<string>();
  const properties: PropertyEntry[] = [];

  const addProp = (key: string, raw: unknown) => {
    const str = unwrapValue(raw);
    if (str == null) return;
    properties.push({ label: formatKey(key), value: str });
  };

  // Priority keys first
  for (const key of PRIORITY_KEYS) {
    if (key === "Name" || key === "__ifcType") continue;
    if (!(key in data)) continue;
    seen.add(key);
    addProp(key, data[key]);
  }

  // Remaining keys
  for (const [key, val] of Object.entries(data)) {
    if (seen.has(key) || SKIP_KEYS.has(key) || key === "Name" || key === "__ifcType")
      continue;
    seen.add(key);
    addProp(key, val);
  }

  return { name, ifcType, properties };
}

// ============================================================================
// Icons
// ============================================================================

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

// ============================================================================
// Component
// ============================================================================

export function ElementPanel() {
  const { getElement } = useViewer();
  const [element, setElement] = useState<{
    name: string;
    ifcType: string;
    properties: PropertyEntry[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelect = useCallback(
    async (event: ElementSelectedEvent) => {
      const entries = Object.entries(event.modelIdMap);
      if (entries.length === 0) {
        setElement(null);
        return;
      }

      const [modelId, localIds] = entries[0];
      const localId = localIds.values().next().value;
      if (localId == null) {
        setElement(null);
        return;
      }

      setLoading(true);
      try {
        const data = await getElement(modelId, localId);
        if (data) {
          setElement(extractProperties(data));
        } else {
          setElement(null);
        }
      } catch {
        setElement(null);
      } finally {
        setLoading(false);
      }
    },
    [getElement],
  );

  useViewerEvents({ onElementSelected: handleSelect });

  if (!element && !loading) return null;

  return (
    <div className="ep-panel">
      <div className="ep-header">
        <div className="ep-header-text">
          <span className="ep-name">{loading ? "Loading..." : element?.name}</span>
          {!loading && element && (
            <span className="ep-type">{element.ifcType}</span>
          )}
        </div>
        <button
          className="ep-close"
          onClick={() => setElement(null)}
          title="Close"
        >
          <CloseIcon />
        </button>
      </div>

      {!loading && element && element.properties.length > 0 && (
        <div className="ep-properties">
          {element.properties.map((prop) => (
            <div key={prop.label} className="ep-row">
              <span className="ep-label">{prop.label}</span>
              <span className="ep-value">{prop.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
