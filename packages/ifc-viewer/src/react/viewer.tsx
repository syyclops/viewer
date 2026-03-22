import { type CSSProperties, useEffect, useMemo, useRef } from "react"
import { useViewer } from "./context"
import type { ViewerProps } from "./types"

export function Viewer({ onReady, onError }: ViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { initialize, isInitialized, error, camera, resize, backgroundColor } = useViewer()
  const hasInitialized = useRef(false)

  const styles = useMemo<CSSProperties>(
    () => ({
      width: "100%",
      height: "100%",
      position: "relative",
      overflow: "hidden",
      cursor: camera?.cursor ?? "default",
      // Match viewer background to prevent white flash on resize
      backgroundColor: backgroundColor ?? undefined,
    }),
    [camera?.cursor, backgroundColor]
  )

  // Init the viewer when the container mounts
  useEffect(() => {
    const container = containerRef.current
    if (!container || hasInitialized.current) return

    hasInitialized.current = true
    initialize(container).catch((err) => {
      console.error("[Viewer] Initialize error:", err)
      onError?.(err)
    })
  }, [initialize, onError])

  // Notify when ready
  useEffect(() => {
    if (isInitialized) {
      onReady?.()
    }
  }, [isInitialized, onReady])

  // Notify on errors
  useEffect(() => {
    if (error) {
      onError?.(error)
    }
  }, [error, onError])

  // Watch container for resize events and trigger renderer resize (debounced)
  useEffect(() => {
    const container = containerRef.current
    if (!container || !isInitialized) return

    let resizeTimeout: ReturnType<typeof setTimeout> | null = null

    const resizeObserver = new ResizeObserver(() => {
      // Debounce resize calls to prevent flickering during drag
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      resizeTimeout = setTimeout(() => {
        resize()
      }, 16) // ~60fps, fires after resize stops
    })

    resizeObserver.observe(container)

    return () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      resizeObserver.disconnect()
    }
  }, [isInitialized, resize])

  return <div ref={containerRef} style={styles}></div>
}
