import * as THREE from 'three';
import { BimGeometry } from './bimGeometry';
import { EntityIndex, InstanceIndex } from './bimData';

// Instance data contained in the BIM Geometry
export type Instance = {
    isIdentity: boolean;
    instance: InstanceIndex;
    entity: EntityIndex;
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    transform: THREE.Matrix4;
};

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
            transform,
            entity,
            isIdentity
        };
    }
    console.timeEnd("Building instances");
    return instances;
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
