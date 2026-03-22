import * as OBC from "@thatopen/components"
import * as THREE from "three"
import type { CameraMode, FloorPlan } from "../../types"
import type { CameraManager } from "../camera/manager"

export interface PlanViewState {
  plans: FloorPlan[]
  activePlanId: string | null
}

export interface PlanViewCallbacks {
  onChange?: (state: PlanViewState) => void
}

/** IFC attribute with a value property */
interface IfcAttribute<T> {
  value: T
}

/** Safely extracts a typed value from IFC attribute data */
function getIfcValue<T>(data: unknown, key: string, fallback: T): T {
  if (!data || typeof data !== "object") return fallback
  const record = data as Record<string, unknown>
  const attr = record[key] as IfcAttribute<T> | undefined
  return attr?.value ?? fallback
}

const PLAN_OFFSET = 1.0 // Meters above floor

/**
 * Manages 2D plan views extracted from IFC model storeys.
 * Works with CameraManager to keep camera state in sync.
 */
export class PlanViewManager {
  private components: OBC.Components
  private views: OBC.Views
  private world: OBC.World
  private cameraManager: CameraManager
  private callbacks?: PlanViewCallbacks
  private plans: FloorPlan[] = []
  private activePlanId: string | null = null
  private previousCameraMode: CameraMode | null = null

  constructor(
    components: OBC.Components,
    world: OBC.World,
    cameraManager: CameraManager,
    callbacks?: PlanViewCallbacks
  ) {
    this.components = components
    this.views = components.get(OBC.Views)
    this.views.world = world
    this.world = world
    this.cameraManager = cameraManager
    this.callbacks = callbacks
    OBC.Views.defaultRange = 10
  }

  getState(): PlanViewState {
    return { plans: this.plans, activePlanId: this.activePlanId }
  }

  async extractFromModel(modelId: string): Promise<FloorPlan[]> {
    const fragments = this.components.get(OBC.FragmentsManager)
    const model = fragments.list.get(modelId)
    if (!model) return []

    try {
      const storeyIds = Object.values(await model.getItemsOfCategories([/BUILDINGSTOREY/])).flat()

      if (storeyIds.length === 0) return []

      const storeysData = await model.getItemsData(storeyIds)
      const [, coordHeight] = await model.getCoordinates()
      const heightOffset = coordHeight ?? 0

      const newPlans: FloorPlan[] = storeyIds.map((expressID, i) => ({
        id: `${modelId}-${expressID}`,
        name: getIfcValue(storeysData[i], "Name", "Unnamed Floor"),
        elevation: getIfcValue(storeysData[i], "Elevation", 0) + heightOffset,
        modelId,
      }))

      newPlans.sort((a, b) => a.elevation - b.elevation)
      this.plans = [...this.plans, ...newPlans]
      this.notifyChange()
      return newPlans
    } catch (error) {
      console.error("Failed to extract floor plans:", error)
      return []
    }
  }

  async open(planId: string): Promise<void> {
    const plan = this.plans.find((p) => p.id === planId)
    if (!plan) return

    if (this.activePlanId) {
      this.views.close()
    }

    // Save current camera mode before switching to Plan
    if (!this.previousCameraMode) {
      this.previousCameraMode = this.cameraManager.getMode()
    }

    if (!this.views.list.has(planId)) {
      const normal = new THREE.Vector3(0, -1, 0)
      const point = new THREE.Vector3(0, plan.elevation + PLAN_OFFSET, 0)
      this.views.create(normal, point, { id: planId, world: this.world })
    }

    this.views.open(planId)
    this.cameraManager.setMode("Plan")
    this.activePlanId = planId
    this.notifyChange()
  }

  close(): void {
    if (!this.activePlanId) return

    this.views.close()

    // Restore previous camera mode if still in Plan mode
    if (this.previousCameraMode && this.cameraManager.getMode() === "Plan") {
      this.cameraManager.setMode(this.previousCameraMode)
    }

    this.previousCameraMode = null
    this.activePlanId = null
    this.notifyChange()
  }

  /** Called when camera mode changes externally (e.g., user changes mode via UI) */
  onCameraModeChange(newMode: CameraMode): void {
    if (newMode !== "Plan" && this.activePlanId) {
      // User switched away from Plan mode, close the plan view
      this.views.close()
      this.previousCameraMode = null
      this.activePlanId = null
      this.notifyChange()
    }
  }

  clearModel(modelId: string): void {
    if (this.activePlanId?.startsWith(modelId)) {
      this.close()
    }

    for (const id of this.views.list.keys()) {
      if (id.startsWith(modelId)) {
        this.views.list.delete(id)
      }
    }

    this.plans = this.plans.filter((p) => p.modelId !== modelId)
    this.notifyChange()
  }

  clearAll(): void {
    this.close()

    for (const id of this.views.list.keys()) {
      this.views.list.delete(id)
    }

    this.plans = []
    this.notifyChange()
  }

  dispose(): void {
    this.clearAll()
  }

  private notifyChange(): void {
    this.callbacks?.onChange?.(this.getState())
  }
}
