import { V as Viewer } from "./compressors.ca4e4f79.js";
import { G as GltfLoader } from "./gltfLoader.25e01610.js";
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
//# sourceMappingURL=exampleGltf.750faac6.js.map
