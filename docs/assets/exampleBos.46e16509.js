import "./modulepreload-polyfill.c7c6310f.js";
import { V as Viewer } from "./viewer.b9ba82bf.js";
import { B as BimOpenSchemaLoader } from "./bimOpenSchemaLoader.bafda526.js";
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
//# sourceMappingURL=exampleBos.46e16509.js.map
