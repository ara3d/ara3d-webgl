import "./bimOpenSchemaLoader.1c0420b7.js";
import { V as Viewer } from "./viewer.eec8521c.js";
import { G as GltfLoader } from "./gltfLoader.c3a36e8a.js";
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
//# sourceMappingURL=exampleGltf.824fff35.js.map
