// The footer's 3D controller: WG's own model, rig and animation (wondermakers.games, the
// section after their hero), rebuilt on plain three.js at the version they use (r152).
// Loaded on demand by footer-controller.tsx, so three.js stays out of the main bundle.
//
// Their scene, a Threlte canvas animated with Theatre.js:
//   environment: the six-face cube map in /3d/env, for reflections only (no lights)
//   group "Enviroment": rotates on x along the sequence; it holds the camera too, so the
//     view stays put and only the reflections sweep across the controller
//     camera: fov 50 at z = 2 (3 on screens under 769px; here, further back if the
//       controller wouldn't fit across the screen)
//     group "Controller": the model, moved and turned along the sequence
// The sequence runs 0–10; the keyframes below are copied from their Theatre.js state.
// /3d/controller.glb is their controller.gltf repacked with meshopt (16-bit positions,
// 12-bit normals): 1.8 MB instead of 8.9, and renders the same.

import {
  ACESFilmicToneMapping,
  CubeTextureLoader,
  Group,
  MathUtils,
  NoColorSpace,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type CubeTexture,
} from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js"

/** A Theatre.js bezier keyframe: `handles` are [left x, left y, right x, right y]. */
type Keyframe = { position: number; value: number; handles: [number, number, number, number] }

const k = (position: number, value: number, handles: Keyframe["handles"] = [0.5, 1, 0.5, 0]): Keyframe => ({ position, value, handles })

const TRACKS = {
  controller: {
    rotation: {
      x: [k(2, 0, [0.5, 1, 0.1234482020551915, 0.004950878546555848]), k(4.967, -109), k(10, -80, [0.39979414838000293, 0.9869749722248362, 0.5, 0])],
      y: [
        k(2, 0),
        k(4.967, 40, [0.5, 1, 0.7972336565372058, 0.014545454545454545]),
        k(6.633, -18.739889698547806, [0.3165958252625982, 0.8363636363636364, 0.41637084923485407, -0.4559249864109125]),
        k(10, 0),
      ],
      z: [k(2, 0), k(4.967, -180, [0.7552582935142567, 0.6290909090909091, 0.2684967348249861, 0.3054545454545455]), k(10, -540)],
    },
    position: {
      y: [
        k(0, -1, [0.5, 1, 0.47500000000000003, 0.004254238799026034]),
        k(2, -0.3),
        k(4.967, 0, [0.501432812964321, 0.8826023933596664, 0.5649877990633146, -0.10987725675356272]),
        k(10, -0.3),
      ],
      z: [
        k(0, 1, [0.5, 1, 0.7625, 0.00224743111116521]),
        k(4.967, -0.5, [0.7983612273361228, 0.9925409221521694, 0.32492881218038117, -0.002805609900134287]),
        k(10, 0.3),
      ],
    },
  },
  environment: {
    rotationX: [k(0.433, 0), k(2, 79), k(3.067, 45.28907209079212), k(5, 63), k(6.233, 10), k(6.933, -70.23010235807595), k(10, 70)],
  },
}

export const SEQUENCE_LENGTH = 10

/** cubic-bezier(x1, y1, x2, y2) at x, solved like WebKit's UnitBezier (y may overshoot). */
function bezier(x1: number, y1: number, x2: number, y2: number, x: number) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  let t = x
  for (let i = 0; i < 8; i++) {
    const err = sampleX(t) - x
    if (Math.abs(err) < 1e-6) break
    const d = (3 * ax * t + 2 * bx) * t + cx
    if (Math.abs(d) < 1e-6) break
    t -= err / d
  }
  if (Math.abs(sampleX(t) - x) > 1e-5) {
    // Newton didn't settle: bisect.
    let lo = 0
    let hi = 1
    t = x
    while (hi - lo > 1e-6) {
      if (sampleX(t) < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
  }
  return ((ay * t + by) * t + cy) * t
}

/** A track's value at a sequence position, eased between keyframes as Theatre.js does. */
function sample(track: Keyframe[], at: number) {
  if (at <= track[0]!.position) return track[0]!.value
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i]!
    const b = track[i + 1]!
    if (at < b.position) {
      const eased = bezier(a.handles[2], a.handles[3], b.handles[0], b.handles[1], (at - a.position) / (b.position - a.position))
      return a.value + (b.value - a.value) * eased
    }
  }
  return track[track.length - 1]!.value
}

export interface ControllerScene {
  /** Pose the scene at a sequence position (0–10) and draw it. */
  render(position: number): void
  /** Match the canvas's current size. */
  resize(): void
  dispose(): void
}

export async function createControllerScene(canvas: HTMLCanvasElement): Promise<ControllerScene> {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" })
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setClearColor(0x000000, 0)

  const scene = new Scene()
  const environment = new Group()
  const camera = new PerspectiveCamera(50, 1, 0.1, 2000)
  const controller = new Group()
  environment.add(camera, controller)
  scene.add(environment)

  const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const [gltf, envMap] = await Promise.all([
    gltfLoader.loadAsync("/3d/controller.glb"),
    new CubeTextureLoader().setPath("/3d/env/").loadAsync(["px.png", "nx.png", "py.png", "ny.png", "pz.png", "nz.png"]) as Promise<CubeTexture>,
  ])
  // Threlte's <Environment> loads a cube map as linear data, which makes it read brighter.
  envMap.colorSpace = NoColorSpace
  scene.environment = envMap
  controller.add(gltf.scene)

  const { controller: c, environment: e } = TRACKS
  const deg = MathUtils.degToRad

  const scene3d: ControllerScene = {
    render(position) {
      environment.rotation.set(deg(sample(e.rotationX, position)), 0, 0)
      controller.position.set(0, sample(c.position.y, position), sample(c.position.z, position))
      controller.rotation.set(deg(sample(c.rotation.x, position)), deg(sample(c.rotation.y, position)), deg(sample(c.rotation.z, position)))
      renderer.render(scene, camera)
    },
    resize() {
      const { clientWidth: w, clientHeight: h } = canvas
      if (!w || !h) return
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      // WG's distance, but on a tall narrow screen far enough back that the controller
      // (1.5 wide, resting at z = 0.3) still fits across it.
      const fit = 0.3 + 0.75 / 0.9 / (Math.tan(MathUtils.degToRad(camera.fov / 2)) * camera.aspect)
      camera.position.set(0, 0, Math.max(window.innerWidth < 769 ? 3 : 2, fit))
    },
    dispose() {
      gltf.scene.traverse((o) => {
        if ("geometry" in o) (o.geometry as { dispose(): void }).dispose()
        if ("material" in o) for (const m of ([] as { dispose(): void }[]).concat(o.material as never)) m.dispose()
      })
      envMap.dispose()
      renderer.dispose()
    },
  }
  scene3d.resize()
  return scene3d
}
