import JSZip from 'jszip';
import {
    BosZipWorkerDoneMessage,
    BosZipWorkerErrorMessage,
    BosZipWorkerLoadRequest as ZipWorkerLoadRequest,
    BosZipWorkerProgressMessage as ZipWorkerProgressMessage
} from './bosWorkerProtocol';

const workerScope = self as unknown as {
    postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

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

async function extractParquetBuffers(request: ZipWorkerLoadRequest): Promise<Record<string, ArrayBuffer>> {
    const { source, id, tables } = request;
    const zip = await getZipFromSource(source);
    const result: Record<string, ArrayBuffer> = {};

    for (const tableName of tables) {
        const entryName = findFileEndingWith(zip, `${tableName}.parquet`);
        const zipStart = performance.now();
        const file = await zip.files[entryName].async('arraybuffer');
        const zipDuration = performance.now() - zipStart;
        const progress: ZipWorkerProgressMessage = {
            id,
            type: 'progress',
            label: `[zip] Getting zip table ${entryName}`,
            durationMs: zipDuration
        };
        workerScope.postMessage(progress);
        result[tableName] = file;
    }

    return result;
}

function collectTransfers(payload: Record<string, ArrayBuffer>): ArrayBuffer[] {
    return Object.values(payload);
}

self.onmessage = async (event: MessageEvent<ZipWorkerLoadRequest>) => {
    const request = event.data;
    if (!request || request.type !== 'zip-load') return;

    try {
        const payload = await extractParquetBuffers(request);
        const message: ZipWorkerDoneMessage = {
            id: request.id,
            type: 'done',
            payload
        };
        workerScope.postMessage(message, collectTransfers(payload));
    } catch (error) {
        const asError = error as Error;
        const errorMessage: ZipWorkerErrorMessage = {
            id: request.id,
            type: 'error',
            message: asError.message || 'Unknown BOS zip worker error',
            stack: asError.stack
        };
        workerScope.postMessage(errorMessage);
    }
};
