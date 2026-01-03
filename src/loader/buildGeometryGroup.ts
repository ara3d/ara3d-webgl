import * as THREE from 'three';
import { Instance } from './buildInstances';

type GroupedInstances = Map<THREE.Material, Map<THREE.BufferGeometry, Instance[]>>;

type InstanceMaterialGroup = {
    material: THREE.Material;
    instances: Array<Instance>;
};

export function buildGeometry(instances: Instance[]): THREE.Group {
    console.time('Building geometry');
    const root = new THREE.Group();

    const instanceGroups = groupInstances(instances);
    const materialGroups = gatherSingleInstancesByMaterial(instanceGroups);
    const instancedMeshes = createInstancedMeshes(instanceGroups);
    const nonInstancedMeshes = createMergedAndSingleMeshes(materialGroups);

    let polyCount = 0;
    for (const im of instancedMeshes) {
        polyCount += (im.geometry.index.count / 3) * im.count;
        root.add(im);
    }

    for (const nim of nonInstancedMeshes) {
        polyCount += nim.geometry.index.count / 3;
        root.add(nim);
    }

    // Convert Z-Up to Y-Up
    root.rotation.x = -Math.PI / 2;

    console.timeEnd('Building geometry');
    return root;
}

export function createMergedAndSingleMeshes(materialGroups: Array<InstanceMaterialGroup>)
    : Array<THREE.Mesh> 
{
    const r: THREE.Mesh[] = [];

    for (const materialGroup of materialGroups) 
    {
        const n = materialGroup.instances.length;
        if (n === 0) continue;

        const material = materialGroup.material;
        
        if (n === 1) {
            const i = materialGroup.instances[0];
            const mesh = new THREE.Mesh(i.geometry, i.material);
            mesh.matrixAutoUpdate = false;
            mesh.matrix.copy(i.transform);
            r.push(mesh);
            continue;
        }

        const geomsToMerge: THREE.BufferGeometry[] = [];

        for (const i of materialGroup.instances) {
            const geom = i.geometry;
            if (!i.isIdentity) {
                geom.applyMatrix4(i.transform);
                i.isIdentity = true;
            }
            geomsToMerge.push(geom);
        }

        const mergedGeometry = mergeGeometries(geomsToMerge);
        const mergedMesh = new THREE.Mesh(mergedGeometry, material);
        mergedMesh.name = `MergedStatic_Material_${material.Id}`;
        r.push(mergedMesh);
    }

    return r;
}

export function mergeGeometries(geometries: Array<THREE.BufferGeometry>)
    : THREE.BufferGeometry 
{
    let indexCount = 0;
    let posCount = 0;

    // First pass: gather counts
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
        const posItemSize = posAttr.itemSize; 

        const srcPosLength = vertCount * posItemSize;
        const dstPosOffset = vertexOffset * posItemSize;
        mergedPositions.set(
            srcPosArray.subarray(0, srcPosLength),
            dstPosOffset
        );

        for (let j = 0; j < idxCount; j++) 
            mergedIndices[indexOffset + j] = srcIndexArray[j] + vertexOffset;

        vertexOffset += vertCount;
        indexOffset += idxCount;
    }

    // Build merged geometry
    const mergedGeom = new THREE.BufferGeometry();
    mergedGeom.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
    mergedGeom.setIndex(new THREE.BufferAttribute(mergedIndices, 1));
    return mergedGeom;
}

function groupInstances(instances: Instance[]): GroupedInstances {
  const groups: GroupedInstances = new Map();

  for (const inst of instances) {
    let matGroup = groups.get(inst.material);
    if (!matGroup) {
      matGroup = new Map();
      groups.set(inst.material, matGroup);
    }

    let meshGroup = matGroup.get(inst.geometry);
    if (!meshGroup) {
      meshGroup = [];
      matGroup.set(inst.geometry, meshGroup);
    }

    meshGroup.push(inst);
  }

  return groups;
}

export function gatherSingleInstancesByMaterial(groups: GroupedInstances)
    : Array<InstanceMaterialGroup> 
{
    const r = new Array<InstanceMaterialGroup>();
    for (const [material, meshGroups] of groups) {
        let instances = [];
        for (const [, group] of meshGroups) {
            if (group.length != 1) continue;
            instances.push(group[0]);
        }
        if (instances.length < 1) continue;
        r.push({ material, instances });
    }
    return r;
}

export function createInstancedMeshes(instanceGroups: GroupedInstances)
    : Array<THREE.InstancedMesh> 
{
    const r = new Array<THREE.InstancedMesh>();
    for (const [material, meshGroups] of instanceGroups) 
    {
        for (const [geometry, instances] of meshGroups) 
        {
            const count = instances.length;

            if (count <= 1) 
                continue;

            const instanced = new THREE.InstancedMesh(geometry, material, count);
            instanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);

            for (let i = 0; i < count; i++) 
                instanced.setMatrixAt(i, instances[i].transform);

            instanced.frustumCulled = false;
            instanced.matrixAutoUpdate = false;
            instanced.matrixWorldNeedsUpdate = false;
            r.push(instanced);
        }
    }
    return r;
}
