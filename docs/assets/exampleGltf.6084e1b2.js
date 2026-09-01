import "./modulepreload-polyfill.c7c6310f.js";
import { V as Viewer } from "./viewer.f912142e.js";
import "./bimOpenSchemaLoader.69b9fd7e.js";
import { G as GltfLoader } from "./gltfLoader.aca06de8.js";
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
//# sourceMappingURL=exampleGltf.6084e1b2.js.map
