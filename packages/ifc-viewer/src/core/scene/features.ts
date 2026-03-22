import * as OBC from "@thatopen/components"
import Stats from "stats.js"
import { OrientationGizmo } from "../../components"
import type { FeaturesConfig } from "../../types"

export interface FeaturesInstance {
  stats?: Stats
  gizmo?: OrientationGizmo
  dispose: () => void
}

export function setupFeatures(
  components: OBC.Components,
  world: OBC.World,
  config: FeaturesConfig = {}
): FeaturesInstance {
  let stats: Stats | undefined
  let gizmo: OrientationGizmo | undefined

  if (config.grid) {
    const grids = components.get(OBC.Grids)
    grids.create(world)
  }

  if (config.stats) {
    stats = new Stats()
    stats.showPanel(0)

    // Append to the viewer container instead of document.body
    const container = world.renderer?.three.domElement.parentElement
    if (container) {
      container.style.position = "relative"
      container.append(stats.dom)
      stats.dom.style.position = "absolute"
      stats.dom.style.top = "0px"
      stats.dom.style.left = "0px"
      stats.dom.style.zIndex = "10"
    }

    world.renderer?.onBeforeUpdate.add(() => stats!.begin())
    world.renderer?.onAfterUpdate.add(() => stats!.end())
  }

  if (config.gizmo !== false && world.renderer && world.camera) {
    // Cast world to the specific type expected by OrientationGizmo
    // This is safe because we check for renderer and camera above
    gizmo = new OrientationGizmo(
      components,
      world as OBC.World & {
        camera: OBC.OrthoPerspectiveCamera
        renderer: OBC.SimpleRenderer
      }
    )
  }

  return {
    stats,
    gizmo,
    dispose: () => {
      if (stats) {
        stats.dom.remove()
      }
    },
  }
}
