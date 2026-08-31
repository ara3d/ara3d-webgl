import { B as BimOpenSchemaLoader } from "./bimOpenSchemaLoader.1c0420b7.js";
import { V as Viewer } from "./viewer.eec8521c.js";
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
//# sourceMappingURL=exampleBos.2f22bdd2.js.map
