// @types/three 0.152 has no types for three's meshopt decoder; this is the part we use.
declare module "three/addons/libs/meshopt_decoder.module.js" {
  export const MeshoptDecoder: {
    supported: boolean
    ready: Promise<void>
    decodeVertexBuffer(target: Uint8Array, count: number, size: number, source: Uint8Array, filter?: string): void
    decodeIndexBuffer(target: Uint8Array, count: number, size: number, source: Uint8Array): void
    decodeIndexSequence(target: Uint8Array, count: number, size: number, source: Uint8Array): void
    decodeGltfBuffer(target: Uint8Array, count: number, size: number, source: Uint8Array, mode: string, filter?: string): void
  }
}
