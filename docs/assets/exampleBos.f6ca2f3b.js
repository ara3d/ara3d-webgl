import { V as Viewer } from "./compressors.5793b060.js";
import { B as BimOpenSchemaLoader } from "./bimOpenSchemaLoader.4bddc573.js";
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
//# sourceMappingURL=exampleBos.f6ca2f3b.js.map
