import * as OBC from "@thatopen/components"
import * as THREE from "three"
import type { SceneConfig } from "../../types"

export interface SceneInstance {
  components: OBC.Components
  world: OBC.World
  camera: OBC.OrthoPerspectiveCamera
}

export async function createScene(
  container: HTMLElement,
  config: SceneConfig = {}
): Promise<SceneInstance> {
  const components = new OBC.Components()
  const worlds = components.get(OBC.Worlds)

  const world = worlds.create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>()

  world.scene = new OBC.SimpleScene(components)
  world.scene.setup()

  world.renderer = new OBC.SimpleRenderer(components, container)
  world.camera = new OBC.OrthoPerspectiveCamera(components)
  world.camera.controls.setLookAt(15, 6, 8, 0, 0, -10, true)

  if (config.backgroundColor) {
    world.scene.three.background = new THREE.Color(config.backgroundColor)
  } else {
    world.scene.three.background = null
  }

  return { components, world, camera: world.camera }
}

export function disposeScene(instance: SceneInstance): void {
  instance.components.dispose()
}
