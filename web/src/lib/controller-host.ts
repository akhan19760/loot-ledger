import type { ViewSize } from "@/lib/controller-scene"
import type { FromWorker, ToWorker } from "@/lib/controller-worker"

/** The footer's 3D controller on the page, wherever it's drawn. */
export interface ControllerView {
  canvas: HTMLCanvasElement
  render(position: number): void
  resize(): void
  dispose(): void
}

const sizeOf = (canvas: HTMLCanvasElement): ViewSize => ({
  width: canvas.clientWidth,
  height: canvas.clientHeight,
  pixelRatio: Math.min(window.devicePixelRatio, 2),
  viewportWidth: window.innerWidth,
})

function addCanvas(parent: HTMLElement, className: string) {
  const canvas = document.createElement("canvas")
  canvas.className = className
  parent.append(canvas)
  return canvas
}

/** Draws in a worker (controller-worker.ts), so building the scene never blocks the page. */
async function inWorker(canvas: HTMLCanvasElement): Promise<ControllerView> {
  const worker = new Worker(new URL("./controller-worker.ts", import.meta.url), { type: "module" })
  const send = (message: ToWorker, transfer: Transferable[] = []) => worker.postMessage(message, transfer)
  const offscreen = canvas.transferControlToOffscreen()
  send({ type: "init", canvas: offscreen, size: sizeOf(canvas) }, [offscreen])
  try {
    await new Promise<void>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<FromWorker>) => (data.type === "ready" ? resolve() : reject(new Error(data.message)))
      worker.onerror = (e) => reject(new Error(e.message))
    })
  } catch (err) {
    worker.terminate()
    throw err
  }
  return {
    canvas,
    render: (position) => send({ type: "render", position }),
    resize: () => send({ type: "resize", size: sizeOf(canvas) }),
    dispose: () => {
      worker.terminate()
      canvas.remove()
    },
  }
}

/** Draws on the page's own thread, for browsers without WebGL on an OffscreenCanvas. */
async function onPage(canvas: HTMLCanvasElement): Promise<ControllerView> {
  const { createControllerScene } = await import("@/lib/controller-scene")
  const scene = await createControllerScene(canvas, sizeOf(canvas))
  return {
    canvas,
    render: scene.render,
    resize: () => scene.resize(sizeOf(canvas)),
    dispose: () => {
      scene.dispose()
      canvas.remove()
    },
  }
}

/**
 * Add the controller's canvas to `parent` and build the scene on it. A canvas handed to a
 * worker can't be drawn on here, so if the worker fails, a fresh canvas takes its place.
 */
export async function mountController(parent: HTMLElement, className: string): Promise<ControllerView> {
  const canvas = addCanvas(parent, className)
  if (typeof Worker === "function" && "transferControlToOffscreen" in canvas) {
    try {
      return await inWorker(canvas)
    } catch {
      canvas.remove()
    }
  }
  const fallback = parent.contains(canvas) ? canvas : addCanvas(parent, className)
  try {
    return await onPage(fallback)
  } catch (err) {
    fallback.remove()
    throw err
  }
}
