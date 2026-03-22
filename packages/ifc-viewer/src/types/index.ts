// ============================================================================
// Common Types
// ============================================================================

/** Represents a loaded IFC model */
export interface LoadedModel {
  id: string
  name: string
}

/** Element data from IFC model */
export interface ElementData {
  [key: string]: unknown
}

// ============================================================================
// Config Types
// ============================================================================

/** Scene configuration */
export interface SceneConfig {
  backgroundColor?: string
}

/** Feature toggles */
export interface FeaturesConfig {
  grid?: boolean
  stats?: boolean
  gizmo?: boolean
}

/** Interaction configuration (hover + selection) */
export interface InteractionConfig {
  /** Hover highlight color (default: 0x0b99ff - blue) */
  hoverColor?: number
  /** Hover highlight opacity (default: 0.4) */
  hoverOpacity?: number
  /** Selection highlight color (default: 0x0b99ff - blue) */
  selectionColor?: number
  /** Selection highlight opacity (default: 0.6) */
  selectionOpacity?: number
  /** Update orbit point when hovering elements (default: true) */
  adaptiveOrbitOnHover?: boolean
  /** Update orbit point when selecting elements (default: true) */
  adaptiveOrbitOnSelect?: boolean
}

// ============================================================================
// Event Types
// ============================================================================

/** Mouse position in the viewport */
export interface MousePosition {
  clientX: number
  clientY: number
}

/** 3D point in world coordinates */
export interface Point3D {
  x: number
  y: number
  z: number
}

/** Event payload when elements are selected */
export interface ElementSelectedEvent {
  modelIdMap: Record<string, Set<number>>
  /** Mouse position when the element was clicked */
  position?: MousePosition
  /** 3D hit point in world coordinates */
  point?: Point3D
}

/** Event payload when elements are hovered */
export interface ElementHoveredEvent {
  modelIdMap: Record<string, Set<number>>
  /** Mouse position during hover */
  position?: MousePosition
  /** 3D hit point in world coordinates */
  point?: Point3D
}

/** Event handlers configuration */
export interface ViewerEventHandlers {
  onElementSelected?: (event: ElementSelectedEvent) => void
  onElementHovered?: (event: ElementHoveredEvent | null) => void
}

// ============================================================================
// Callback Types
// ============================================================================

export type ModelLoadedCallback = (model: LoadedModel) => void
export type ModelUnloadedCallback = (modelId: string) => void
export type ProgressCallback = (progress: number) => void

// ============================================================================
// Camera Types
// ============================================================================

export type CameraMode = "Orbit" | "FirstPerson" | "Plan"
export type CameraProjection = "Orthographic" | "Perspective"

// ============================================================================
// Plan View Types
// ============================================================================

/** Represents a single floor plan extracted from an IFC model */
export interface FloorPlan {
  id: string
  name: string
  elevation: number
  modelId: string
}
