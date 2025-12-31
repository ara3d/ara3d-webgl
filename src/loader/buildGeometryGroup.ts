import * as THREE from 'three';
import { BimGeometry } from './bimGeometry';
import { BimGeometryIR, buildGeometryIR } from './bimGeometryIR';

type InstanceGroup = {
  meshIndex: number;
  materialIndex: number;
  instanceIndices: number[];
};

export function buildGeometry(ir: BimGeometryIR): THREE.Group 
{
  console.time("Building geometry")
  const root = new THREE.Group();
 
  const instanceGroups = groupInstances(ir.bim);
  console.log("Created %d instance groups", instanceGroups.length)

  const materialGroups = gatherSingleInstancesByMaterial(instanceGroups);
  console.log("Created %d material groups", Array.from(materialGroups.keys()).length);
  
  const instancedMeshes = createInstances(ir, instanceGroups);
  console.log("Created %d instanced meshes", instancedMeshes.length);
  
  const nonInstancedMeshes = createMergedAndSingleMeshes(ir, materialGroups); 
  console.log("Create %d merged meshes", nonInstancedMeshes.length);

  let polyCount = 0;
  for (const im of instancedMeshes)
  {
    polyCount += (im.geometry.index.count / 3) * im.count; 
    root.add(im);
  }

  for (const nim of nonInstancedMeshes)
  {
    polyCount += nim.geometry.index.count / 3; 
    root.add(nim);
  }

  console.log("Total polygon count = %d", polyCount);

  // Convert Z-Up to Y-Up 
  root.rotation.x = -Math.PI / 2;

  console.timeEnd("Building geometry");
  return root;
}

export function createMergedAndSingleMeshes(
  ir: BimGeometryIR, 
  materialGroups: Map<number, number[]>)
  : Array<THREE.Mesh>
{
  const identity = new THREE.Matrix4();
  const r: THREE.Mesh[] = [];
  
  for (const [materialIndex, entries] of materialGroups) 
  {
    if (!entries || entries.length === 0) 
      continue;

    const material = ir.materials[materialIndex];

    if (entries.length === 1) {
      const ii = entries[0];
      const meshIndex = ir.bim.InstanceMeshIndex[ii];
      const transformIndex = ir.bim.InstanceTransformIndex[ii];
      const geom = ir.geometries[meshIndex];
      const matrix = ir.transforms[transformIndex];
      const mesh = new THREE.Mesh(geom, material);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(matrix); 
      r.push(mesh);
      continue;
    }

    const geomsToMerge: THREE.BufferGeometry[] = [];

    for (const ii of entries) {
      const meshIndex = ir.bim.InstanceMeshIndex[ii];
      const transformIndex = ir.bim.InstanceTransformIndex[ii];
      const geom = ir.geometries[meshIndex];
      const matrix = ir.transforms[transformIndex];
      if (!matrix.equals(identity)) {
        geom.applyMatrix4(matrix);
      }
      geomsToMerge.push(geom);
    }

    const mergedGeometry = mergeGeometries(geomsToMerge);
    const mergedMesh = new THREE.Mesh(mergedGeometry, material);
    mergedMesh.name = `MergedStatic_Material_${materialIndex}`;
    r.push(mergedMesh);
  }

  return r;
}

export function mergeGeometries(
  geometries: Array<THREE.BufferGeometry>
): THREE.BufferGeometry 
{
  // First pass: count total vertices and indices
  let indexCount = 0;
  let posCount = 0;

  for (let i = 0, l = geometries.length; i < l; i++) {
    const geometry = geometries[i];
    const index = geometry.getIndex();
    const position = geometry.getAttribute('position');
    indexCount += index.count;
    posCount += position.count;
  }

  // Allocated data structures 
  const mergedPositions = new Float32Array(posCount * 3);
  const mergedIndices = new Uint32Array(indexCount);

  let indexOffset = 0;      
  let vertexOffset = 0;

  // Second pass: copy data
  for (let i = 0, l = geometries.length; i < l; i++) {
    const geometry = geometries[i];

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const indexAttr = geometry.getIndex() as THREE.BufferAttribute;

    const srcPosArray = posAttr.array as Float32Array;
    const srcIndexArray = indexAttr.array as Int32Array;

    const vertCount = posAttr.count;
    const idxCount = indexAttr.count;

    const posItemSize = posAttr.itemSize; // usually 3

    // --- Copy positions ---
    // We only copy the used segment (0..vertCount*itemSize)
    const srcPosLength = vertCount * posItemSize;
    const dstPosOffset = vertexOffset * posItemSize;
    mergedPositions.set(srcPosArray.subarray(0, srcPosLength), dstPosOffset);

    // --- Copy indices, with vertex offset ---
    for (let j = 0; j < idxCount; j++) {
      mergedIndices[indexOffset + j] = srcIndexArray[j] + vertexOffset;
    }

    vertexOffset += vertCount;
    indexOffset += idxCount;
  }

  // Build merged geometry
  const mergedGeom = new THREE.BufferGeometry();
  mergedGeom.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
  mergedGeom.setIndex(new THREE.BufferAttribute(mergedIndices, 1));
  return mergedGeom;
}

function groupInstances(bim: BimGeometry): Array<InstanceGroup>
{
  const instanceCount = bim.InstanceEntityIndex.length;
  const instanceGroupMap = new Map<string, InstanceGroup>();
  for (let ii = 0; ii < instanceCount; ii++) {
    const meshIndex = bim.InstanceMeshIndex[ii];
    const materialIndex = bim.InstanceMaterialIndex[ii];
    const key = `${meshIndex}|${materialIndex}`;
    let group = instanceGroupMap.get(key);
    if (!group) {
      group = { meshIndex, materialIndex, instanceIndices: [ii] };
      instanceGroupMap.set(key, group);
    }
    else {
      group.instanceIndices.push(ii);
    }
  }
  return Array.from(instanceGroupMap.values());
}

export function gatherSingleInstancesByMaterial(instanceGroups: Array<InstanceGroup>)
  : Map<number, number[]>
{
  const r = new Map<number, number[]>();
  for (const group of instanceGroups) {
    const { materialIndex, instanceIndices } = group;
    if (instanceIndices.length === 1) {
      const ei = instanceIndices[0];
      let list = r.get(materialIndex);
      if (!list) {
        list = [];
        r.set(materialIndex, list);
      }
      list.push(ei);
    }
  }
  return r;
}


export function createInstances(
  ir: BimGeometryIR, 
  instanceGroups: Array<InstanceGroup>
)
    : Array<THREE.InstancedMesh>
{
  const r = new Array<THREE.InstancedMesh>();
  for (const group of instanceGroups) {
    const { meshIndex, materialIndex, instanceIndices } = group;
    const count = instanceIndices.length;
   
    if (count <= 1)
      continue;

    const geom = ir.geometries[meshIndex];
    const material = ir.materials[materialIndex];
 
    const instanced = new THREE.InstancedMesh(geom, material, count);
    instanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    for (let i = 0; i < count; i++) {
      const ei = instanceIndices[i];
      const ti = ir.bim.InstanceTransformIndex[ei];
      instanced.setMatrixAt(i, ir.transforms[ti]);
    }

    (instanced.userData as any).meshIndex = meshIndex;
    (instanced.userData as any).materialIndex = materialIndex;
    instanced.frustumCulled = false;
    instanced.matrixAutoUpdate = false;
    instanced.matrixWorldNeedsUpdate = false;
    r.push(instanced);
  }
  return r;
}