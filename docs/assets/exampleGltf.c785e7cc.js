import { V as Viewer } from "./compressors.8dce4834.js";
import { G as GltfLoader } from "./gltfLoader.e2611924.js";
async function runExample() {
  const viewer = new Viewer();
  const loader = new GltfLoader();
  console.log("Loading gltf ...");
  const gltf = await loader.load("/ara3d-webgl/duck.glb");
  console.log("Loaded gltf");
  gltf.traverse((child) => {
    if (child.isMesh) {
      viewer.add(child);
    }
  });
  console.log("Completed");
}
runExample();
//# sourceMappingURL=exampleGltf.c785e7cc.js.map
