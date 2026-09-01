import "./modulepreload-polyfill.c7c6310f.js";
import { V as Viewer } from "./viewer.f912142e.js";
import { B as BimOpenSchemaLoader } from "./bimOpenSchemaLoader.69b9fd7e.js";
async function runExample() {
  const viewer = new Viewer();
  const loader = new BimOpenSchemaLoader();
  console.time("Loading .bos file");
  const bimData = await loader.load("/ara3d-webgl/Snowdon Towers Sample Architectural.bos");
  console.timeEnd("Loading .bos file");
  let group = bimData.ThreeGeometry;
  viewer.add(group);
}
runExample();
//# sourceMappingURL=exampleBos.fe77c890.js.map
