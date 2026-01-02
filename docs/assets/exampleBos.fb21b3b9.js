import { V as Viewer } from './compressors.f6880dca.js';
import { B as BimOpenSchemaLoader } from './bimOpenSchemaLoader.8135e0a5.js';
async function runExample() {
    const viewer = new Viewer();
    const loader = new BimOpenSchemaLoader();
    console.time('Loading .bos file');
    const group = await loader.load('/ara3d-webgl/snowdon.bos');
    console.timeEnd('Loading .bos file');
    console.time('Add object to viewer');
    viewer.add(group);
    console.timeEnd('Add object to viewer');
}
runExample();
//# sourceMappingURL=exampleBos.fb21b3b9.js.map
