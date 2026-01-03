import { V as Viewer } from "./compressors.25b9b1d3.js";
import { B as BimOpenSchemaLoader } from "./bimOpenSchemaLoader.e5358af1.js";
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
//# sourceMappingURL=exampleBos.3871bbdd.js.map
