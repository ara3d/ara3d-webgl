import { parquetRead, parquetMetadataAsync, ColumnData } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';

const workerScope = self as unknown as {
    postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

type TableData = Record<string, unknown>;

type BosWorkerDecodeRequest = {
    id: number;
    type: 'decode';
    workerTag: string;
    files: Record<string, ArrayBuffer>;
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

const TABLE_CONFIG = new Map<string, TypedArrayCtor | null>([
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
    tableName: string,
    file: ArrayBuffer,
    ctor: TypedArrayCtor | null,
    requestId: number,
    workerTag: string
): Promise<TableData> {
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
        label: `[${workerTag}] Getting parquet data ${tableName}.parquet`,
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

async function decodeBosTables(request: BosWorkerDecodeRequest): Promise<BosTablesPayload> {
    const { id, workerTag, files } = request;
    const payload: BosTablesPayload = {};
    for (const [tableName, file] of Object.entries(files)) {
        const ctor = TABLE_CONFIG.get(tableName);
        if (ctor === undefined) {
            throw new Error(`Unknown table "${tableName}" requested.`);
        }
        const table = await readParquetTable(tableName, file, ctor, id, workerTag);
        payload[tableName] = table;
    }

    return payload;
}

self.onmessage = async (event: MessageEvent<BosWorkerDecodeRequest>) => {
    const request = event.data;
    if (!request || request.type !== 'decode') return;

    try {
        const payload = await decodeBosTables(request);
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
