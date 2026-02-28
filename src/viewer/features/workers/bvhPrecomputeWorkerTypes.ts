export type BvhIndexArray = Uint16Array | Uint32Array | Int32Array;

export type BvhPrecomputeBuildMessage = {
    type: 'build';
    taskId: number;
    generation: number;
    position: Float32Array;
    index: BvhIndexArray;
};

export type BvhPrecomputeMainToWorkerMessage = BvhPrecomputeBuildMessage;

export type BvhPrecomputeBuiltMessage = {
    type: 'built';
    taskId: number;
    generation: number;
    serialized: unknown;
    buildDurationMs: number;
};

export type BvhPrecomputeErrorMessage = {
    type: 'error';
    taskId: number;
    generation: number;
    message: string;
    stack?: string;
};

export type BvhPrecomputeWorkerToMainMessage =
    | BvhPrecomputeBuiltMessage
    | BvhPrecomputeErrorMessage;
