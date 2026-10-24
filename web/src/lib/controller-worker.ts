// The footer's 3D controller, drawn in a worker on the canvas the page hands over
// (controller-host.ts). The model loads as soon as the canvas arrives; the GPU work waits
// for "start", sent once the page is still. The page then sends sizes and sequence
// positions; only the latest of each is drawn, once per frame, so a slow GPU never falls
// behind the scroll.

import { createControllerScene, type ControllerScene, type ViewSize } from "@/lib/controller-scene"

export type ToWorker =
  | { type: "init"; canvas: OffscreenCanvas; size: ViewSize }
  | { type: "render"; position: number }
  | { type: "resize"; size: ViewSize }
  | { type: "start" }

export type FromWorker = { type: "ready" } | { type: "failed"; message: string }

let scene: ControllerScene | null = null
let position: number | null = null
let size: ViewSize | null = null
let scheduled = false
let startNow = () => {}
const started = new Promise<void>((resolve) => (startNow = resolve))

const nextFrame: (draw: () => void) => void = typeof requestAnimationFrame === "function" ? (draw) => requestAnimationFrame(draw) : (draw) => setTimeout(draw, 16)
const post = (message: FromWorker) => self.postMessage(message)

function draw() {
  scheduled = false
  if (!scene) return
  if (size) scene.resize(size)
  size = null
  if (position !== null) scene.render(position)
}

function schedule() {
  if (scheduled || !scene) return
  scheduled = true
  nextFrame(draw)
}

self.onmessage = async ({ data }: MessageEvent<ToWorker>) => {
  switch (data.type) {
    case "init":
      try {
        scene = await createControllerScene(data.canvas, data.size, started)
        post({ type: "ready" })
        schedule()
      } catch (err) {
        post({ type: "failed", message: String(err) })
      }
      break
    case "render":
      position = data.position
      schedule()
      break
    case "resize":
      size = data.size
      schedule()
      break
    case "start":
      startNow()
      break
  }
}
