/**
 * Worker utilities for @syyclops/ifc-viewer
 *
 * Handles loading the @thatopen/fragments streaming worker
 * with CORS-safe Blob URL fallback.
 */

const FRAGMENTS_VERSION = "3.3.6"
const CDN_WORKER_URL = `https://unpkg.com/@thatopen/fragments@${FRAGMENTS_VERSION}/dist/Worker/worker.mjs`

// Cache the blob URL to avoid re-fetching
let cachedBlobUrl: string | null = null

/**
 * Creates a same-origin Blob URL from CDN-hosted worker.
 * This bypasses CORS restrictions for web workers.
 */
export async function createWorkerBlobUrl(): Promise<string> {
  if (cachedBlobUrl) return cachedBlobUrl

  const response = await fetch(CDN_WORKER_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch worker: ${response.status} ${response.statusText}`)
  }

  const workerCode = await response.text()
  const blob = new Blob([workerCode], { type: "application/javascript" })
  cachedBlobUrl = URL.createObjectURL(blob)

  return cachedBlobUrl
}

/**
 * Cleans up the cached worker Blob URL.
 * Call this when completely done with all viewers.
 */
export function revokeWorkerBlobUrl(): void {
  if (cachedBlobUrl) {
    URL.revokeObjectURL(cachedBlobUrl)
    cachedBlobUrl = null
  }
}

export { CDN_WORKER_URL, FRAGMENTS_VERSION }
