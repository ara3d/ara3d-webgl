import JSZip from 'jszip';
import { parquetRead, parquetMetadataAsync, ColumnData } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import type { BimLoaderOptions } from './bimOpenSchemaLoader';

type TableData = Record<string, unknown>;

type BosWorkerLoadRequest = {
    id: number;
    type: 'load';
    source: string;
    options: BimLoaderOptions;
};

type BosTablesPayload = {
    geometry: TableData;
    entities?: TableData;
    strings?: string[];
    descriptors?: TableData;
    integerParameters?: TableData;
    singleParameters?: TableData;
    stringParameters?: TableData;
    entityParameters?: TableData;
    pointParameters?: TableData;
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
    requestId: number
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
        label: `Getting zip table ${entryName}`,
        durationMs: zipDuration
    };
    self.postMessage(zipProgress);

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
        label: `Getting parquet data ${entryName}`,
        durationMs: parquetDuration
    };
    self.postMessage(parquetProgress);
    return table;
}

function collectTransfersFromTable(table: TableData | undefined, transfers: ArrayBuffer[]): void {
    if (!table) return;
    for (const value of Object.values(table)) {
        if (ArrayBuffer.isView(value)) {
            transfers.push(value.buffer);
        }
    }
}

function collectTransfers(payload: BosTablesPayload): ArrayBuffer[] {
    const transfers: ArrayBuffer[] = [];
    collectTransfersFromTable(payload.geometry, transfers);
    collectTransfersFromTable(payload.entities, transfers);
    collectTransfersFromTable(payload.descriptors, transfers);
    collectTransfersFromTable(payload.integerParameters, transfers);
    collectTransfersFromTable(payload.singleParameters, transfers);
    collectTransfersFromTable(payload.stringParameters, transfers);
    collectTransfersFromTable(payload.entityParameters, transfers);
    collectTransfersFromTable(payload.pointParameters, transfers);
    return transfers;
}

async function loadBosTables(source: string, options: BimLoaderOptions, requestId: number): Promise<BosTablesPayload> {
    const zip = await getZipFromSource(source);
    const geometry: TableData = {};

    for (const [tableName, ctor] of REQUIRED_GEOMETRY_TABLES) {
        const table = await readParquetTable(zip, tableName, ctor, false, requestId);
        if (!table) {
            throw new Error(`Missing required table "${tableName}".`);
        }
        Object.assign(geometry, table);
    }

    const entities = await readParquetTable(zip, 'Entities', Int32Array, true, requestId);
    const stringsTable = await readParquetTable(zip, 'Strings', null, true, requestId);
    const stringsValue = stringsTable?.Strings;

    let descriptors: TableData | undefined;
    let integerParameters: TableData | undefined;
    let singleParameters: TableData | undefined;
    let stringParameters: TableData | undefined;
    let entityParameters: TableData | undefined;
    let pointParameters: TableData | undefined;

    if (options?.loadParameters) {
        descriptors = await readParquetTable(zip, 'Descriptors', Int32Array, false, requestId);
        integerParameters = await readParquetTable(zip, 'IntegerParameters', Int32Array, false, requestId);
        singleParameters = await readParquetTable(zip, 'SingleParameters', Int32Array, false, requestId);
        stringParameters = await readParquetTable(zip, 'StringParameters', Int32Array, false, requestId);
        entityParameters = await readParquetTable(zip, 'EntityParameters', Int32Array, false, requestId);
        pointParameters = await readParquetTable(zip, 'PointParameters', Int32Array, false, requestId);
    }

    return {
        geometry,
        entities,
        strings: Array.isArray(stringsValue) ? (stringsValue as string[]) : undefined,
        descriptors,
        integerParameters,
        singleParameters,
        stringParameters,
        entityParameters,
        pointParameters
    };
}

self.onmessage = async (event: MessageEvent<BosWorkerLoadRequest>) => {
    const request = event.data;
    if (!request || request.type !== 'load') return;

    try {
        const payload = await loadBosTables(request.source, request.options, request.id);
        const message: BosWorkerDoneMessage = {
            id: request.id,
            type: 'done',
            payload
        };
        self.postMessage(message, collectTransfers(payload));
    } catch (error) {
        const asError = error as Error;
        const errorMessage: BosWorkerErrorMessage = {
            id: request.id,
            type: 'error',
            message: asError.message || 'Unknown BOS worker error',
            stack: asError.stack
        };
        self.postMessage(errorMessage);
    }
};
