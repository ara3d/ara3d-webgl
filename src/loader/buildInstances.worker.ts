import * as THREE from 'three';
import { BimGeometry } from './bimGeometry';

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

const workerScope = self as unknown as {
    postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

function transferBuffersFromGeometry(bg: BimGeometry): ArrayBuffer[] {
    return [
        bg.InstanceEntityIndex.buffer,
        bg.InstanceMaterialIndex.buffer,
        bg.InstanceMeshIndex.buffer,
        bg.InstanceTransformIndex.buffer,
        bg.InstanceFlags.buffer,
        bg.VertexX.buffer,
        bg.VertexY.buffer,
        bg.VertexZ.buffer,
        bg.IndexBuffer.buffer,
        bg.MeshVertexOffset.buffer,
        bg.MeshIndexOffset.buffer,
        bg.MaterialRed.buffer,
        bg.MaterialGreen.buffer,
        bg.MaterialBlue.buffer,
        bg.MaterialAlpha.buffer,
        bg.MaterialRoughness.buffer,
        bg.MaterialMetallic.buffer,
        bg.TransformTX.buffer,
        bg.TransformTY.buffer,
        bg.TransformTZ.buffer,
        bg.TransformQX.buffer,
        bg.TransformQY.buffer,
        bg.TransformQZ.buffer,
        bg.TransformQW.buffer,
        bg.TransformSX.buffer,
        bg.TransformSY.buffer,
        bg.TransformSZ.buffer
    ];
}

function computeTransformsPacked(bg: BimGeometry): {
    matrices: Float32Array;
    identityFlags: Uint8Array;
} {
    const transformCount = bg.TransformTX.length;
    const matrices = new Float32Array(transformCount * 16);
    const identityFlags = new Uint8Array(transformCount);
    const tmpPos = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3();
    const tmpM = new THREE.Matrix4();
    const identity = new THREE.Matrix4();

    for (let ti = 0; ti < transformCount; ti++) {
        tmpPos.set(bg.TransformTX[ti], bg.TransformTY[ti], bg.TransformTZ[ti]);
        tmpQuat.set(bg.TransformQX[ti], bg.TransformQY[ti], bg.TransformQZ[ti], bg.TransformQW[ti]);
        tmpScale.set(bg.TransformSX[ti], bg.TransformSY[ti], bg.TransformSZ[ti]);
        tmpM.compose(tmpPos, tmpQuat, tmpScale);
        matrices.set(tmpM.elements, ti * 16);
        identityFlags[ti] = tmpM.equals(identity) ? 1 : 0;
    }

    return { matrices, identityFlags };
}

function computeMeshPositionsAndNormals(bg: BimGeometry): {
    meshPositions: Array<Float32Array | null>;
    meshNormals: Array<Float32Array | null>;
} {
    const meshCount = bg.MeshVertexOffset.length;
    const indexCount = bg.IndexBuffer.length;
    const vertexCount = bg.VertexX.length;
    const meshPositions: Array<Float32Array | null> = new Array(meshCount).fill(null);
    const meshNormals: Array<Float32Array | null> = new Array(meshCount).fill(null);
    const vertexMultiplier = 10_000.0;

    for (let mi = 0; mi < meshCount; mi++) {
        const iStart = bg.MeshIndexOffset[mi];
        const iEnd = mi + 1 < meshCount ? bg.MeshIndexOffset[mi + 1] : indexCount;
        const iCount = iEnd - iStart;

        const vStart = bg.MeshVertexOffset[mi];
        const vEnd = mi + 1 < meshCount ? bg.MeshVertexOffset[mi + 1] : vertexCount;
        const vCount = vEnd - vStart;
        if (iCount === 0 || vCount === 0) continue;

        const positionArray = new Float32Array(vCount * 3);
        for (let vi = 0; vi < vCount; vi++) {
            positionArray[vi * 3 + 0] = bg.VertexX[vi + vStart] / vertexMultiplier;
            positionArray[vi * 3 + 1] = bg.VertexY[vi + vStart] / vertexMultiplier;
            positionArray[vi * 3 + 2] = bg.VertexZ[vi + vStart] / vertexMultiplier;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
        geometry.setIndex(new THREE.BufferAttribute(bg.IndexBuffer.subarray(iStart, iEnd), 1));
        geometry.computeVertexNormals();
        const normalAttr = geometry.getAttribute('normal') as THREE.BufferAttribute;
        const normals = new Float32Array(normalAttr.array as Float32Array);
        meshPositions[mi] = positionArray;
        meshNormals[mi] = normals;
    }

    return { meshPositions, meshNormals };
}

self.onmessage = (event: MessageEvent<BuildInstancesWorkerRequest>) => {
    const request = event.data;
    if (!request || request.type !== 'build') return;

    try {
        const { geometry } = request;
        const { meshPositions, meshNormals } = computeMeshPositionsAndNormals(geometry);
        const { matrices, identityFlags } = computeTransformsPacked(geometry);

        const transfers: ArrayBuffer[] = [
            ...transferBuffersFromGeometry(geometry),
            matrices.buffer,
            identityFlags.buffer
        ];
        for (const p of meshPositions) {
            if (p) transfers.push(p.buffer);
        }
        for (const n of meshNormals) {
            if (n) transfers.push(n.buffer);
        }

        const message: BuildInstancesWorkerResult = {
            id: request.id,
            type: 'done',
            payload: {
                geometry,
                meshPositions,
                meshNormals,
                transformMatrices: matrices,
                transformIdentity: identityFlags
            }
        };
        workerScope.postMessage(message, transfers);
    } catch (error) {
        const asError = error as Error;
        const message: BuildInstancesWorkerError = {
            id: request.id,
            type: 'error',
            message: asError.message || 'buildInstances worker failed',
            stack: asError.stack
        };
        workerScope.postMessage(message);
    }
};

