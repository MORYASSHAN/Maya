import { useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'

let ktx2: KTX2Loader | null = null

/** Loaded on demand by <ModelSlot> only when a .glb URL is configured. */
export default function ModelGlb({ url }: { url: string }) {
  const gl = useThree((s) => s.gl)
  // `true` = Draco decoder from the CDN drei ships with; the KTX2 transcoder is served
  // from /public/basis (copy node_modules/three/examples/jsm/libs/basis there).
  const { scene } = useGLTF(url, true, true, (loader) => {
    ktx2 ??= new KTX2Loader().setTranscoderPath('/basis/').detectSupport(gl)
    // drei types its loader against three-stdlib; the three.js KTX2Loader is compatible at runtime.
    loader.setKTX2Loader(ktx2 as unknown as Parameters<typeof loader.setKTX2Loader>[0])
  })
  return <primitive object={scene} />
}
