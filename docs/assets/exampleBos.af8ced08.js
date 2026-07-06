import { V as Viewer, B as BimOpenSchemaLoader } from "./viewer.cf996c39.js";
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
//# sourceMappingURL=exampleBos.af8ced08.js.map
