import type * as OBC from "@thatopen/components"
import type { CameraMode, CameraProjection } from "../../types"

export type CameraCursor = "default" | "crosshair" | "grab"

const CURSOR_BY_MODE: Record<CameraMode, CameraCursor> = {
  Orbit: "default",
  FirstPerson: "crosshair",
  Plan: "grab",
}

export interface CameraState {
  mode: CameraMode
  projection: CameraProjection
  cursor: CameraCursor
}

export interface CameraManagerCallbacks {
  onChange?: (state: CameraState) => void
}

export class CameraManager {
  private camera: OBC.OrthoPerspectiveCamera
  private mode: CameraMode = "Orbit"
  private projection: CameraProjection = "Orthographic"
  private callbacks?: CameraManagerCallbacks

  constructor(camera: OBC.OrthoPerspectiveCamera, callbacks?: CameraManagerCallbacks) {
    this.camera = camera
    this.callbacks = callbacks
  }

  getState(): CameraState {
    return {
      mode: this.mode,
      projection: this.projection,
      cursor: CURSOR_BY_MODE[this.mode],
    }
  }

  getMode(): CameraMode {
    return this.mode
  }

  getProjection(): CameraProjection {
    return this.projection
  }

  setProjection(projection: CameraProjection) {
    // Validate: Orthographic projection can not be used with FirstPerson mode
    if (projection === "Orthographic" && this.mode === "FirstPerson") {
      this.projection = "Perspective"
    } else {
      this.projection = projection
    }

    this.camera.projection.set(this.projection)
    this.notifyChange()
  }

  setMode(mode: CameraMode) {
    // Validate: FirstPerson requires Perspective projection
    if (mode === "FirstPerson" && this.projection === "Orthographic") {
      this.projection = "Perspective"
      this.camera.projection.set(this.projection)
    }

    this.camera.set(mode)
    this.mode = mode
    this.notifyChange()
  }

  private notifyChange() {
    this.callbacks?.onChange?.(this.getState())
  }

  fitToItems() {
    this.camera.fitToItems()
  }

  dispose() {
    this.camera.dispose()
  }
}
