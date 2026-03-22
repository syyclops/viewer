import { useEffect } from "react"
import type { ElementHoveredEvent, ElementSelectedEvent } from "../../types"
import { useViewer } from "../context"

export interface UseViewerEventsOptions {
  onElementSelected?: (event: ElementSelectedEvent) => void
  onElementHovered?: (event: ElementHoveredEvent | null) => void
}

export function useViewerEvents(options: UseViewerEventsOptions) {
  const { interactionManager, isInitialized } = useViewer()

  useEffect(() => {
    if (!interactionManager || !isInitialized) return

    // Subscribe to selection events
    const selectHandler = options.onElementSelected
      ? (event: {
          modelIdMap: Record<string, Set<number>>
          mousePosition?: { clientX: number; clientY: number }
          point?: { x: number; y: number; z: number }
        }) => {
          options.onElementSelected?.({
            modelIdMap: event.modelIdMap,
            position: event.mousePosition,
            point: event.point,
          })
        }
      : undefined

    // Subscribe to hover events
    const hoverHandler = options.onElementHovered
      ? (
          event: {
            modelId: string
            localId: number
            mousePosition?: { clientX: number; clientY: number }
            point: { x: number; y: number; z: number }
          } | null
        ) => {
          options.onElementHovered?.(
            event
              ? {
                  modelIdMap: { [event.modelId]: new Set([event.localId]) },
                  position: event.mousePosition,
                  point: event.point,
                }
              : null
          )
        }
      : undefined

    if (selectHandler) {
      interactionManager.onSelect.add(selectHandler)
    }
    if (hoverHandler) {
      interactionManager.onHover.add(hoverHandler)
    }

    return () => {
      if (selectHandler) {
        interactionManager.onSelect.remove(selectHandler)
      }
      if (hoverHandler) {
        interactionManager.onHover.remove(hoverHandler)
      }
    }
  }, [interactionManager, isInitialized, options.onElementSelected, options.onElementHovered])
}
