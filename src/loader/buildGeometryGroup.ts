import * as THREE from 'three';
import { Instance } from './buildInstances';
import { perfDuration, perfLongTask, perfNow } from '../perf/perf';
import BuildGeometryMergeWorker from './buildGeometryMerge.worker?worker&inline';

type GroupedInstances = Map<THREE.Material, Map<THREE.BufferGeometry, Instance[]>>;

type InstanceMaterialGroup = {
    material: THREE.Material;
    instances: Array<Instance>;
};

type MergeTaskInstance = {
    instanceIndex: number;
    isIdentity: boolean;
    transform: Float32Array;
    positions: Float32Array;
    indices: Uint32Array;
};

type MergeTask = {
    taskId: number;
    instances: MergeTaskInstance[];
};

type MergeTaskResult = {
    taskId: number;
    mergedPositions: Float32Array;
    mergedIndices: Uint32Array;
    triToInstanceIndex: Uint32Array;
};

type MergeResponse = {
    id: number;
    type: 'done';
    results: MergeTaskResult[];
};

type MergeErrorResponse = {
    id: number;
    type: 'error';
    message: string;
    stack?: string;
};

type MergeWorkerMessage = MergeResponse | MergeErrorResponse;

type PendingMergeRequest = {
    resolve: (results: MergeTaskResult[]) => void;
    reject: (error: Error) => void;
};

function collectTaskTransfers(tasks: MergeTask[]): Transferable[] {
    const transfers: Transferable[] = [];
    for (const task of tasks) {
        for (const instance of task.instances) {
            transfers.push(instance.transform.buffer);
            transfers.push(instance.positions.buffer);
            transfers.push(instance.indices.buffer);
        }
    }
    return transfers;
}

class BuildGeometryMergeWorkerClient {
    private readonly worker: Worker;
    private readonly pending = new Map<number, PendingMergeRequest>();
    private nextRequestId = 1;

    constructor() {
        this.worker = new BuildGeometryMergeWorker();
        this.worker.onmessage = (event: MessageEvent<MergeWorkerMessage>) => {
            const message = event.data;
            const pending = this.pending.get(message.id);
            if (!pending) return;

            this.pending.delete(message.id);
            if (message.type === 'done') {
                pending.resolve(message.results);
                return;
            }
            pending.reject(new Error(message.message));
        };
        this.worker.onerror = (event: ErrorEvent) => {
            for (const pending of this.pending.values()) {
                pending.reject(new Error(event.message || 'buildGeometry merge worker crashed'));
            }
            this.pending.clear();
        };
    }

    merge(tasks: MergeTask[]): Promise<MergeTaskResult[]> {
        if (tasks.length === 0) return Promise.resolve([]);
        const id = this.nextRequestId++;
        const transfers = collectTaskTransfers(tasks);
        return new Promise<MergeTaskResult[]>((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.worker.postMessage({
                id,
                type: 'merge',
                tasks
            }, transfers);
        });
    }

    dispose(): void {
        for (const pending of this.pending.values()) {
            pending.reject(new Error('buildGeometry merge worker disposed'));
        }
        this.pending.clear();
        this.worker.terminate();
    }
}

let mergeWorkerClient: BuildGeometryMergeWorkerClient | null = null;

function getMergeWorkerClient(): BuildGeometryMergeWorkerClient {
    if (!mergeWorkerClient) {
        mergeWorkerClient = new BuildGeometryMergeWorkerClient();
    }
    return mergeWorkerClient;
}

export function disposeMergeWorkerClient(): void {
    if (!mergeWorkerClient) return;
    mergeWorkerClient.dispose();
    mergeWorkerClient = null;
}

export function buildGeometry(instances: Array<Instance | undefined>): THREE.Group {
    const startedAt = perfNow();
    const groupingStartedAt = perfNow();
    const root = new THREE.Group();

    const instanceGroups = groupInstances(instances);
    const groupingDurationMs = perfDuration(
        'buildGeometry.groupInstances',
        groupingStartedAt
    );
    const gatherStartedAt = perfNow();
    const materialGroups = gatherSingleInstancesByMaterial(instanceGroups);
    const gatherDurationMs = perfDuration(
        'buildGeometry.gatherSingleInstancesByMaterial',
        gatherStartedAt
    );
    const instancedStartedAt = perfNow();
    const instancedMeshes = createInstancedMeshes(instanceGroups);
    const instancedDurationMs = perfDuration(
        'buildGeometry.createInstancedMeshes',
        instancedStartedAt,
        { instancedCount: instancedMeshes.length }
    );
    const mergedStartedAt = perfNow();
    const nonInstancedMeshes = createMergedAndSingleMeshes(materialGroups);
    const mergedDurationMs = perfDuration(
        'buildGeometry.createMergedAndSingleMeshes',
        mergedStartedAt,
        { nonInstancedCount: nonInstancedMeshes.length }
    );

    let polyCount = 0;
    for (const im of instancedMeshes) {
        polyCount += (im.geometry.index.count / 3) * im.count;
        root.add(im);
    }

    for (const nim of nonInstancedMeshes) {
        polyCount += nim.geometry.index.count / 3;
        root.add(nim);
    }

    // Convert Z-Up to Y-Up (for BOS geometry)
    root.rotation.x = -Math.PI / 2;

    const durationMs = perfDuration('buildGeometry.total', startedAt, {
        sourceInstanceCount: instances.length,
        groupedMaterialCount: instanceGroups.size,
        materialGroupCount: materialGroups.length,
        instancedMeshCount: instancedMeshes.length,
        nonInstancedMeshCount: nonInstancedMeshes.length,
        polyCount,
        groupingDurationMs,
        gatherDurationMs,
        instancedDurationMs,
        mergedDurationMs
    });
    perfLongTask('buildGeometry.longTask', startedAt, 50, {
        sourceInstanceCount: instances.length,
        polyCount,
        durationMs
    });
    return root;
}

export async function buildGeometryAsync(instances: Array<Instance | undefined>): Promise<THREE.Group> {
    const startedAt = perfNow();
    const groupingStartedAt = perfNow();
    const root = new THREE.Group();

    const instanceGroups = groupInstances(instances);
    const groupingDurationMs = perfDuration('buildGeometry.groupInstances', groupingStartedAt);
    const gatherStartedAt = perfNow();
    const materialGroups = gatherSingleInstancesByMaterial(instanceGroups);
    const gatherDurationMs = perfDuration(
        'buildGeometry.gatherSingleInstancesByMaterial',
        gatherStartedAt
    );
    const instancedStartedAt = perfNow();
    const instancedMeshes = createInstancedMeshes(instanceGroups);
    const instancedDurationMs = perfDuration('buildGeometry.createInstancedMeshes', instancedStartedAt, {
        instancedCount: instancedMeshes.length
    });
    const mergedStartedAt = perfNow();
    const nonInstancedMeshes = await createMergedAndSingleMeshesAsync(materialGroups);
    const mergedDurationMs = perfDuration('buildGeometry.createMergedAndSingleMeshes', mergedStartedAt, {
        nonInstancedCount: nonInstancedMeshes.length
    });

    let polyCount = 0;
    for (const im of instancedMeshes) {
        polyCount += (im.geometry.index.count / 3) * im.count;
        root.add(im);
    }

    for (const nim of nonInstancedMeshes) {
        polyCount += nim.geometry.index.count / 3;
        root.add(nim);
    }

    root.rotation.x = -Math.PI / 2;

    const durationMs = perfDuration('buildGeometry.total', startedAt, {
        sourceInstanceCount: instances.length,
        groupedMaterialCount: instanceGroups.size,
        materialGroupCount: materialGroups.length,
        instancedMeshCount: instancedMeshes.length,
        nonInstancedMeshCount: nonInstancedMeshes.length,
        polyCount,
        groupingDurationMs,
        gatherDurationMs,
        instancedDurationMs,
        mergedDurationMs
    });
    perfLongTask('buildGeometry.longTask', startedAt, 50, {
        sourceInstanceCount: instances.length,
        polyCount,
        durationMs
    });
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
            // Attach pick metadata for single mesh
            mesh.userData.pick = {
                kind: 'single',
                instanceIndex: i.instance
            };
            r.push(mesh);
            continue;
        }

        const geomsToMerge: THREE.BufferGeometry[] = [];
        const instanceIndices: number[] = [];

        for (const i of materialGroup.instances) {
            // IMPORTANT: i.geometry is shared across instances/rebuilds, so never mutate it.
            // Clone before applying transforms to avoid corrupting the original geometry.
            const geom = i.isIdentity ? i.geometry : i.geometry.clone().applyMatrix4(i.transform);
            geomsToMerge.push(geom);
            instanceIndices.push(i.instance);
        }

        const { geometry: mergedGeometry, triToInstanceIndex } = mergeGeometries(geomsToMerge);
        const mergedMesh = new THREE.Mesh(mergedGeometry, material);
        mergedMesh.name = `MergedStatic_Material_${material.Id}`;
        // Attach pick metadata for merged mesh
        // Map triangle index to instance index, then use instanceIndices array to get actual InstanceIndex
        const triToInstanceIndexMap = new Uint32Array(triToInstanceIndex.length);
        for (let i = 0; i < triToInstanceIndex.length; i++) {
            triToInstanceIndexMap[i] = instanceIndices[triToInstanceIndex[i]];
        }
        mergedMesh.userData.pick = {
            kind: 'merged',
            triToInstanceIndex: triToInstanceIndexMap
        };
        r.push(mergedMesh);
    }

    return r;
}

export async function createMergedAndSingleMeshesAsync(
    materialGroups: Array<InstanceMaterialGroup>
): Promise<Array<THREE.Mesh>> {
    const result: THREE.Mesh[] = [];
    const mergeTasks: MergeTask[] = [];
    const mergeTaskMaterialById = new Map<number, THREE.Material>();
    let taskId = 0;

    for (const materialGroup of materialGroups) {
        const n = materialGroup.instances.length;
        if (n === 0) continue;

        if (n === 1) {
            const i = materialGroup.instances[0];
            const mesh = new THREE.Mesh(i.geometry, i.material);
            mesh.matrixAutoUpdate = false;
            mesh.matrix.copy(i.transform);
            mesh.userData.pick = {
                kind: 'single',
                instanceIndex: i.instance
            };
            result.push(mesh);
            continue;
        }

        const taskInstances: MergeTaskInstance[] = [];
        for (const instance of materialGroup.instances) {
            const posAttr = instance.geometry.getAttribute('position') as THREE.BufferAttribute;
            const indexAttr = instance.geometry.getIndex() as THREE.BufferAttribute;
            if (!posAttr || !indexAttr) continue;

            taskInstances.push({
                instanceIndex: instance.instance,
                isIdentity: instance.isIdentity,
                transform: new Float32Array(instance.transform.elements),
                positions: new Float32Array((posAttr.array as Float32Array).slice()),
                indices: new Uint32Array((indexAttr.array as Uint32Array).slice())
            });
        }

        if (taskInstances.length < 2) {
            for (const instance of materialGroup.instances) {
                const mesh = new THREE.Mesh(instance.geometry, instance.material);
                mesh.matrixAutoUpdate = false;
                mesh.matrix.copy(instance.transform);
                mesh.userData.pick = {
                    kind: 'single',
                    instanceIndex: instance.instance
                };
                result.push(mesh);
            }
            continue;
        }

        mergeTaskMaterialById.set(taskId, materialGroup.material);
        mergeTasks.push({
            taskId,
            instances: taskInstances
        });
        taskId++;
    }

    const mergedResults = await getMergeWorkerClient().merge(mergeTasks);
    for (const merged of mergedResults) {
        const material = mergeTaskMaterialById.get(merged.taskId);
        if (!material) continue;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(merged.mergedPositions, 3));
        geometry.setIndex(new THREE.BufferAttribute(merged.mergedIndices, 1));

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `MergedStatic_Material_${(material as any).Id ?? 'unknown'}`;
        mesh.userData.pick = {
            kind: 'merged',
            triToInstanceIndex: merged.triToInstanceIndex
        };
        result.push(mesh);
    }

    return result;
}

export function mergeGeometries(geometries: Array<THREE.BufferGeometry>)
    : { geometry: THREE.BufferGeometry; triToInstanceIndex: Uint32Array }
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
    // Map triangle index (faceIndex) to instance index
    const triToInstanceIndex = new Uint32Array(indexCount / 3);

    let indexOffset = 0;
    let vertexOffset = 0;

    // Second pass: copy data and build triangle-to-instance mapping
    for (let i = 0, l = geometries.length; i < l; i++) {
        const geometry = geometries[i];

        const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
        const indexAttr = geometry.getIndex() as THREE.BufferAttribute;

        const srcPosArray = posAttr.array as Float32Array;
        const srcIndexArray = indexAttr.array as Int32Array;

        const vertCount = posAttr.count;
        const idxCount = indexAttr.count;
        const posItemSize = posAttr.itemSize; 
        const triCount = idxCount / 3;

        const srcPosLength = vertCount * posItemSize;
        const dstPosOffset = vertexOffset * posItemSize;
        mergedPositions.set(
            srcPosArray.subarray(0, srcPosLength),
            dstPosOffset
        );

        for (let j = 0; j < idxCount; j++) 
            mergedIndices[indexOffset + j] = srcIndexArray[j] + vertexOffset;

        // Map each triangle in this instance to its instance index
        const triStart = indexOffset / 3;
        for (let triIdx = 0; triIdx < triCount; triIdx++) {
            triToInstanceIndex[triStart + triIdx] = i;
        }

        vertexOffset += vertCount;
        indexOffset += idxCount;
    }

    // Build merged geometry
    const mergedGeom = new THREE.BufferGeometry();
    mergedGeom.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
    mergedGeom.setIndex(new THREE.BufferAttribute(mergedIndices, 1));
    return { geometry: mergedGeom, triToInstanceIndex };
}

function groupInstances(instances: Array<Instance | undefined>): GroupedInstances {
  const groups: GroupedInstances = new Map();

  for (const inst of instances) {
    if (!inst) continue;
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

            // Build instanceId -> InstanceIndex mapping for pick metadata
            const instanceIndices = new Uint32Array(count);
            for (let i = 0; i < count; i++) {
                instanced.setMatrixAt(i, instances[i].transform);
                instanceIndices[i] = instances[i].instance;
            }

            instanced.frustumCulled = false;
            instanced.matrixAutoUpdate = false;
            instanced.matrixWorldNeedsUpdate = false;
            // Attach pick metadata for instanced mesh
            instanced.userData.pick = {
                kind: 'instanced',
                instanceIndices: instanceIndices
            };
            r.push(instanced);
        }
    }
    return r;
}
