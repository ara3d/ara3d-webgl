import * as THREE from 'three';

export const SELECTION_OVERLAY_FILL_OPACITY = 1;
export const SELECTION_EDGE_COLOR = 0xffff00;
export const SELECTION_EDGE_THRESHOLD_DEG = 30;
export const SELECTION_EDGE_ELEMENT_LIMIT = 500;

export class SelectionOverlayHelper {
    private readonly edgeCacheRaw = new Map<THREE.BufferGeometry, THREE.EdgesGeometry>();
    private readonly edgeColor: number;
    private readonly edgeThresholdDeg: number;
    private readonly edgeElementLimit: number;
    private readonly fillOpacity: number;

    constructor(options?: {
        fillOpacity?: number;
        edgeColor?: number;
        edgeThresholdDeg?: number;
        edgeElementLimit?: number;
    }) {
        this.fillOpacity = options?.fillOpacity ?? SELECTION_OVERLAY_FILL_OPACITY;
        this.edgeColor = options?.edgeColor ?? SELECTION_EDGE_COLOR;
        this.edgeThresholdDeg = options?.edgeThresholdDeg ?? SELECTION_EDGE_THRESHOLD_DEG;
        this.edgeElementLimit = options?.edgeElementLimit ?? SELECTION_EDGE_ELEMENT_LIMIT;
    }

    createSelectionFillMaterial(
        colorString: string,
        opacity = this.fillOpacity
    ): THREE.MeshStandardMaterial {
        return new THREE.MeshStandardMaterial({
            color: new THREE.Color(colorString),
            roughness: 1,
            metalness: 0,
            flatShading: true,
            side: THREE.DoubleSide,
            transparent: opacity < 1,
            opacity,
            depthTest: true,
            depthWrite: false
        });
    }

    getEffectiveSelectionVisualConfig(selectedCount: number): {
        fillEnabled: boolean;
        edgesEnabled: boolean;
    } {
        return {
            fillEnabled: selectedCount > 0,
            edgesEnabled: selectedCount > 0 && selectedCount < this.edgeElementLimit
        };
    }

    addSelectionEdgeLines(overlayObject: THREE.Object3D): void {
        const edgeMaterial = new THREE.LineBasicMaterial({
            color: this.edgeColor,
            transparent: true,
            opacity: 1,
            depthTest: false,
            depthWrite: false
        });

        const meshes: THREE.Mesh[] = [];
        const instancedMeshes: THREE.InstancedMesh[] = [];
        overlayObject.traverse((child) => {
            if (child instanceof THREE.InstancedMesh && child.geometry) {
                instancedMeshes.push(child);
                return;
            }
            if (child instanceof THREE.Mesh && child.geometry) {
                meshes.push(child);
            }
        });

        for (const mesh of meshes) {
            const edges = this.getOrCreateSelectionEdgesGeometry(mesh.geometry, this.edgeThresholdDeg);
            const lineSegments = new THREE.LineSegments(edges, edgeMaterial);
            lineSegments.renderOrder = 1000;
            mesh.add(lineSegments);
        }

        const instanceMatrix = new THREE.Matrix4();
        for (const instancedMesh of instancedMeshes) {
            const edges = this.getOrCreateSelectionEdgesGeometry(
                instancedMesh.geometry,
                this.edgeThresholdDeg
            );
            for (let instanceIndex = 0; instanceIndex < instancedMesh.count; instanceIndex++) {
                instancedMesh.getMatrixAt(instanceIndex, instanceMatrix);
                const lineSegments = new THREE.LineSegments(edges, edgeMaterial);
                lineSegments.renderOrder = 1000;
                lineSegments.matrixAutoUpdate = false;
                lineSegments.matrix.copy(instanceMatrix);
                instancedMesh.add(lineSegments);
            }
        }
    }

    dispose(): void {
        for (const geometry of this.edgeCacheRaw.values()) {
            geometry.dispose();
        }
        this.edgeCacheRaw.clear();
    }

    private getOrCreateSelectionEdgesGeometry(
        sourceGeometry: THREE.BufferGeometry,
        thresholdDeg: number
    ): THREE.EdgesGeometry {
        const cached = this.edgeCacheRaw.get(sourceGeometry);
        if (cached) return cached;
        const edges = new THREE.EdgesGeometry(sourceGeometry, thresholdDeg);
        this.edgeCacheRaw.set(sourceGeometry, edges);
        return edges;
    }
}
