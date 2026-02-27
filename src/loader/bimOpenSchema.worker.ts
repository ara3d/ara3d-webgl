import JSZip from 'jszip';
import { parquetRead, parquetMetadataAsync, ColumnData } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

type TableData = Record<string, unknown>;

type BosWorkerLoadRequest = {
    id: number;
    type: 'load';
    source: string;
    workerTag: string;
    tables: string[];
};

type BosTablesPayload = Record<string, TableData>;

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

type TypedArrayCtor =
    | Int32ArrayConstructor
    | Uint32ArrayConstructor
    | Uint8ArrayConstructor
    | Float32ArrayConstructor;

const REQUIRED_GEOMETRY_TABLES: Array<[string, TypedArrayCtor | null]> = [
    ['Instances', Int32Array],
    ['VertexBuffer', Int32Array],
    ['IndexBuffer', Uint32Array],
    ['Meshes', Int32Array],
    ['Materials', Uint8Array],
    ['Transforms', Float32Array]
];

const OPTIONAL_TABLE_CONFIG = new Map<string, TypedArrayCtor | null>([
    ['Entities', Int32Array],
    ['Strings', null],
    ['Descriptors', Int32Array],
    ['IntegerParameters', Int32Array],
    ['SingleParameters', Int32Array],
    ['StringParameters', Int32Array],
    ['EntityParameters', Int32Array],
    ['PointParameters', Int32Array]
]);

const TABLE_CONFIG = new Map<string, TypedArrayCtor | null>([
    ...REQUIRED_GEOMETRY_TABLES,
    ...OPTIONAL_TABLE_CONFIG
]);

async function getZipFromSource(source: string): Promise<JSZip> {
    const response = await fetch(source);
    if (!response.ok) {
        throw new Error(
            `Failed to fetch BOS from ${source}: ${response.status} ${response.statusText}`
        );
    }
    const arrayBuffer = await response.arrayBuffer();
    return JSZip.loadAsync(arrayBuffer);
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

function maybeConvertColumn(
    data: ColumnData['columnData'],
    ctor: TypedArrayCtor | null
): ColumnData['columnData'] {
    if (!ctor || !data) {
        return data;
    }

    // Hyparquet can return INT64 as bigint[]; these cannot be converted to numeric typed arrays.
    const firstValue = data.length ? (data as ArrayLike<unknown>)[0] : undefined;
    const isBigIntArray = typeof firstValue === 'bigint';
    if (isBigIntArray) {
        return data;
    }

    if (data.constructor.name !== ctor.name) {
        return new ctor(data as ArrayLike<number>);
    }
    return data;
}

async function readParquetTable(
    zip: JSZip,
    tableName: string,
    ctor: TypedArrayCtor | null,
    optional: boolean,
    requestId: number,
    workerTag: string
): Promise<TableData | undefined> {
    let entryName: string | undefined;
    try {
        entryName = findFileEndingWith(zip, tableName + '.parquet');
    } catch (error) {
        if (optional) return undefined;
        throw error;
    }

    if (!entryName) {
        if (optional) return undefined;
        throw new Error(`Could not find "${tableName}.parquet" in zip archive.`);
    }

    const zipStart = performance.now();
    const file = await zip.files[entryName].async('arraybuffer');
    const zipDuration = performance.now() - zipStart;
    const zipProgress: BosWorkerProgressMessage = {
        id: requestId,
        type: 'progress',
        label: `[${workerTag}] Getting zip table ${entryName}`,
        durationMs: zipDuration
    };
    workerScope.postMessage(zipProgress);

    const parquetStart = performance.now();
    const metadata = await parquetMetadataAsync(file);
    const table: TableData = {};

    if (Number(metadata.num_rows) === 0) {
        for (const schemaElement of metadata.schema) {
            if (schemaElement.name && schemaElement.type !== undefined) {
                table[schemaElement.name] = ctor ? new ctor(0) : [];
            }
        }
        return table;
    }

    await parquetRead({
        file,
        compressors,
        metadata,
        onChunk(chunk: ColumnData) {
            const normalized = maybeConvertColumn(chunk.columnData, ctor);
            table[chunk.columnName] = normalized;
        }
    });
    const parquetDuration = performance.now() - parquetStart;
    const parquetProgress: BosWorkerProgressMessage = {
        id: requestId,
        type: 'progress',
        label: `[${workerTag}] Getting parquet data ${entryName}`,
        durationMs: parquetDuration
    };
    workerScope.postMessage(parquetProgress);
    return table;
}

function collectTransfersFromTable(table: TableData | undefined, transfers: ArrayBuffer[]): void {
    if (!table) return;
    for (const value of Object.values(table)) {
        if (ArrayBuffer.isView(value)) {
            transfers.push(value.buffer as ArrayBuffer);
        }
    }
}

function collectTransfers(payload: BosTablesPayload): ArrayBuffer[] {
    const transfers: ArrayBuffer[] = [];
    for (const table of Object.values(payload)) {
        collectTransfersFromTable(table, transfers);
    }
    return transfers;
}

async function loadBosTables(request: BosWorkerLoadRequest): Promise<BosTablesPayload> {
    const { source, id, workerTag, tables } = request;
    const zip = await getZipFromSource(source);
    const payload: BosTablesPayload = {};
    const requiredTables = new Set(REQUIRED_GEOMETRY_TABLES.map(([name]) => name));

    for (const tableName of tables) {
        const ctor = TABLE_CONFIG.get(tableName);
        if (ctor === undefined) {
            throw new Error(`Unknown table "${tableName}" requested.`);
        }
        const table = await readParquetTable(
            zip,
            tableName,
            ctor,
            !requiredTables.has(tableName),
            id,
            workerTag
        );
        if (table) {
            payload[tableName] = table;
        }
    }

    return payload;
}

self.onmessage = async (event: MessageEvent<BosWorkerLoadRequest>) => {
    const request = event.data;
    if (!request || request.type !== 'load') return;

    try {
        const payload = await loadBosTables(request);
        const message: BosWorkerDoneMessage = {
            id: request.id,
            type: 'done',
            payload
        };
        workerScope.postMessage(message, collectTransfers(payload));
    } catch (error) {
        const asError = error as Error;
        const errorMessage: BosWorkerErrorMessage = {
            id: request.id,
            type: 'error',
            message: asError.message || 'Unknown BOS worker error',
            stack: asError.stack
        };
        workerScope.postMessage(errorMessage);
    }
};
