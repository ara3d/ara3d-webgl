import * as THREE from 'three';
import { BimGeometry } from './bimGeometry';
import { BimGeometryIR, Instance } from './bimGeometryIR';

type MaterialIndex = number;
type MeshIndex = number;

type GroupedInstances = 
  Map<
    MaterialIndex, 
    Map<
      MeshIndex, 
      Array<Instance>>>;

type InstanceMaterialGroup =
{
    materialIndex: MaterialIndex;
    instances: Array<Instance>;
}

export function buildGeometry(ir: BimGeometryIR): THREE.Group 
{
  console.time("Building geometry")
  const root = new THREE.Group();
 
  const instanceGroups = groupInstances(ir);
  const materialGroups = gatherSingleInstancesByMaterial(instanceGroups);
  const instancedMeshes = createInstancedMeshes(ir, instanceGroups);
  const nonInstancedMeshes = createMergedAndSingleMeshes(ir, materialGroups); 

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
  materialGroups: Array<InstanceMaterialGroup>)
  : Array<THREE.Mesh>
{
  const identity = new THREE.Matrix4();
  const r: THREE.Mesh[] = [];
  
  for (const materialGroup of materialGroups) 
  {
    const n = materialGroup.instances.length; 
    if (n === 0) 
      continue;

    const materialIndex = materialGroup.materialIndex;
    const material = ir.materials[materialIndex];

    if (n === 1) {
      const i = materialGroup.instances[0];
      const geom = ir.geometries[i.meshIndex];
      const matrix = ir.transforms[i.transformIndex];
      const mesh = new THREE.Mesh(geom, material);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(matrix); 
      r.push(mesh);
      continue;
    }

    const geomsToMerge: THREE.BufferGeometry[] = [];

    for (const i of materialGroup.instances) {
      const geom = ir.geometries[i.meshIndex];
      const matrix = ir.transforms[i.transformIndex];
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

export function mergeGeometries(geometries: Array<THREE.BufferGeometry>)
  : THREE.BufferGeometry 
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

function groupInstances(ir: BimGeometryIR): GroupedInstances {
  const groups: GroupedInstances = new Map();

  for (const inst of ir.instances) {
    if (inst.meshIndex < 0) continue;

    let matGroup = groups.get(inst.materialIndex);
    if (!matGroup) {
      matGroup = new Map<MeshIndex, Array<Instance>>();
      groups.set(inst.materialIndex, matGroup);
    }

    let meshGroup = matGroup.get(inst.meshIndex);
    if (!meshGroup) {
      meshGroup = [];
      matGroup.set(inst.meshIndex, meshGroup);
    }

    meshGroup.push(inst);
  }

  return groups;
}

export function gatherSingleInstancesByMaterial(groups: GroupedInstances)
  : Array<InstanceMaterialGroup>
{
  const r = new Array<InstanceMaterialGroup>();
  for (const [materialIndex, meshGroups] of groups) 
  {
    let list = [];
    for (const [, instances] of meshGroups) 
    {
      if (instances.length != 1) continue;
      list.push(instances[0]);
    }
    if (list.length < 1)
        continue;
    r.push({ materialIndex, instances: list });
  }
  return r;
}

export function createInstancedMeshes(ir: BimGeometryIR,  instanceGroups: GroupedInstances)
    : Array<THREE.InstancedMesh>
{
  const r = new Array<THREE.InstancedMesh>();
  for (const [materialIndex, meshGroups] of instanceGroups) 
  {
    
    for (const [meshIndex, instances] of meshGroups)
    {
      const count = instances.length;
        
      if (count <= 1)
        continue;

      const geom = ir.geometries[meshIndex];
      const material = ir.materials[materialIndex];
  
      const instanced = new THREE.InstancedMesh(geom, material, count);
      instanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);

      for (let i = 0; i < count; i++) {
        instanced.setMatrixAt(i, ir.transforms[instances[i].transformIndex]);
      }

      (instanced.userData as any).meshIndex = meshIndex;
      (instanced.userData as any).materialIndex = materialIndex;
      instanced.frustumCulled = false;
      instanced.matrixAutoUpdate = false;
      instanced.matrixWorldNeedsUpdate = false;
      r.push(instanced);
    }
  }
  return r;
}