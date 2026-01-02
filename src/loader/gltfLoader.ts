import * as THREE from 'three';
import { GLTFLoader as ThreeGltfLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export class GltfLoader {
    private loader: ThreeGltfLoader;

    constructor() {
        this.loader = new ThreeGltfLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/draco/');
        this.loader.setDRACOLoader(dracoLoader);
    }

    async load(source: string): Promise<THREE.Group> {
        // Default path: regular .gltf/.glb URL
        return this.loadFromUrlOrZip(source);
    }

    private async loadFromUrlOrZip(source: string): Promise<THREE.Group> {
        if (source.toLowerCase().endsWith('.zip'))
            return this.loadFromZipUrl(source);

        return new Promise((resolve, reject) => {
            this.loader.load(
                source,
                (gltf) => {
                    const scene = gltf.scene || gltf.scenes[0];
                    if (!scene) {
                        return reject(
                            new Error(
                                'Model contains no scene and cannot be viewed.'
                            )
                        );
                    }
                    resolve(scene);
                },
                undefined,
                reject
            );
        });
    }

    // --- see section 2 for implementation ---
    private async loadFromZipUrl(zipUrl: string): Promise<THREE.Group> {
        throw new Error('Not implemented');
    }
}
