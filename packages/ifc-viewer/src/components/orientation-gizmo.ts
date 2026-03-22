import * as OBC from "@thatopen/components"
import * as THREE from "three"

interface GizmoAxis {
  axis: string
  direction: THREE.Vector3
  size: number
  color: readonly [string, string]
  line?: number
  label?: string
  position: THREE.Vector3
}

// World interface with the specific camera/renderer types we need
interface GizmoWorld extends OBC.World {
  camera: OBC.OrthoPerspectiveCamera
  renderer: OBC.SimpleRenderer
}

/**
 * A component that adds an orientation gizmo to the scene
 */
export class OrientationGizmo extends OBC.Component implements OBC.Disposable, OBC.Updateable {
  static readonly uuid = "8c945a9f-ec34-4987-806f-def769321fe8" as const

  enabled = true
  readonly onDisposed = new OBC.Event()
  readonly onBeforeUpdate = new OBC.Event()
  readonly onAfterUpdate = new OBC.Event()

  private size = 100
  private padding = 12
  private bubbleSizePrimary = 10
  private bubbleSizeSecondary = 6
  private lineWidth = 1.5
  private fontSize = "11px"
  private fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  private fontWeight = "600"
  private fontColor = "#ffffff"
  private colors = {
    x: ["#ef4444", "#b91c1c"] as const,
    y: ["#22c55e", "#15803d"] as const,
    z: ["#3b82f6", "#1d4ed8"] as const,
  }

  private domElement: HTMLCanvasElement
  private context: CanvasRenderingContext2D
  private rect?: DOMRect
  private world: GizmoWorld
  private isDragging = false
  private selectedAxis: GizmoAxis | null = null
  private invRotMat = new THREE.Matrix4()
  private rotateStart = new THREE.Vector2()
  private rotateEnd = new THREE.Vector2()
  private rotateDelta = new THREE.Vector2()
  private mouse = new THREE.Vector3()
  private center: THREE.Vector3
  private axes: GizmoAxis[]

  constructor(components: OBC.Components, world: GizmoWorld) {
    super(components)
    this.world = world
    this.center = new THREE.Vector3(this.size / 2, this.size / 2, 0)
    this.axes = this.createAxes()
    this.domElement = this.createCanvas()
    // Get device pixel ratio
    const dpr = window.devicePixelRatio || 1
    this.context = this.domElement.getContext("2d")!

    // Scale the context to account for device pixel ratio
    this.context.scale(dpr, dpr)

    components.add(OrientationGizmo.uuid, this)

    // Add canvas to renderer container
    const container = this.world.renderer?.container.parentElement
    if (container) {
      container.appendChild(this.domElement)
    }

    this.setupEvents()
  }

  private createAxes() {
    return [
      {
        axis: "x",
        direction: new THREE.Vector3(1, 0, 0),
        size: this.bubbleSizePrimary,
        color: this.colors.x,
        line: this.lineWidth,
        label: "X",
        position: new THREE.Vector3(0, 0, 0),
      },
      {
        axis: "y",
        direction: new THREE.Vector3(0, 1, 0),
        size: this.bubbleSizePrimary,
        color: this.colors.y,
        line: this.lineWidth,
        label: "Y",
        position: new THREE.Vector3(0, 0, 0),
      },
      {
        axis: "z",
        direction: new THREE.Vector3(0, 0, 1),
        size: this.bubbleSizePrimary,
        color: this.colors.z,
        line: this.lineWidth,
        label: "Z",
        position: new THREE.Vector3(0, 0, 0),
      },
      {
        axis: "-x",
        direction: new THREE.Vector3(-1, 0, 0),
        size: this.bubbleSizeSecondary,
        color: this.colors.x,
        position: new THREE.Vector3(0, 0, 0),
      },
      {
        axis: "-y",
        direction: new THREE.Vector3(0, -1, 0),
        size: this.bubbleSizeSecondary,
        color: this.colors.y,
        position: new THREE.Vector3(0, 0, 0),
      },
      {
        axis: "-z",
        direction: new THREE.Vector3(0, 0, -1),
        size: this.bubbleSizeSecondary,
        color: this.colors.z,
        position: new THREE.Vector3(0, 0, 0),
      },
    ]
  }

  private createCanvas() {
    const canvas = document.createElement("canvas")
    const dpr = window.devicePixelRatio || 1

    // Adjust canvas size for device pixel ratio
    canvas.width = this.size * dpr
    canvas.height = this.size * dpr

    // Set CSS size
    canvas.style.width = `${this.size}px`
    canvas.style.height = `${this.size}px`

    canvas.style.position = "absolute"
    canvas.style.right = "10px"
    canvas.style.top = "10px"
    canvas.style.pointerEvents = "auto"
    canvas.style.cursor = "pointer"
    return canvas
  }

  private setupEvents() {
    this.domElement.addEventListener("pointerdown", this.onPointerDown)
    this.domElement.addEventListener("pointerenter", this.onPointerEnter)
    this.domElement.addEventListener("pointermove", this.onPointerMove)
    this.domElement.addEventListener("click", this.onClick)
  }

  private onPointerDown = (e: PointerEvent) => {
    this.rotateStart.set(e.clientX, e.clientY)
    window.addEventListener("pointermove", this.onDrag)
    window.addEventListener("pointerup", this.onPointerUp)
  }

  private onPointerUp = () => {
    setTimeout(() => {
      this.isDragging = false
    }, 0)
    window.removeEventListener("pointermove", this.onDrag)
    window.removeEventListener("pointerup", this.onPointerUp)
  }

  private onPointerEnter = () => {
    this.rect = this.domElement.getBoundingClientRect()
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this.isDragging || !this.rect) return

    const currentAxis = this.selectedAxis
    this.selectedAxis = null

    this.mouse.set(e.clientX - this.rect.left, e.clientY - this.rect.top, 0)

    for (const axis of this.axes) {
      const distance = this.mouse.distanceTo(axis.position)
      if (distance < axis.size) {
        this.selectedAxis = axis
      }
    }

    if (currentAxis !== this.selectedAxis) {
      this.drawLayers()
    }
  }

  private onDrag = (e: PointerEvent) => {
    if (!this.isDragging) {
      this.isDragging = true
    }

    this.selectedAxis = null
    this.rotateEnd.set(e.clientX, e.clientY)
    this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(0.5)

    // Use OrthoPerspectiveCamera controls
    const camera = this.world.camera
    camera.controls.rotate(
      (-2 * Math.PI * this.rotateDelta.x) / this.domElement.height,
      (-2 * Math.PI * this.rotateDelta.y) / this.domElement.height // Negated y rotation
    )

    this.rotateStart.copy(this.rotateEnd)
  }

  private onClick = () => {
    if (this.isDragging || !this.selectedAxis) return

    const direction = this.selectedAxis.direction.clone().normalize()
    const controls = this.world.camera.controls
    const camera = this.world.camera.three

    // Get the current camera position and target
    const cameraPosition = new THREE.Vector3()
    controls.getPosition(cameraPosition)

    const target = new THREE.Vector3()
    controls.getTarget(target)

    // Compute the distance between the camera and the target
    const distance = cameraPosition.distanceTo(target)

    // Compute the target position along the selected axis
    const targetPosition = direction.multiplyScalar(distance).add(target)

    // Adjust camera's up vector if necessary
    if (Math.abs(direction.y) === 1) {
      camera.up.set(0, 0, 1) // Use Z-up when looking along Y-axis
    } else {
      camera.up.set(0, 1, 0) // Default up vector
    }

    // Use controls.setLookAt to move the camera smoothly
    controls
      .setLookAt(
        targetPosition.x,
        targetPosition.y,
        targetPosition.z,
        target.x,
        target.y,
        target.z,
        true // enable transition
      )
      .then(() => {
        // After the animation completes, trigger any necessary updates
        this.onPointerMove(new PointerEvent("pointermove"))
      })

    this.selectedAxis = null
  }

  private drawCircle(p: THREE.Vector3, radius = 10, color = "#FF0000", highlight = false) {
    this.context.save()

    // Subtle shadow for depth
    this.context.shadowColor = "rgba(0, 0, 0, 0.3)"
    this.context.shadowBlur = 3
    this.context.shadowOffsetX = 0
    this.context.shadowOffsetY = 1

    this.context.beginPath()
    this.context.arc(p.x, p.y, radius, 0, 2 * Math.PI, false)
    this.context.fillStyle = color
    this.context.fill()

    // Reset shadow for highlight ring
    this.context.shadowColor = "transparent"
    this.context.shadowBlur = 0

    // Highlight ring on hover
    if (highlight) {
      this.context.strokeStyle = "rgba(255, 255, 255, 0.9)"
      this.context.lineWidth = 2
      this.context.stroke()
    }

    this.context.closePath()
    this.context.restore()
  }

  private drawLine(p1: THREE.Vector3, p2: THREE.Vector3, width = 1, color = "#FF0000") {
    this.context.save()
    this.context.beginPath()
    this.context.moveTo(p1.x, p1.y)
    this.context.lineTo(p2.x, p2.y)
    this.context.lineWidth = width
    this.context.strokeStyle = color
    this.context.lineCap = "round"
    this.context.stroke()
    this.context.closePath()
    this.context.restore()
  }

  private drawCenterPoint() {
    const ctx = this.context
    ctx.save()
    ctx.beginPath()
    ctx.arc(this.center.x, this.center.y, 2, 0, 2 * Math.PI)
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)"
    ctx.fill()
    ctx.closePath()
    ctx.restore()
  }

  private drawLayers(clear = true) {
    if (clear) {
      this.context.clearRect(0, 0, this.domElement.width, this.domElement.height)
    }

    // Draw center point
    this.drawCenterPoint()

    for (const axis of this.axes) {
      const highlight = this.selectedAxis === axis
      const color = axis.position.z >= -0.01 ? axis.color[0] : axis.color[1]

      if (axis.line) {
        this.drawLine(this.center, axis.position, axis.line, color)
      }

      this.drawCircle(axis.position, axis.size, color, highlight)

      if (axis.label) {
        this.context.save()
        this.context.font = `${this.fontWeight} ${this.fontSize} ${this.fontFamily}`
        this.context.textBaseline = "middle"
        this.context.textAlign = "center"

        // Text shadow for better readability
        this.context.shadowColor = "rgba(0, 0, 0, 0.5)"
        this.context.shadowBlur = 2
        this.context.shadowOffsetX = 0
        this.context.shadowOffsetY = 1

        this.context.fillStyle = this.fontColor
        this.context.fillText(axis.label, axis.position.x, axis.position.y)
        this.context.restore()
      }
    }
  }

  private setAxisPosition(axis: GizmoAxis): void {
    const position = axis.direction.clone().applyMatrix4(this.invRotMat)
    const size = axis.size
    axis.position.set(
      position.x * (this.center.x - size / 2 - this.padding) + this.center.x,
      this.center.y - position.y * (this.center.y - size / 2 - this.padding),
      position.z
    )
  }

  dispose() {
    this.enabled = false
    this.domElement.removeEventListener("pointerdown", this.onPointerDown)
    this.domElement.removeEventListener("pointerenter", this.onPointerEnter)
    this.domElement.removeEventListener("pointermove", this.onPointerMove)
    this.domElement.removeEventListener("click", this.onClick)
    this.domElement.remove()
    this.onDisposed.trigger()
    this.onDisposed.reset()
    this.onBeforeUpdate.reset()
    this.onAfterUpdate.reset()
  }

  update() {
    if (!this.enabled) return

    this.onBeforeUpdate.trigger()

    const camera = this.world.camera.three
    camera.updateMatrix()
    this.invRotMat.extractRotation(camera.matrix).invert()

    for (const axis of this.axes) {
      this.setAxisPosition(axis)
    }

    this.axes.sort((a, b) => (a.position.z > b.position.z ? 1 : -1))
    this.drawLayers(true)

    this.onAfterUpdate.trigger()
  }
}
