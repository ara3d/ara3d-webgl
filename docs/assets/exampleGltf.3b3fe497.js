import { V as Viewer } from './compressors.f6880dca.js';
import { G as GltfLoader } from './gltfLoader.a307dfed.js';
async function runExample() {
    const viewer = new Viewer();
    const loader = new GltfLoader();
    console.log('Loading gltf ...');
    const gltf = await loader.load('/ara3d-webgl/duck.glb');
    console.log('Loaded gltf');
    gltf.traverse((child) => {
        if (child.isMesh) {
            viewer.add(child);
        }
    });
    console.log('Completed');
}
runExample();
//# sourceMappingURL=exampleGltf.3b3fe497.js.map
