import { n as Viewer } from "./bvhPrecompute.worker.858fae95.js";
import { B as BimOpenSchemaLoader } from "./bimOpenSchemaLoader.cde4167e.js";
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
//# sourceMappingURL=exampleBos.2bc74326.js.map
