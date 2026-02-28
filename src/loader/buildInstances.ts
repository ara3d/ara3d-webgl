import * as THREE from 'three';
import { BimGeometry } from './bimGeometry';
import { EntityIndex, InstanceIndex } from './bimData';
import BuildInstancesWorker from './buildInstances.worker?worker&inline';

// Instance data contained in the BIM Geometry
export type Instance = {
    isIdentity: boolean;
    instance: InstanceIndex;
    entity: EntityIndex;
    materialId: number;
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    transform: THREE.Matrix4;
};

type BuildInstancesWorkerRequest = {
    id: number;
    type: 'build';
    geometry: BimGeometry;
};

type BuildInstancesWorkerResult = {
    id: number;
    type: 'done';
    payload: {
        geometry: BimGeometry;
        meshPositions: Array<Float32Array | null>;
        meshNormals: Array<Float32Array | null>;
        transformMatrices: Float32Array;
        transformIdentity: Uint8Array;
    };
};

type BuildInstancesWorkerError = {
    id: number;
    type: 'error';
    message: string;
    stack?: string;
};

type BuildInstancesWorkerMessage = BuildInstancesWorkerResult | BuildInstancesWorkerError;

type PendingBuildRequest = {
    resolve: (payload: BuildInstancesWorkerResult['payload']) => void;
    reject: (error: Error) => void;
};

class BuildInstancesWorkerClient {
    private readonly worker: Worker;
    private readonly pending = new Map<number, PendingBuildRequest>();
    private nextRequestId = 1;

    constructor() {
        this.worker = new BuildInstancesWorker();
        this.worker.onmessage = (event: MessageEvent<BuildInstancesWorkerMessage>) => {
            const message = event.data;
            const pending = this.pending.get(message.id);
            if (!pending) return;
            this.pending.delete(message.id);
            if (message.type === 'done') {
                pending.resolve(message.payload);
                return;
            }
            pending.reject(new Error(message.message));
        };
        this.worker.onerror = (event: ErrorEvent) => {
            for (const pending of this.pending.values()) {
                pending.reject(new Error(event.message || 'buildInstances worker crashed'));
            }
            this.pending.clear();
        };
    }

    build(geometry: BimGeometry): Promise<BuildInstancesWorkerResult['payload']> {
        const id = this.nextRequestId++;
        const message: BuildInstancesWorkerRequest = {
            id,
            type: 'build',
            geometry
        };
        const transfers = [
            geometry.InstanceEntityIndex.buffer,
            geometry.InstanceMaterialIndex.buffer,
            geometry.InstanceMeshIndex.buffer,
            geometry.InstanceTransformIndex.buffer,
            geometry.InstanceFlags.buffer,
            geometry.VertexX.buffer,
            geometry.VertexY.buffer,
            geometry.VertexZ.buffer,
            geometry.IndexBuffer.buffer,
            geometry.MeshVertexOffset.buffer,
            geometry.MeshIndexOffset.buffer,
            geometry.MaterialRed.buffer,
            geometry.MaterialGreen.buffer,
            geometry.MaterialBlue.buffer,
            geometry.MaterialAlpha.buffer,
            geometry.MaterialRoughness.buffer,
            geometry.MaterialMetallic.buffer,
            geometry.TransformTX.buffer,
            geometry.TransformTY.buffer,
            geometry.TransformTZ.buffer,
            geometry.TransformQX.buffer,
            geometry.TransformQY.buffer,
            geometry.TransformQZ.buffer,
            geometry.TransformQW.buffer,
            geometry.TransformSX.buffer,
            geometry.TransformSY.buffer,
            geometry.TransformSZ.buffer
        ];
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.worker.postMessage(message, transfers);
        });
    }

    dispose(): void {
        for (const pending of this.pending.values()) {
            pending.reject(new Error('buildInstances worker disposed'));
        }
        this.pending.clear();
        this.worker.terminate();
    }
}

let buildInstancesWorkerClient: BuildInstancesWorkerClient | null = null;

function getBuildInstancesWorkerClient(): BuildInstancesWorkerClient {
    if (!buildInstancesWorkerClient) {
        buildInstancesWorkerClient = new BuildInstancesWorkerClient();
    }
    return buildInstancesWorkerClient;
}

export function disposeBuildInstancesWorkerClient(): void {
    if (!buildInstancesWorkerClient) return;
    buildInstancesWorkerClient.dispose();
    buildInstancesWorkerClient = null;
}

export function buildInstances(bg: BimGeometry): Array<Instance | undefined> {
    console.time("Building instances");
    const transforms = computeTransforms(bg);
    const geometries = computeMeshGeometries(bg);
    const materials = computeMaterials(bg);
    const instanceCount = bg.InstanceMeshIndex.length;
    const instances = new Array<Instance | undefined>(instanceCount);
    const identity = new THREE.Matrix4;
    for (let i = 0; i < instanceCount; i++) {        
        const meshIndex = bg.InstanceMeshIndex[i];        
        if (meshIndex < 0) continue;

        const flag = bg.InstanceFlags[i];

        // Check if the "hidden" flag is set. 
        if (flag & 0x1) continue;

        const geometry = geometries[meshIndex];
        
        // Skip instances with missing geometry (meshes with 0 vertices/indices)
        if (!geometry) continue;
        
        const material = materials[bg.InstanceMaterialIndex[i]];
        const transform = transforms[bg.InstanceTransformIndex[i]];
        const entity = bg.InstanceEntityIndex[i] as EntityIndex;
        const isIdentity = transform.equals(identity);
        
        instances[i] = {
            instance: i as InstanceIndex,
            geometry,
            material,
            materialId: bg.InstanceMaterialIndex[i],
            transform,
            entity,
            isIdentity
        };
    }
    console.timeEnd("Building instances");
    return instances;
}

export async function buildInstancesAsync(
    bg: BimGeometry,
    mode: 'sync' | 'worker' = 'sync'
): Promise<Array<Instance | undefined>> {
    // Backward-compatible wrapper. In worker mode this consumes/transfers `bg` buffers.
    return buildInstancesAsyncConsumeGeometry(bg, mode);
}

/**
 * Builds instances asynchronously. In `'worker'` mode the input geometry buffers are transferred
 * to the worker and therefore detached on the caller side.
 */
export async function buildInstancesAsyncConsumeGeometry(
    bg: BimGeometry,
    mode: 'sync' | 'worker' = 'sync'
): Promise<Array<Instance | undefined>> {
    if (typeof Worker === 'undefined') return buildInstances(bg);
    if (mode !== 'worker') return buildInstances(bg);
    const payload = await getBuildInstancesWorkerClient().build(bg);
    return buildInstancesFromPrecomputed(
        payload.geometry,
        payload.meshPositions,
        payload.meshNormals,
        payload.transformMatrices,
        payload.transformIdentity
    );
}

function computeMeshGeometries(bim: BimGeometry)
    : Array<THREE.BufferGeometry> 
{
    const meshCount = bim.MeshVertexOffset.length;
    const indexCount = bim.IndexBuffer.length;
    const vertexCount = bim.VertexX.length;
    const meshGeometries: Array<THREE.BufferGeometry> = new Array(meshCount);

    const {
        VertexX,
        VertexY,
        VertexZ,
        IndexBuffer,
        MeshVertexOffset,
        MeshIndexOffset,
    } = bim;

    for (let mi = 0; mi < meshCount; mi++) {
        const iStart = MeshIndexOffset[mi];
        const iEnd = mi + 1 < meshCount ? MeshIndexOffset[mi + 1] : indexCount;
        const iCount = iEnd - iStart;

        const vStart = MeshVertexOffset[mi];
        const vEnd = mi + 1 < meshCount ? MeshVertexOffset[mi + 1] : vertexCount;
        const vCount = vEnd - vStart;

        if (iCount === 0 || vCount === 0) continue;

        const indexArray = IndexBuffer.subarray(iStart, iEnd);

        const vertexMultiplier = 10_000.0;
        const positionArray = new Float32Array(vCount * 3);
        for (let vi = 0; vi < vCount; vi++) {
            positionArray[vi * 3 + 0] = VertexX[vi + vStart] / vertexMultiplier;
            positionArray[vi * 3 + 1] = VertexY[vi + vStart] / vertexMultiplier;
            positionArray[vi * 3 + 2] = VertexZ[vi + vStart] / vertexMultiplier;
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
        geom.setIndex(new THREE.BufferAttribute(indexArray, 1));
        // Compute normals once per source mesh. The view-state bucket builder can then
        // transform/copy these normals instead of recomputing on the giant merged geometry.
        geom.computeVertexNormals();
        meshGeometries[mi] = geom;
    }

    return meshGeometries;
}

function computeMeshGeometriesFromPrecomputed(
    bim: BimGeometry,
    meshPositions: Array<Float32Array | null>,
    meshNormals: Array<Float32Array | null>
): Array<THREE.BufferGeometry> {
    const meshCount = bim.MeshVertexOffset.length;
    const indexCount = bim.IndexBuffer.length;
    const meshGeometries: Array<THREE.BufferGeometry> = new Array(meshCount);

    for (let mi = 0; mi < meshCount; mi++) {
        const pos = meshPositions[mi];
        const normal = meshNormals[mi];
        if (!pos || !normal) continue;
        const iStart = bim.MeshIndexOffset[mi];
        const iEnd = mi + 1 < meshCount ? bim.MeshIndexOffset[mi + 1] : indexCount;
        const indexArray = bim.IndexBuffer.subarray(iStart, iEnd);
        if (indexArray.length === 0) continue;
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geom.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
        geom.setIndex(new THREE.BufferAttribute(indexArray, 1));
        meshGeometries[mi] = geom;
    }

    return meshGeometries;
}

function computeMaterials(bim: BimGeometry)
    : Array<THREE.MeshStandardMaterial> 
{
    const numMaterials = bim.MaterialAlpha.length;
    const materials = new Array<THREE.MeshStandardMaterial>(numMaterials);

    for (let mi = 0; mi < numMaterials; mi++) {
        const r = bim.MaterialRed[mi] / 255;
        const g = bim.MaterialGreen[mi] / 255;
        const b = bim.MaterialBlue[mi] / 255;
        const a = bim.MaterialAlpha[mi] / 255;
        const roughness = bim.MaterialRoughness[mi] / 255;  
        const metalness = bim.MaterialMetallic[mi] / 255;

        const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(r, g, b),
            opacity: a,
            flatShading: true,
            transparent: a < 0.999,
            roughness,
            metalness,
            side: THREE.DoubleSide,
        });
        (mat as any).Id = mi;

        materials[mi] = mat;
    }
    return materials;
}

export function computeTransforms(bim: BimGeometry)
    : Array<THREE.Matrix4> 
{
    const {
        TransformTX,
        TransformTY,
        TransformTZ,
        TransformQX,
        TransformQY,
        TransformQZ,
        TransformQW,
        TransformSX,
        TransformSY,
        TransformSZ,
    } = bim;

    const tmpPos = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3();
    const transformCount = TransformTX.length;

    const matrices = new Array<THREE.Matrix4>(transformCount);

    for (let ti = 0; ti < transformCount; ti++) {
        const tx = TransformTX[ti];
        const ty = TransformTY[ti];
        const tz = TransformTZ[ti];
        const sx = TransformSX[ti];
        const sy = TransformSY[ti];
        const sz = TransformSZ[ti];
        const qx = TransformQX[ti];
        const qy = TransformQY[ti];
        const qz = TransformQZ[ti];
        const qw = TransformQW[ti];

        const m = new THREE.Matrix4();
        tmpPos.set(tx, ty, tz);
        tmpQuat.set(qx, qy, qz, qw);
        tmpScale.set(sx, sy, sz);
        m.compose(tmpPos, tmpQuat, tmpScale);

        matrices[ti] = m;
    }
    return matrices;
}

function computeTransformsFromPacked(
    matrices: Float32Array,
    identityFlags: Uint8Array
): {
    transforms: Array<THREE.Matrix4>;
    identityByIndex: Uint8Array;
} {
    const transformCount = identityFlags.length;
    const transforms = new Array<THREE.Matrix4>(transformCount);
    for (let ti = 0; ti < transformCount; ti++) {
        const offset = ti * 16;
        const m = new THREE.Matrix4();
        m.fromArray(matrices, offset);
        transforms[ti] = m;
    }
    return { transforms, identityByIndex: identityFlags };
}

function buildInstancesFromPrecomputed(
    bg: BimGeometry,
    meshPositions: Array<Float32Array | null>,
    meshNormals: Array<Float32Array | null>,
    transformMatrices: Float32Array,
    transformIdentity: Uint8Array
): Array<Instance | undefined> {
    console.time("Building instances");
    const { transforms, identityByIndex } = computeTransformsFromPacked(
        transformMatrices,
        transformIdentity
    );
    const geometries = computeMeshGeometriesFromPrecomputed(bg, meshPositions, meshNormals);
    const materials = computeMaterials(bg);
    const instanceCount = bg.InstanceMeshIndex.length;
    const instances = new Array<Instance | undefined>(instanceCount);
    for (let i = 0; i < instanceCount; i++) {
        const meshIndex = bg.InstanceMeshIndex[i];
        if (meshIndex < 0) continue;
        const flag = bg.InstanceFlags[i];
        if (flag & 0x1) continue;
        const geometry = geometries[meshIndex];
        if (!geometry) continue;
        const material = materials[bg.InstanceMaterialIndex[i]];
        const transformIndex = bg.InstanceTransformIndex[i];
        const transform = transforms[transformIndex];
        const entity = bg.InstanceEntityIndex[i] as EntityIndex;

        instances[i] = {
            instance: i as InstanceIndex,
            geometry,
            material,
            materialId: bg.InstanceMaterialIndex[i],
            transform,
            entity,
            isIdentity: identityByIndex[transformIndex] === 1
        };
    }
    console.timeEnd("Building instances");
    return instances;
}
