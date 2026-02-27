import JSZip from 'jszip';
import { parquetRead, parquetMetadataAsync, ColumnData } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import BimOpenSchemaWorker from './bimOpenSchema.worker?worker&inline';
import { BimGeometry } from './bimGeometry';
import { buildGeometry } from './buildGeometryGroup';
import { buildInstances } from './buildInstances';
import { BimData } from './bimData';
import { BimEntities } from './bimEntities';
import { BimQuery } from './bimQuery';
import { BimParameterDescriptors } from './BimParameterDescriptors';
import { BimParameterTable } from './BimParameterTable';

export type BimLoaderOptions = {
    loadParameters: boolean;
};

type TableData = Record<string, unknown>;

type BosWorkerLoadRequest = {
    id: number;
    type: 'load';
    source: string;
    workerTag: string;
    tables: string[];
};

type BosWorkerProgressMessage = {
    id: number;
    type: 'progress';
    label: string;
    durationMs: number;
};

type BosWorkerDoneMessage = {
    id: number;
    type: 'done';
    payload: BosTablesPayload;
};

type BosWorkerErrorMessage = {
    id: number;
    type: 'error';
    message: string;
    stack?: string;
};

type BosWorkerMessage =
    | BosWorkerProgressMessage
    | BosWorkerDoneMessage
    | BosWorkerErrorMessage;

type BosTablesPayload = Record<string, TableData>;

type TypedArrayCtor =
    | Int32ArrayConstructor
    | Uint32ArrayConstructor
    | Uint8ArrayConstructor
    | Float32ArrayConstructor;

type PendingWorkerRequest = {
    resolve: (payload: BosTablesPayload) => void;
    reject: (error: Error) => void;
};

type BosWorkerClientLike = {
    load(source: string, tables: string[]): Promise<BosTablesPayload>;
};

type BosWorkerClients = {
    vertex: BosWorkerClientLike;
    index: BosWorkerClientLike;
    others: BosWorkerClientLike;
};

const REQUIRED_GEOMETRY_TABLES = [
    'Instances',
    'VertexBuffer',
    'IndexBuffer',
    'Meshes',
    'Materials',
    'Transforms'
] as const;

const VERTEX_TABLES = ['VertexBuffer'];
const INDEX_TABLES = ['IndexBuffer'];
const OTHER_TABLES_BASE = ['Instances', 'Meshes', 'Materials', 'Transforms', 'Entities', 'Strings'];
const PARAMETER_TABLES = [
    'Descriptors',
    'IntegerParameters',
    'SingleParameters',
    'StringParameters',
    'EntityParameters',
    'PointParameters'
];

class BimOpenSchemaWorkerClient {
    private readonly worker: Worker;
    private readonly workerTag: string;
    private readonly pending = new Map<number, PendingWorkerRequest>();
    private nextRequestId = 1;

    constructor(workerTag: string) {
        this.workerTag = workerTag;
        this.worker = new BimOpenSchemaWorker();
        this.worker.onmessage = (event: MessageEvent<BosWorkerMessage>) => {
            const message = event.data;
            const pendingRequest = this.pending.get(message.id);
            if (!pendingRequest) return;

            if (message.type === 'progress') {
                console.debug(`[BOS worker] ${message.label}: ${message.durationMs} ms`);
                return;
            }

            if (message.type === 'done') {
                this.pending.delete(message.id);
                pendingRequest.resolve(message.payload);
                return;
            }

            this.pending.delete(message.id);
            pendingRequest.reject(new Error(message.message));
        };
        this.worker.onerror = (event: ErrorEvent) => {
            for (const request of this.pending.values()) {
                request.reject(new Error(event.message || 'BOS worker crashed'));
            }
            this.pending.clear();
        };
    }

    load(source: string, tables: string[]): Promise<BosTablesPayload> {
        const id = this.nextRequestId++;
        const message: BosWorkerLoadRequest = {
            id,
            type: 'load',
            source,
            workerTag: this.workerTag,
            tables
        };

        return new Promise<BosTablesPayload>((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.worker.postMessage(message);
        });
    }
}

let workerClients: BosWorkerClients | null = null;
let workerClientsOverride: BosWorkerClients | null = null;

function getWorkerClients(): BosWorkerClients {
    if (workerClientsOverride) {
        return workerClientsOverride;
    }
    if (!workerClients) {
        workerClients = {
            vertex: new BimOpenSchemaWorkerClient('vertex'),
            index: new BimOpenSchemaWorkerClient('index'),
            others: new BimOpenSchemaWorkerClient('others')
        };
    }
    return workerClients;
}

function materializeBimData(payload: BosTablesPayload): BimData {
    const bimData = new BimData();

    const geometry: TableData = {};
    for (const tableName of REQUIRED_GEOMETRY_TABLES) {
        const table = payload[tableName];
        if (!table) {
            throw new Error(`Missing required table "${tableName}" from worker payload.`);
        }
        Object.assign(geometry, table);
    }
    bimData.BimGeometry = geometry as unknown as BimGeometry;

    if (payload.Entities) {
        bimData.Entities = payload.Entities as unknown as BimEntities;
    }
    const stringsValue = payload.Strings?.Strings;
    if (Array.isArray(stringsValue)) {
        bimData.Strings = stringsValue as string[];
    }
    if (payload.Descriptors) {
        bimData.Descriptors = payload.Descriptors as unknown as BimParameterDescriptors;
    }
    if (payload.IntegerParameters) {
        bimData.IntegerParameters = payload.IntegerParameters as unknown as BimParameterTable;
    }
    if (payload.SingleParameters) {
        bimData.SingleParameters = payload.SingleParameters as unknown as BimParameterTable;
    }
    if (payload.StringParameters) {
        bimData.StringParameters = payload.StringParameters as unknown as BimParameterTable;
    }
    if (payload.EntityParameters) {
        bimData.EntityParameters = payload.EntityParameters as unknown as BimParameterTable;
    }
    if (payload.PointParameters) {
        bimData.PointParameters = payload.PointParameters as unknown as BimParameterTable;
    }

    return bimData;
}

function buildOtherTables(options: BimLoaderOptions): string[] {
    const tables = [...OTHER_TABLES_BASE];
    if (options?.loadParameters) {
        tables.push(...PARAMETER_TABLES);
    }
    return tables;
}

function mergePayloads(payloads: BosTablesPayload[]): BosTablesPayload {
    return payloads.reduce((acc, payload) => {
        Object.assign(acc, payload);
        return acc;
    }, {} as BosTablesPayload);
}

function findFileEndingWith(zip: JSZip, suffix: string): string {
    const lowerSuffix = suffix.toLowerCase();
    const name = Object.keys(zip.files).find((entryName) =>
        entryName.toLowerCase().endsWith(lowerSuffix)
    );
    if (!name) {
        throw new Error(`Could not find "${suffix}" in zip archive.`);
    }
    return name;
}

async function readParquetTableFromZip(
    zip: JSZip,
    tableName: string,
    target: TableData,
    ctor: TypedArrayCtor | null,
    optional = false
): Promise<void> {
    let entryName: string | undefined;
    try {
        entryName = findFileEndingWith(zip, tableName + '.parquet');
    } catch (error) {
        if (optional) return;
        throw error;
    }

    if (!entryName) {
        if (optional) return;
        throw new Error(`Could not find "${tableName}.parquet" in zip archive.`);
    }

    const zipTimer = `Getting zip table ${entryName}`;
    console.time(zipTimer);
    const file = await zip.files[entryName].async('arraybuffer');
    console.timeEnd(zipTimer);

    const parquetTimer = `Getting parquet data ${entryName}`;
    console.time(parquetTimer);
    const metadata = await parquetMetadataAsync(file);
    if (Number(metadata.num_rows) === 0) {
        for (const schemaElement of metadata.schema) {
            if (schemaElement.name && schemaElement.type !== undefined) {
                target[schemaElement.name] = ctor ? new ctor(0) : [];
            }
        }
        console.timeEnd(parquetTimer);
        return;
    }

    await parquetRead({
        file,
        compressors,
        metadata,
        onChunk(chunk: ColumnData) {
            let data = chunk.columnData;
            const firstValue = data?.length ? (data as ArrayLike<unknown>)[0] : undefined;
            const isBigIntArray = typeof firstValue === 'bigint';
            if (ctor && data && data.constructor.name !== ctor.name && !isBigIntArray) {
                data = new ctor(data as ArrayLike<number>);
            }
            target[chunk.columnName] = data;
        }
    });
    console.timeEnd(parquetTimer);
}

async function loadBimDataFromZipMainThread(zip: JSZip, options: BimLoaderOptions): Promise<BimData> {
    const bd = new BimData();
    const bg: TableData = {};

    await readParquetTableFromZip(zip, 'Instances', bg, Int32Array);
    await readParquetTableFromZip(zip, 'VertexBuffer', bg, Int32Array);
    await readParquetTableFromZip(zip, 'IndexBuffer', bg, Uint32Array);
    await readParquetTableFromZip(zip, 'Meshes', bg, Int32Array);
    await readParquetTableFromZip(zip, 'Materials', bg, Uint8Array);
    await readParquetTableFromZip(zip, 'Transforms', bg, Float32Array);
    bd.BimGeometry = bg as unknown as BimGeometry;

    const entities: TableData = {};
    await readParquetTableFromZip(zip, 'Entities', entities, Int32Array, true);
    if (Object.keys(entities).length > 0) {
        bd.Entities = entities as unknown as BimEntities;
    }

    const stringsTable: TableData = {};
    await readParquetTableFromZip(zip, 'Strings', stringsTable, null, true);
    const stringsValue = stringsTable.Strings;
    if (Array.isArray(stringsValue)) {
        bd.Strings = stringsValue as string[];
    }

    if (options?.loadParameters) {
        const descriptors: TableData = {};
        await readParquetTableFromZip(zip, 'Descriptors', descriptors, Int32Array);
        bd.Descriptors = descriptors as unknown as BimParameterDescriptors;

        const integerParameters: TableData = {};
        await readParquetTableFromZip(zip, 'IntegerParameters', integerParameters, Int32Array);
        bd.IntegerParameters = integerParameters as unknown as BimParameterTable;

        const singleParameters: TableData = {};
        await readParquetTableFromZip(zip, 'SingleParameters', singleParameters, Int32Array);
        bd.SingleParameters = singleParameters as unknown as BimParameterTable;

        const stringParameters: TableData = {};
        await readParquetTableFromZip(zip, 'StringParameters', stringParameters, Int32Array);
        bd.StringParameters = stringParameters as unknown as BimParameterTable;

        const entityParameters: TableData = {};
        await readParquetTableFromZip(zip, 'EntityParameters', entityParameters, Int32Array);
        bd.EntityParameters = entityParameters as unknown as BimParameterTable;

        const pointParameters: TableData = {};
        await readParquetTableFromZip(zip, 'PointParameters', pointParameters, Int32Array);
        bd.PointParameters = pointParameters as unknown as BimParameterTable;
    }

    return bd;
}

async function loadBimDataFromSourceMainThread(source: string, options: BimLoaderOptions): Promise<BimData> {
    const response = await fetch(source);
    if (!response.ok) {
        throw new Error(
            `Failed to fetch BOS from ${source}: ${response.status} ${response.statusText}`
        );
    }
    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    return loadBimDataFromZipMainThread(zip, options);
}

function finalizeBimData(bimData: BimData): BimData {
    bimData.Instances = buildInstances(bimData.BimGeometry);
    bimData.Query = new BimQuery(bimData);
    bimData.Resolver = bimData.Query.Resolver;
    bimData.ThreeGeometry = buildGeometry(bimData.Instances);
    return bimData;
}

/**
 * Loader that takes a URL to a .ZIP or .BOS file containing BIM Open Schema geometry parquet tables:
 */
export class BimOpenSchemaLoader {
    async load(source: string, options: BimLoaderOptions): Promise<BimData> {
        const totalTimer = `[BOS loader] total geometry load ${source}`;
        console.time(totalTimer);
        try {
            const clients = getWorkerClients();
            const [vertexPayload, indexPayload, othersPayload] = await Promise.all([
                clients.vertex.load(source, VERTEX_TABLES),
                clients.index.load(source, INDEX_TABLES),
                clients.others.load(source, buildOtherTables(options))
            ]);
            const payload = mergePayloads([vertexPayload, indexPayload, othersPayload]);
            return finalizeBimData(materializeBimData(payload));
        } finally {
            console.timeEnd(totalTimer);
        }
    }
}

/**
 * Reads the BOS parquet tables from a JSZip archive into a BimGeometry object.
 */
export async function loadBimGeometryFromZip(zip: JSZip, options: BimLoaderOptions): Promise<BimData> {
    return loadBimDataFromZipMainThread(zip, options);
}

// Test hooks for verifying worker/fallback flow without browser workers/parquet fixtures.
export function __setWorkerClientsForTests(clients: BosWorkerClients | null): void {
    workerClientsOverride = clients;
}
