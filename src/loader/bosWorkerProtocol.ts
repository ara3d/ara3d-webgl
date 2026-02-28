export type TableData = Record<string, unknown>;

export type BosTablesPayload = Record<string, TableData>;

export type TypedArrayCtor =
    | Int32ArrayConstructor
    | Uint32ArrayConstructor
    | Uint8ArrayConstructor
    | Float32ArrayConstructor;

export type BosWorkerDecodeRequest = {
    id: number;
    type: 'decode';
    workerTag: string;
    files: Record<string, ArrayBuffer>;
};

export type BosWorkerProgressMessage = {
    id: number;
    type: 'progress';
    label: string;
    durationMs: number;
};

export type BosWorkerDoneMessage = {
    id: number;
    type: 'done';
    payload: BosTablesPayload;
};

export type BosWorkerErrorMessage = {
    id: number;
    type: 'error';
    message: string;
    stack?: string;
};

export type BosWorkerMessage =
    | BosWorkerProgressMessage
    | BosWorkerDoneMessage
    | BosWorkerErrorMessage;

export type BosZipWorkerLoadRequest = {
    id: number;
    type: 'zip-load';
    source: string;
    tables: string[];
};

export type BosZipWorkerProgressMessage = {
    id: number;
    type: 'progress';
    label: string;
    durationMs: number;
};

export type BosZipWorkerDoneMessage = {
    id: number;
    type: 'done';
    payload: Record<string, ArrayBuffer>;
};

export type BosZipWorkerErrorMessage = {
    id: number;
    type: 'error';
    message: string;
    stack?: string;
};

export type BosZipWorkerMessage =
    | BosZipWorkerDoneMessage
    | BosZipWorkerProgressMessage
    | BosZipWorkerErrorMessage;

export const REQUIRED_GEOMETRY_TABLES = [
    'Instances',
    'VertexBuffer',
    'IndexBuffer',
    'Meshes',
    'Materials',
    'Transforms'
] as const;

export const VERTEX_TABLES = ['VertexBuffer'] as const;
export const INDEX_TABLES = ['IndexBuffer'] as const;
export const OTHER_TABLES_BASE = [
    'Instances',
    'Meshes',
    'Materials',
    'Transforms',
    'Entities',
    'Strings'
] as const;

export const PARAMETER_TABLES = [
    'Descriptors',
    'IntegerParameters',
    'SingleParameters',
    'StringParameters',
    'EntityParameters',
    'PointParameters'
] as const;

export const BOS_TABLE_CONFIG = new Map<string, TypedArrayCtor | null>([
    ['Instances', Int32Array],
    ['VertexBuffer', Int32Array],
    ['IndexBuffer', Uint32Array],
    ['Meshes', Int32Array],
    ['Materials', Uint8Array],
    ['Transforms', Float32Array],
    ['Entities', Int32Array],
    ['Strings', null],
    ['Descriptors', Int32Array],
    ['IntegerParameters', Int32Array],
    ['SingleParameters', Int32Array],
    ['StringParameters', Int32Array],
    ['EntityParameters', Int32Array],
    ['PointParameters', Int32Array]
]);
