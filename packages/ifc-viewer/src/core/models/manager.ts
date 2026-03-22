import * as OBC from "@thatopen/components"
import type { FragmentsModel, IfcImporter } from "@thatopen/fragments"
import * as WEBIFC from "web-ifc"
import type {
  ElementData,
  ModelLoadedCallback,
  ModelUnloadedCallback,
  ProgressCallback,
} from "../../types"

const ELEMENT_LOOKUP_CONFIG = {
  attributesDefault: true,
  relations: {
    ContainedInStructure: { attributes: true, relations: true },
    HasAssociations: { attributes: true, relations: true },
    IsDefinedBy: { attributes: true, relations: true },
    IsTypedBy: { attributes: true, relations: true },
  },
} as const

export class ModelManager {
  private components: OBC.Components
  private world: OBC.World
  private camera: OBC.OrthoPerspectiveCamera
  private workerUrlPromise: Promise<string>
  private fragmentsInitialized = false
  private onModelLoaded?: ModelLoadedCallback
  private onModelUnloaded?: ModelUnloadedCallback
  private elementCache = new Map<string, ElementData | null>()
  private pendingRequests = new Map<string, Promise<ElementData | null>>()

  constructor(
    components: OBC.Components,
    world: OBC.World,
    camera: OBC.OrthoPerspectiveCamera,
    workerUrlPromise: Promise<string>,
    callbacks?: {
      onModelLoaded?: ModelLoadedCallback
      onModelUnloaded?: ModelUnloadedCallback
    }
  ) {
    this.components = components
    this.world = world
    this.camera = camera
    this.workerUrlPromise = workerUrlPromise
    this.onModelLoaded = callbacks?.onModelLoaded
    this.onModelUnloaded = callbacks?.onModelUnloaded
  }

  getModel(modelId: string): FragmentsModel | null {
    const fragments = this.components.get(OBC.FragmentsManager)
    return fragments.list.get(modelId) ?? null
  }

  getAllModels(): Map<string, FragmentsModel> {
    const fragments = this.components.get(OBC.FragmentsManager)
    return new Map(fragments.list)
  }

  async getElement(modelId: string, elementId: number): Promise<ElementData | null> {
    const model = this.getModel(modelId)
    if (!model) return null

    const key = `${modelId}:${elementId}`

    if (this.elementCache.has(key)) return this.elementCache.get(key) ?? null
    if (this.pendingRequests.has(key)) return this.pendingRequests.get(key)!

    const request = (async () => {
      try {
        // Get detailed attributes with relations
        const [data] = await model.getItemsData([elementId], ELEMENT_LOOKUP_CONFIG)
        if (!data) return null

        // Get raw item data to access the IFC category (e.g., IFCWALL, IFCDOOR)
        const rawItems = await model.getItems([elementId])
        const rawItem = rawItems.get(elementId)
        const ifcType = rawItem?.category ?? null

        const result = { ...data, __ifcType: ifcType } as ElementData
        this.elementCache.set(key, result)
        return result
      } catch {
        return null
      } finally {
        this.pendingRequests.delete(key)
      }
    })()

    this.pendingRequests.set(key, request)
    return request
  }

  /**
   * Initialize the fragments system if not already done.
   */
  private async initializeFragments(): Promise<void> {
    if (this.fragmentsInitialized) return

    const workerUrl = await this.workerUrlPromise
    const fragments = this.components.get(OBC.FragmentsManager)
    fragments.init(workerUrl)
    this.fragmentsInitialized = true

    // Update fragments when camera stops moving
    this.world.camera?.controls?.addEventListener("rest", () => fragments.core.update(true))

    // Update models to use new camera when Views switches cameras
    this.world.onCameraChanged.add((camera) => {
      for (const [, model] of fragments.list) {
        // biome-ignore lint/correctness/useHookAtTopLevel: useCamera is a method, not a React hook
        model.useCamera(camera.three)
      }
      fragments.core.update(true)
    })
  }

  /**
   * Load a pre-converted fragment file directly.
   * This is faster than loading IFC as it skips the conversion step.
   */
  async loadFragment(buffer: ArrayBuffer, name: string): Promise<void> {
    const fragments = this.components.get(OBC.FragmentsManager)

    await this.initializeFragments()

    const handleModelLoaded = ({ value: model }: { value: FragmentsModel }) => {
      model.useCamera(this.camera.three)
      this.world.scene.three.add(model.object)
      fragments.core.update(true)

      this.onModelLoaded?.({ id: model.modelId, name })
    }

    try {
      fragments.list.onItemSet.add(handleModelLoaded)

      // Load the pre-converted fragment directly via FragmentsModels.load()
      // Generate a unique model ID for this fragment
      const modelId = `frag-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      await fragments.core.load(buffer, {
        modelId,
        camera: this.camera.three,
      })

      this.camera.fitToItems()
    } finally {
      fragments.list.onItemSet.remove(handleModelLoaded)
    }
  }

  /**
   * Load an IFC file (converts to fragments on-the-fly).
   * Use loadFragment() if pre-converted fragments are available.
   */
  async loadModel(buffer: ArrayBuffer, name: string, onProgress?: ProgressCallback): Promise<void> {
    const ifcLoader = this.components.get(OBC.IfcLoader)
    const fragments = this.components.get(OBC.FragmentsManager)

    const handleModelLoaded = ({ value: model }: { value: FragmentsModel }) => {
      model.useCamera(this.camera.three)
      this.world.scene.three.add(model.object)
      fragments.core.update(true)

      this.onModelLoaded?.({ id: model.modelId, name })
    }

    const importerHandler = (importer: IfcImporter) => {
      const excludedCats = [
        WEBIFC.IFCTENDONANCHOR,
        WEBIFC.IFCREINFORCINGBAR,
        WEBIFC.IFCREINFORCINGELEMENT,
        WEBIFC.IFCSPACE,
      ]
      for (const cat of excludedCats) {
        importer.classes.elements.delete(cat)
      }
    }

    try {
      await ifcLoader.setup({
        autoSetWasm: false,
        wasm: {
          path: "https://unpkg.com/web-ifc@0.0.77/",
          absolute: true,
        },
      })

      ifcLoader.onIfcImporterInitialized.add(importerHandler)

      await this.initializeFragments()

      fragments.list.onItemSet.add(handleModelLoaded)

      const data = new Uint8Array(buffer)
      await ifcLoader.load(data, false, name, {
        processData: { progressCallback: onProgress },
      })

      this.camera.fitToItems()
    } finally {
      fragments.list.onItemSet.remove(handleModelLoaded)
      ifcLoader.onIfcImporterInitialized.remove(importerHandler)
    }
  }

  async unloadModel(modelId: string): Promise<void> {
    try {
      const fragments = this.components.get(OBC.FragmentsManager)
      const model = fragments.list.get(modelId)

      if (!model) {
        console.warn(`Model ${modelId} not found`)
        return
      }

      this.world.scene.three.remove(model.object)
      model.dispose()
      fragments.list.delete(modelId)
      this.clearModelCache(modelId)

      if (this.fragmentsInitialized) {
        fragments.core.update(true)
      }

      this.onModelUnloaded?.(modelId)
    } catch (error) {
      console.warn(`Error unloading model ${modelId}:`, error)
    }
  }

  async unloadAllModels(): Promise<void> {
    if (!this.fragmentsInitialized) {
      return
    }

    const fragments = this.components.get(OBC.FragmentsManager)
    const modelIds = Array.from(fragments.list.keys())

    for (const modelId of modelIds) {
      await this.unloadModel(modelId)
    }
  }

  dispose(): void {
    // Only access FragmentsManager if it was initialized
    if (this.fragmentsInitialized) {
      const fragments = this.components.get(OBC.FragmentsManager)

      for (const [, model] of fragments.list) {
        this.world.scene.three.remove(model.object)
        model.dispose()
      }

      fragments.list.clear()
    }

    this.elementCache.clear()
    this.pendingRequests.clear()
    this.fragmentsInitialized = false
  }

  private clearModelCache(modelId: string): void {
    const prefix = `${modelId}:`
    for (const key of this.elementCache.keys()) {
      if (key.startsWith(prefix)) this.elementCache.delete(key)
    }
    for (const key of this.pendingRequests.keys()) {
      if (key.startsWith(prefix)) this.pendingRequests.delete(key)
    }
  }
}
