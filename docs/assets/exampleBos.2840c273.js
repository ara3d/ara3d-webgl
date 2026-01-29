import { V as Viewer } from "./compressors.ca4e4f79.js";
import { B as BimOpenSchemaLoader } from "./bimOpenSchemaLoader.180bc89b.js";
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
//# sourceMappingURL=exampleBos.2840c273.js.map
