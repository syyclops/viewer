import * as OBC from "@thatopen/components"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { CameraManager, type CameraState, PlanViewManager, type PlanViewState } from "../core"
import { ModelManager } from "../core/models/manager"
import {
  createScene,
  type HoverEvent,
  InteractionManager,
  type SelectionEvent,
  setupFeatures,
} from "../core/scene"
import { createWorkerBlobUrl } from "../worker"
import type {
  CameraControls,
  PlanViewControls,
  ViewerContextValue,
  ViewerProviderProps,
  ViewerState,
} from "./types"

// Create context for the viewer
const ViewerContext = createContext<ViewerContextValue | undefined>(undefined)

// Display name for React Dev Tools
ViewerContext.displayName = "ViewerContext"

/**
 * React wrapper around core functionality
 * Manages React state and lifecycle
 */
export const ViewerProvider = ({ children, config }: ViewerProviderProps) => {
  // Core instances (refs because we don't want to re-create them on every render)
  const sceneRef = useRef<Awaited<ReturnType<typeof createScene>> | null>(null)
  const worldRef = useRef<OBC.World | null>(null)
  const modelManagerRef = useRef<ModelManager | null>(null)
  const featuresRef = useRef<ReturnType<typeof setupFeatures> | null>(null)
  const interactionRef = useRef<InteractionManager | null>(null)
  const cameraManagerRef = useRef<CameraManager | null>(null)
  const planViewManagerRef = useRef<PlanViewManager | null>(null)

  // React state (UI updates)
  const [state, setState] = useState<ViewerState>({
    isInitialized: false,
    error: null,
    loadedModels: new Map(),
  })

  const [cameraState, setCameraState] = useState<CameraState | null>(null)
  const [planViewState, setPlanViewState] = useState<PlanViewState | null>(null)

  // Track previous camera mode to detect mode changes
  const previousCameraModeRef = useRef<CameraState["mode"] | null>(null)

  // Initialize using core functions
  const initialize = useCallback(
    async (container: HTMLElement) => {
      if (sceneRef.current) return

      try {
        // Use core scene creation
        const scene = await createScene(container, {
          backgroundColor: config?.backgroundColor,
        })
        sceneRef.current = scene
        worldRef.current = scene.world

        // Set up renderer resize handler to update camera aspect ratio
        scene.world.renderer?.onResize.add((size) => {
          const camera = scene.world.camera?.three
          if (camera instanceof THREE.PerspectiveCamera) {
            camera.aspect = size.x / size.y
            camera.updateProjectionMatrix()
          }
        })

        // Setup camera manager with state sync callback
        cameraManagerRef.current = new CameraManager(scene.camera, {
          onChange: setCameraState,
        })
        // Initialize React state from manager's defaults
        setCameraState(cameraManagerRef.current.getState())

        // Setup plan view manager (uses CameraManager for state sync)
        planViewManagerRef.current = new PlanViewManager(
          scene.components,
          scene.world,
          cameraManagerRef.current,
          { onChange: setPlanViewState }
        )
        setPlanViewState(planViewManagerRef.current.getState())

        // Use core features setup
        const features = setupFeatures(scene.components, scene.world, {
          grid: config?.gridEnabled,
          stats: config?.statsEnabled,
          gizmo: config?.showGizmo,
        })
        featuresRef.current = features

        // Use core interactions setup
        if (config?.interaction !== false) {
          const interactionConfig =
            typeof config?.interaction === "object" ? config.interaction : {}

          interactionRef.current = new InteractionManager(
            scene.components,
            scene.world,
            interactionConfig,
            cameraManagerRef.current ?? undefined
          )

          // Wire up selection events
          interactionRef.current.onSelect.add((event: SelectionEvent) => {
            config?.events?.onElementSelected?.({
              modelIdMap: event.modelIdMap,
              position: event.mousePosition,
              point: event.point
                ? { x: event.point.x, y: event.point.y, z: event.point.z }
                : undefined,
            })
          })

          // Wire up hover events
          interactionRef.current.onHover.add((event: HoverEvent | null) => {
            config?.events?.onElementHovered?.(
              event
                ? {
                    modelIdMap: { [event.modelId]: new Set([event.localId]) },
                    position: event.mousePosition,
                    point: {
                      x: event.point.x,
                      y: event.point.y,
                      z: event.point.z,
                    },
                  }
                : null
            )
          })
        }

        scene.components.init()

        // Create model manager with React state callbacks
        modelManagerRef.current = new ModelManager(
          scene.components,
          scene.world,
          scene.camera,
          createWorkerBlobUrl(),
          {
            onModelLoaded: (model) => {
              setState((prev) => {
                const newModels = new Map(prev.loadedModels)
                newModels.set(model.id, model)
                return { ...prev, loadedModels: newModels }
              })

              // Extract plans from newly loaded model
              setTimeout(() => {
                planViewManagerRef.current?.extractFromModel(model.id)
              }, 100)
            },
            onModelUnloaded: (modelId) => {
              setState((prev) => {
                const newModels = new Map(prev.loadedModels)
                newModels.delete(modelId)
                return { ...prev, loadedModels: newModels }
              })
              // Clear views for unloaded model
              planViewManagerRef.current?.clearModel(modelId)
            },
          }
        )

        setState((prev) => ({ ...prev, isInitialized: true, error: null }))
      } catch (error) {
        console.error("Failed to initialize viewer:", error)
        setState((prev) => ({
          ...prev,
          error: error as Error,
        }))
      }
    },
    [config]
  )

  const dispose = useCallback(() => {
    interactionRef.current?.dispose()
    featuresRef.current?.dispose()
    planViewManagerRef.current?.dispose()
    modelManagerRef.current?.dispose()
    cameraManagerRef.current?.dispose()

    if (sceneRef.current) {
      sceneRef.current.components.dispose()
    }

    sceneRef.current = null
    worldRef.current = null
    modelManagerRef.current = null
    featuresRef.current = null
    interactionRef.current = null
    cameraManagerRef.current = null
    planViewManagerRef.current = null

    setState({
      isInitialized: false,
      error: null,
      loadedModels: new Map(),
    })
    setCameraState(null)
    setPlanViewState(null)
  }, [])

  useEffect(() => {
    return () => {
      dispose()
    }
  }, [dispose])

  // Handle camera mode changes - close plan view if user switches away from Plan mode
  useEffect(() => {
    if (!cameraState) return

    const currentMode = cameraState.mode
    const previousMode = previousCameraModeRef.current

    if (previousMode === "Plan" && currentMode !== "Plan") {
      planViewManagerRef.current?.onCameraModeChange(currentMode)
    }

    previousCameraModeRef.current = currentMode
  }, [cameraState])

  // Memoize the functions with useCallback
  const getElement = useCallback(
    (modelId: string, elementId: number) =>
      modelManagerRef.current?.getElement(modelId, elementId) ?? Promise.resolve(null),
    []
  )

  const loadModel = useCallback(
    (buffer: ArrayBuffer, name: string, onProgress?: (progress: number) => void) =>
      modelManagerRef.current?.loadModel(buffer, name, onProgress) ?? Promise.resolve(),
    []
  )

  const loadFragment = useCallback(
    (buffer: ArrayBuffer, name: string) =>
      modelManagerRef.current?.loadFragment(buffer, name) ?? Promise.resolve(),
    []
  )

  const unloadModel = useCallback(
    (modelId: string) => modelManagerRef.current?.unloadModel(modelId) ?? Promise.resolve(),
    []
  )

  const unloadAllModels = useCallback(
    () => modelManagerRef.current?.unloadAllModels() ?? Promise.resolve(),
    []
  )

  const selectElements = useCallback(
    async (
      modelId: string,
      localIds: number[],
      options: { clearPrevious?: boolean; fitToView?: boolean } = {}
    ) => {
      await interactionRef.current?.selectElements(modelId, localIds, options)
    },
    []
  )

  // Camera control callbacks
  const setCameraMode = useCallback(
    (mode: CameraState["mode"]) => cameraManagerRef.current?.setMode(mode),
    []
  )

  const setCameraProjection = useCallback(
    (projection: CameraState["projection"]) => cameraManagerRef.current?.setProjection(projection),
    []
  )

  const fitCameraToItems = useCallback(() => cameraManagerRef.current?.fitToItems(), [])

  // Plan view callbacks
  const openPlan = useCallback((planId: string) => {
    planViewManagerRef.current?.open(planId)
  }, [])

  const closePlan = useCallback(() => planViewManagerRef.current?.close(), [])

  // Resize callback - triggers renderer resize and camera aspect ratio update
  const resize = useCallback(() => {
    worldRef.current?.renderer?.resize(undefined)
  }, [])

  // Memoize camera object to prevent unnecessary re-renders
  const camera = useMemo<CameraControls | null>(() => {
    if (!cameraState) return null
    return {
      mode: cameraState.mode,
      projection: cameraState.projection,
      cursor: cameraState.cursor,
      setMode: setCameraMode,
      setProjection: setCameraProjection,
      fitToItems: fitCameraToItems,
    }
  }, [cameraState, setCameraMode, setCameraProjection, fitCameraToItems])

  // Memoize plan views object to prevent unnecessary re-renders
  const planViews = useMemo<PlanViewControls | null>(() => {
    if (!planViewState) return null
    return {
      plans: planViewState.plans,
      activePlanId: planViewState.activePlanId,
      open: openPlan,
      close: closePlan,
    }
  }, [planViewState, openPlan, closePlan])

  // Return the value object
  const value: ViewerContextValue = {
    ...state,
    components: sceneRef.current?.components ?? null,
    fragmentsManager: sceneRef.current?.components?.get(OBC.FragmentsManager) ?? null,
    interactionManager: interactionRef.current,
    getElement,
    loadModel,
    loadFragment,
    unloadModel,
    unloadAllModels,
    selectElements,
    initialize,
    dispose,
    resize,
    camera,
    planViews,
    backgroundColor: config?.backgroundColor ?? null,
  }

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>
}

export const useViewer = () => {
  const context = useContext(ViewerContext)
  if (!context) {
    throw new Error("useViewer must be used within a ViewerProvider")
  }
  return context
}
