import * as OBC from "@thatopen/components"
import * as OBF from "@thatopen/components-front"
import type * as FRAGS from "@thatopen/fragments"
import * as THREE from "three"
import type { InteractionConfig, MousePosition } from "../../types"
import type { CameraManager } from "../camera/manager"

// ============================================================================
// Types
// ============================================================================

interface RaycastResult {
  model: FRAGS.FragmentsModel
  localId: number
  point: THREE.Vector3
}

export interface SelectionEvent {
  modelIdMap: Record<string, Set<number>>
  mousePosition?: MousePosition
  point?: THREE.Vector3
}

export interface HoverEvent {
  modelId: string
  localId: number
  mousePosition?: MousePosition
  point: THREE.Vector3
}

// ============================================================================
// InteractionManager - Unified hover and selection
// ============================================================================

export class InteractionManager {
  private components: OBC.Components
  private world: OBC.World
  private cameraManager?: CameraManager

  // Hover state (single element)
  private hoverMeshes: THREE.Mesh[] = []
  private hoveredLocalId: number | null = null
  private hoveredModelId: string | null = null

  // Selection state (multi-element via Ctrl+click)
  private selectionMeshes: Map<string, THREE.Mesh[]> = new Map()
  private selection: Map<string, Set<number>> = new Map()

  // Mouse tracking
  private lastMousePosition: MousePosition | undefined
  private lastClickPoint: THREE.Vector3 | undefined
  private isDragging = false
  private mouseDownButton: number | null = null
  private mouseDownPosition: MousePosition | undefined
  private readonly dragThreshold = 5 // pixels of movement to consider it a drag

  // Throttling
  private lastHoverTime = 0
  private pendingRaycast = false
  private readonly throttleMs = 16 // ~60fps

  // State
  private enabled = true

  // Events
  readonly onSelect = new OBC.Event<SelectionEvent>()
  readonly onHover = new OBC.Event<HoverEvent | null>()

  // Materials
  hoverMaterial: THREE.Material
  selectionMaterial: THREE.Material

  // Config
  adaptiveOrbitOnHover: boolean
  adaptiveOrbitOnSelect: boolean

  constructor(
    components: OBC.Components,
    world: OBC.World,
    config: InteractionConfig = {},
    cameraManager?: CameraManager
  ) {
    this.components = components
    this.world = world
    this.cameraManager = cameraManager

    this.adaptiveOrbitOnHover = config.adaptiveOrbitOnHover ?? true
    this.adaptiveOrbitOnSelect = config.adaptiveOrbitOnSelect ?? true

    this.hoverMaterial = new THREE.MeshBasicMaterial({
      color: config.hoverColor ?? 0x0b99ff,
      transparent: true,
      opacity: config.hoverOpacity ?? 0.4,
      depthTest: false,
    })

    this.selectionMaterial = new THREE.MeshBasicMaterial({
      color: config.selectionColor ?? 0x0b99ff,
      transparent: true,
      opacity: config.selectionOpacity ?? 0.6,
      depthTest: false,
    })

    // Initialize raycaster
    this.components.get(OBC.Raycasters).get(world)
    this.setupEvents()
  }

  // ============================================================================
  // Event Setup
  // ============================================================================

  private setupEvents() {
    if (!this.world.renderer) {
      throw new Error("World needs a renderer!")
    }

    const container = this.world.renderer.three.domElement
    container.addEventListener("mousemove", this.onMouseMove)
    container.addEventListener("mouseleave", this.onMouseLeave)
    container.addEventListener("mousedown", this.onMouseDown)
    container.addEventListener("mouseup", this.onMouseUp)
    container.addEventListener("click", this.onClick)
  }

  // ============================================================================
  // Mouse Handlers
  // ============================================================================

  private onMouseDown = (e: MouseEvent) => {
    this.lastMousePosition = { clientX: e.clientX, clientY: e.clientY }
    this.mouseDownPosition = { clientX: e.clientX, clientY: e.clientY }
    this.mouseDownButton = e.button
    this.isDragging = false
  }

  private onMouseUp = () => {
    if (this.isDragging && this.mouseDownButton === 2) {
      this.world.renderer!.three.domElement.style.cursor = ""
    }
    this.mouseDownButton = null
    this.isDragging = false
  }

  private onMouseMove = async (e: MouseEvent) => {
    if (!this.enabled) return

    // Update mouse position for hover
    this.lastMousePosition = { clientX: e.clientX, clientY: e.clientY }

    // Detect dragging (any mouse button held while moving)
    if (this.mouseDownButton !== null) {
      if (!this.isDragging && this.mouseDownButton === 2) {
        this.world.renderer!.three.domElement.style.cursor = "grabbing"
      }
      this.isDragging = true
      return // Skip hover raycasting during drag
    }

    // Throttle raycasting
    const now = performance.now()
    if (now - this.lastHoverTime < this.throttleMs) return
    this.lastHoverTime = now

    if (this.pendingRaycast) return
    this.pendingRaycast = true

    try {
      const result = await this.raycast()

      if (!result) {
        this.clearHover()
        this.onHover.trigger(null)
        return
      }

      const { model, localId, point } = result

      // Same element - skip
      if (this.hoveredLocalId === localId && this.hoveredModelId === model.modelId) {
        return
      }

      // Clear old hover
      this.clearHover()

      // Update hover state
      this.hoveredLocalId = localId
      this.hoveredModelId = model.modelId

      // Update orbit point
      if (this.adaptiveOrbitOnHover) {
        this.setOrbitPoint(point)
      }

      // Create hover meshes
      await this.highlightElement(model.modelId, localId, this.hoverMaterial, this.hoverMeshes)

      this.onHover.trigger({
        modelId: model.modelId,
        localId,
        mousePosition: this.lastMousePosition,
        point,
      })
    } finally {
      this.pendingRaycast = false
    }
  }

  private onMouseLeave = () => {
    this.clearHover()
    this.onHover.trigger(null)
    this.mouseDownButton = null
    this.isDragging = false
  }

  private onClick = async (e: MouseEvent) => {
    if (!this.enabled) return

    // Check if mouse moved significantly since mousedown (was a drag, not a click)
    if (this.mouseDownPosition) {
      const dx = e.clientX - this.mouseDownPosition.clientX
      const dy = e.clientY - this.mouseDownPosition.clientY
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance > this.dragThreshold) {
        return
      }
    }

    const result = await this.raycast()
    const isCtrlClick = e.ctrlKey || e.metaKey

    if (!result) {
      // Click on empty = clear selection
      this.clearSelection()
      this.emitSelectionEvent()
      return
    }

    const { model, localId, point } = result
    this.lastClickPoint = point

    if (isCtrlClick) {
      // Ctrl+click: toggle element
      const modelSet = this.selection.get(model.modelId)
      if (modelSet?.has(localId)) {
        this.removeFromSelection(model.modelId, localId)
      } else {
        await this.addToSelection(model.modelId, localId)
      }
    } else {
      // Normal click: replace selection
      this.clearSelection()
      await this.addToSelection(model.modelId, localId)
    }

    // Update orbit to selection center
    if (this.adaptiveOrbitOnSelect) {
      await this.setOrbitToSelection()
    }

    this.emitSelectionEvent()
  }

  // ============================================================================
  // Raycasting
  // ============================================================================

  private async raycast(): Promise<RaycastResult | null> {
    const casters = this.components.get(OBC.Raycasters)
    const caster = casters.get(this.world)

    const result = (await caster.castRay()) as unknown as {
      fragments: FRAGS.FragmentsModel
      localId: number
      point: THREE.Vector3
    } | null

    if (!result) return null

    return {
      model: result.fragments,
      localId: result.localId,
      point: result.point,
    }
  }

  // ============================================================================
  // Highlighting
  // ============================================================================

  private async highlightElement(
    modelId: string,
    localId: number,
    material: THREE.Material,
    meshArray: THREE.Mesh[]
  ): Promise<void> {
    const modelIdMap = { [modelId]: new Set([localId]) }
    const mesher = this.components.get(OBF.Mesher)
    const meshesResult = await mesher.get(modelIdMap)

    for (const [, data] of meshesResult.entries()) {
      const meshList = [...data.values()].flat()
      for (const mesh of meshList) {
        mesh.material = material
        this.world.scene.three.add(mesh)
        meshArray.push(mesh)
      }
    }
  }

  // ============================================================================
  // Selection Management
  // ============================================================================

  private async addToSelection(modelId: string, localId: number): Promise<void> {
    // Add to selection map
    if (!this.selection.has(modelId)) {
      this.selection.set(modelId, new Set())
    }
    this.selection.get(modelId)!.add(localId)

    // Create meshes
    const key = `${modelId}:${localId}`
    const meshes: THREE.Mesh[] = []
    await this.highlightElement(modelId, localId, this.selectionMaterial, meshes)
    this.selectionMeshes.set(key, meshes)
  }

  private removeFromSelection(modelId: string, localId: number): void {
    // Remove from selection map
    const modelSet = this.selection.get(modelId)
    if (modelSet) {
      modelSet.delete(localId)
      if (modelSet.size === 0) {
        this.selection.delete(modelId)
      }
    }

    // Remove meshes
    const key = `${modelId}:${localId}`
    const meshes = this.selectionMeshes.get(key)
    if (meshes) {
      for (const mesh of meshes) {
        mesh.removeFromParent()
        mesh.geometry.dispose()
      }
      this.selectionMeshes.delete(key)
    }
  }

  private emitSelectionEvent(): void {
    // Convert internal Map to Record format
    const modelIdMap: Record<string, Set<number>> = {}
    for (const [modelId, localIds] of this.selection.entries()) {
      modelIdMap[modelId] = new Set(localIds)
    }

    this.onSelect.trigger({
      modelIdMap,
      mousePosition: this.lastMousePosition,
      point: this.lastClickPoint,
    })
  }

  // ============================================================================
  // Orbit Control
  // ============================================================================

  private setOrbitPoint(point: THREE.Vector3): void {
    // Only update orbit point when in Orbit mode
    if (this.cameraManager && this.cameraManager.getMode() !== "Orbit") {
      return
    }
    const camera = this.world.camera as OBC.SimpleCamera
    if (!camera.controls) return
    camera.controls.setOrbitPoint(point.x, point.y, point.z)
  }

  private async setOrbitToSelection(): Promise<void> {
    if (this.selection.size === 0) return

    // Get center of all selected elements
    const boxer = this.components.get(OBC.BoundingBoxer)
    const modelIdMap: Record<string, Set<number>> = {}
    for (const [modelId, localIds] of this.selection.entries()) {
      modelIdMap[modelId] = localIds
    }
    const center = await boxer.getCenter(modelIdMap)
    this.setOrbitPoint(center)
  }

  /**
   * Fit camera to view the current selection
   */
  async fitToSelection(): Promise<void> {
    if (this.selectionMeshes.size === 0) return

    // Collect all selection meshes
    const allMeshes: THREE.Mesh[] = []
    for (const meshes of this.selectionMeshes.values()) {
      allMeshes.push(...meshes)
    }

    if (allMeshes.length === 0) return

    // Fit camera to the selection meshes
    const camera = this.world.camera as OBC.OrthoPerspectiveCamera
    camera.fit(allMeshes, 1.5) // 1.5 = slight padding around the selection
  }

  // ============================================================================
  // Clear Methods
  // ============================================================================

  private clearHover(): void {
    for (const mesh of this.hoverMeshes) {
      mesh.removeFromParent()
      mesh.geometry.dispose()
    }
    this.hoverMeshes = []
    this.hoveredLocalId = null
    this.hoveredModelId = null
  }

  clearSelection(): void {
    for (const meshes of this.selectionMeshes.values()) {
      for (const mesh of meshes) {
        mesh.removeFromParent()
        mesh.geometry.dispose()
      }
    }
    this.selectionMeshes.clear()
    this.selection.clear()
    this.lastClickPoint = undefined
  }

  // ============================================================================
  // Public API
  // ============================================================================

  setEnabled(value: boolean): void {
    this.enabled = value
    if (!value) {
      this.clearHover()
    }
  }

  getSelection(): Record<string, Set<number>> {
    const result: Record<string, Set<number>> = {}
    for (const [modelId, localIds] of this.selection.entries()) {
      result[modelId] = new Set(localIds)
    }
    return result
  }

  /**
   * Programmatically select elements and highlight them
   */
  async selectElements(
    modelId: string,
    localIds: number[],
    options: { clearPrevious?: boolean; fitToView?: boolean } = {}
  ): Promise<void> {
    const { clearPrevious = true, fitToView = false } = options

    if (clearPrevious) {
      this.clearSelection()
    }

    for (const localId of localIds) {
      await this.addToSelection(modelId, localId)
    }

    // Update orbit to selection center
    if (this.adaptiveOrbitOnSelect) {
      await this.setOrbitToSelection()
    }

    // Fit camera to selection if requested
    if (fitToView) {
      await this.fitToSelection()
    }

    this.emitSelectionEvent()
  }

  dispose(): void {
    this.clearHover()
    this.clearSelection()
    this.hoverMaterial.dispose()
    this.selectionMaterial.dispose()
    this.onSelect.reset()
    this.onHover.reset()

    if (this.world.renderer) {
      const container = this.world.renderer.three.domElement
      container.removeEventListener("mousemove", this.onMouseMove)
      container.removeEventListener("mouseleave", this.onMouseLeave)
      container.removeEventListener("mousedown", this.onMouseDown)
      container.removeEventListener("mouseup", this.onMouseUp)
      container.removeEventListener("click", this.onClick)
    }
  }
}
