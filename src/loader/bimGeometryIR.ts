import * as THREE from 'three';
import { BimGeometry } from './bimGeometry';

export type BimGeometryIR = 
{
    bim: BimGeometry;
    transforms: THREE.Matrix4[];
    geometries: THREE.BufferGeometry[];
    materials: THREE.Material[];
};

export function buildGeometryIR(bim: BimGeometry): BimGeometryIR
{
    const vertexCount = bim.VertexX.length;
    const indexCount = bim.IndexBuffer.length;
    const meshCount = bim.MeshVertexOffset.length;
    const materialCount = bim.MaterialRed.length;
    const instanceCount = bim.InstanceMeshIndex.length;
    const transformCount = bim.TransformTX.length;

    console.log({ vertexCount, indexCount, meshCount, materialCount, instanceCount, transformCount });

    const transforms = computeTransforms(bim);
    const geometries = computeMeshGeometries(bim);
    const materials = computeMaterials(bim);

    return { bim, transforms, geometries, materials };
}

function computeMeshGeometries(bim: BimGeometry): Array<THREE.BufferGeometry>
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

  for (let mi = 0; mi < meshCount; mi++) 
  {
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
      positionArray[vi*3+0] = VertexX[vi + vStart] / vertexMultiplier;
      positionArray[vi*3+1] = VertexY[vi + vStart] / vertexMultiplier;
      positionArray[vi*3+2] = VertexZ[vi + vStart] / vertexMultiplier;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
    geom.setIndex(new THREE.BufferAttribute(indexArray, 1));
    meshGeometries[mi] = geom;
  }

  return meshGeometries;
}

function computeMaterials(bim: BimGeometry): Array<THREE.MeshStandardMaterial>
{
  const numMaterials = bim.MaterialAlpha.length;
  const materials = new Array<THREE.MeshStandardMaterial>(numMaterials);

  for (let mi=0; mi < numMaterials; mi++)
  {
    const r = bim.MaterialRed[mi] / 255;
    const g = bim.MaterialGreen[mi] / 255;
    const b = bim.MaterialBlue[mi] / 255;
    const a = bim.MaterialAlpha[mi]  / 255;
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

export function computeTransforms(bim: BimGeometry): Array<THREE.Matrix4>
{
  const {
    TransformTX, TransformTY, TransformTZ,
    TransformQX, TransformQY, TransformQZ, TransformQW,
    TransformSX, TransformSY, TransformSZ,
  } = bim;

  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const transformCount = TransformTX.length;
    
  const matrices = new Array<THREE.Matrix4>(transformCount);
  
  for (let ti = 0; ti < transformCount; ti++) 
  {
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