import "./modulepreload-polyfill.c7c6310f.js";
import { V as Viewer } from "./viewer.b9ba82bf.js";
import "./bimOpenSchemaLoader.bafda526.js";
import { G as GltfLoader } from "./gltfLoader.e48e4a6a.js";
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
//# sourceMappingURL=exampleGltf.fbb2879b.js.map
