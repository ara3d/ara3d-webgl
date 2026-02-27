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

type MergeRequest = {
    id: number;
    type: 'merge';
    tasks: MergeTask[];
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

const workerScope = self as unknown as {
    postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

function transformPositionInPlace(
    matrix: Float32Array,
    x: number,
    y: number,
    z: number
): [number, number, number] {
    const tx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    const ty = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    const tz = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
    return [tx, ty, tz];
}

function mergeTask(task: MergeTask): MergeTaskResult {
    let indexCount = 0;
    let vertexCount = 0;
    for (const instance of task.instances) {
        indexCount += instance.indices.length;
        vertexCount += instance.positions.length / 3;
    }

    const mergedPositions = new Float32Array(vertexCount * 3);
    const mergedIndices = new Uint32Array(indexCount);
    const triToInstanceIndex = new Uint32Array(indexCount / 3);

    let indexOffset = 0;
    let vertexOffset = 0;

    for (const instance of task.instances) {
        const srcPositions = instance.positions;
        const srcIndices = instance.indices;
        const srcVertexCount = srcPositions.length / 3;

        if (instance.isIdentity) {
            mergedPositions.set(srcPositions, vertexOffset * 3);
        } else {
            for (let v = 0; v < srcVertexCount; v++) {
                const base = v * 3;
                const [x, y, z] = transformPositionInPlace(
                    instance.transform,
                    srcPositions[base],
                    srcPositions[base + 1],
                    srcPositions[base + 2]
                );
                const outBase = vertexOffset * 3 + base;
                mergedPositions[outBase] = x;
                mergedPositions[outBase + 1] = y;
                mergedPositions[outBase + 2] = z;
            }
        }

        for (let i = 0; i < srcIndices.length; i++) {
            mergedIndices[indexOffset + i] = srcIndices[i] + vertexOffset;
        }

        const triStart = indexOffset / 3;
        const triCount = srcIndices.length / 3;
        for (let tri = 0; tri < triCount; tri++) {
            triToInstanceIndex[triStart + tri] = instance.instanceIndex;
        }

        vertexOffset += srcVertexCount;
        indexOffset += srcIndices.length;
    }

    return {
        taskId: task.taskId,
        mergedPositions,
        mergedIndices,
        triToInstanceIndex
    };
}

function collectTransfers(results: MergeTaskResult[]): ArrayBuffer[] {
    const transfers: ArrayBuffer[] = [];
    for (const result of results) {
        transfers.push(result.mergedPositions.buffer as ArrayBuffer);
        transfers.push(result.mergedIndices.buffer as ArrayBuffer);
        transfers.push(result.triToInstanceIndex.buffer as ArrayBuffer);
    }
    return transfers;
}

self.onmessage = (event: MessageEvent<MergeRequest>) => {
    const request = event.data;
    if (!request || request.type !== 'merge') return;

    try {
        const results = request.tasks.map(mergeTask);
        const response: MergeResponse = {
            id: request.id,
            type: 'done',
            results
        };
        workerScope.postMessage(response, collectTransfers(results));
    } catch (error) {
        const asError = error as Error;
        const response: MergeErrorResponse = {
            id: request.id,
            type: 'error',
            message: asError.message || 'Unknown merge worker error',
            stack: asError.stack
        };
        workerScope.postMessage(response);
    }
};
