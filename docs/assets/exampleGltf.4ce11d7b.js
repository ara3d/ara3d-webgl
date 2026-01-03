import { V as Viewer } from "./compressors.25b9b1d3.js";
import { G as GltfLoader } from "./gltfLoader.50406622.js";
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
//# sourceMappingURL=exampleGltf.4ce11d7b.js.map
