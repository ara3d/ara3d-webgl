import { V as Viewer, B as BimOpenSchemaLoader } from "./viewer.02dcc5b2.js";
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
//# sourceMappingURL=exampleBos.9fce58dc.js.map
