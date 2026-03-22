import type * as OBC from "@thatopen/components"
import type { CameraCursor } from "../core/camera/manager"
import type { InteractionManager } from "../core/scene/interactions"
import type {
  CameraMode,
  CameraProjection,
  ElementData,
  ElementHoveredEvent,
  ElementSelectedEvent,
  FloorPlan,
  InteractionConfig,
  LoadedModel,
  MousePosition,
  Point3D,
  ViewerEventHandlers,
} from "../types"

// Re-export shared types for convenience
export type {
  LoadedModel,
  ElementData,
  InteractionConfig,
  ViewerEventHandlers,
  ElementSelectedEvent,
  ElementHoveredEvent,
  MousePosition,
  Point3D,
}

// Alias for backward compatibility
export type ElementInfo = ElementData

// ============================================================================
// React-Specific Types
// ============================================================================

export interface ViewerState {
  isInitialized: boolean
  error: Error | null
  loadedModels: Map<string, LoadedModel>
}

export interface CameraControls {
  // Current state
  mode: CameraMode
  projection: CameraProjection
  cursor: CameraCursor

  // Controls
  setMode: (mode: CameraMode) => void
  setProjection: (projection: CameraProjection) => void
  fitToItems: () => void
}

export interface PlanViewControls {
  plans: FloorPlan[]
  activePlanId: string | null
  open: (planId: string) => void
  close: () => void
}

export interface ViewerActions {
  /**
   * Load an IFC file (converts to fragments on-the-fly).
   * Use loadFragment() if pre-converted fragments are available.
   */
  loadModel: (
    buffer: ArrayBuffer,
    name: string,
    onProgress?: (progress: number) => void
  ) => Promise<void>
  /**
   * Load a pre-converted fragment file directly.
   * This is faster than loadModel as it skips the conversion step.
   */
  loadFragment: (buffer: ArrayBuffer, name: string) => Promise<void>
  unloadModel: (modelId: string) => Promise<void>
  unloadAllModels: () => Promise<void>
  getElement: (modelId: string, elementId: number) => Promise<ElementData | null>
  /** Programmatically select and highlight elements in the viewer */
  selectElements: (
    modelId: string,
    localIds: number[],
    options?: { clearPrevious?: boolean; fitToView?: boolean }
  ) => Promise<void>
  initialize: (container: HTMLElement) => Promise<void>
  dispose: () => void
  /** Manually trigger a resize of the viewer renderer */
  resize: () => void
}

export interface ViewerContextValue extends ViewerState, ViewerActions {
  components: OBC.Components | null
  fragmentsManager: OBC.FragmentsManager | null
  interactionManager: InteractionManager | null
  camera: CameraControls | null
  planViews: PlanViewControls | null
  /** Background color from config, used for container styling to prevent flash during resize */
  backgroundColor: string | null
}

export interface ViewerProviderProps {
  children: React.ReactNode
  config?: ViewerConfig
}

export interface ViewerConfig {
  backgroundColor?: string
  gridEnabled?: boolean
  statsEnabled?: boolean
  showGizmo?: boolean
  /** Interaction configuration (hover + selection). Set to false to disable. */
  interaction?: InteractionConfig | false
  events?: ViewerEventHandlers
}

export interface ViewerProps {
  onReady?: () => void
  onError?: (error: Error) => void
  onElementSelected?: (event: ElementSelectedEvent) => void
  onElementHovered?: (event: ElementHoveredEvent | null) => void
}
