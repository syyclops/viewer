# Syyclops IFC Viewer

A simple, open-source web viewer for IFC (Industry Foundation Classes) building models. Upload an `.ifc` file and explore it in 3D — orbit, zoom, hover, and select elements.

Built on [@thatopen/components](https://github.com/ThatOpen/engine_components) and Three.js.

## Getting Started

```bash
# Install dependencies
bun install

# Start the dev server
bun run dev
```

Open [http://localhost:4000](http://localhost:4000) and drag in an IFC file.

## Project Structure

```
viewer/
├── apps/web/              # React web app
├── packages/ifc-viewer/   # Reusable IFC viewer package
└── tooling/tsconfig/      # Shared TypeScript configs
```

### `@syyclops/ifc-viewer`

The viewer package can be used independently in any React project:

```tsx
import { ViewerProvider, Viewer, useViewer } from "@syyclops/ifc-viewer"

function App() {
  return (
    <ViewerProvider config={{ backgroundColor: "#1c1b18", gridEnabled: true }}>
      <Viewer />
    </ViewerProvider>
  )
}
```

Load a model using the `useViewer` hook:

```tsx
const { loadModel } = useViewer()

const buffer = await file.arrayBuffer()
await loadModel(buffer, file.name, (progress) => {
  console.log(`${Math.round(progress * 100)}%`)
})
```

## Features

- IFC file loading with progress tracking
- Orbit, first-person, and plan camera modes
- Element hover and selection highlighting
- Multi-select with Ctrl/Cmd+click
- Orientation gizmo
- Floor plan extraction
- Drag-and-drop file upload

## Tech Stack

- [Bun](https://bun.sh) — runtime & package manager
- [React 19](https://react.dev) — UI
- [Vite](https://vite.dev) — build tool
- [Three.js](https://threejs.org) — 3D rendering
- [@thatopen/components](https://github.com/ThatOpen/engine_components) — BIM engine
- [Biome](https://biomejs.dev) — linting & formatting
