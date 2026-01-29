import JSZip from 'jszip';
import {
    parquetRead,
    parquetMetadataAsync,
    parquetSchema,
    ColumnData,
    parquetReadObjects,
    ParquetReadOptions,
} from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import { BimGeometry } from './bimGeometry';
import { buildGeometry } from './buildGeometryGroup';
import { buildInstances } from './buildInstances';
import { BimData } from './bimData';
import { BimEntities } from './bimEntities';
import { BimQuery } from './bimQuery';
import { BimParameterDescriptors } from './BimParameterDescriptors';
import { BimParameterTable } from './BimParameterTable';

type BimLoaderOptions =
{
    loadParameters: boolean;
}

/**
 * Loader that takes a URL to a .ZIP or .BOS file containing BIM Open Schema geometry parquet tables:
 */
export class BimOpenSchemaLoader {
    async load(source: string, options: BimLoaderOptions): Promise<BimData> {
        const response = await fetch(source);
        if (!response.ok) {
            throw new Error(
                `Failed to fetch BOS from ${source}: ${response.status} ${response.statusText}`
            );
        }

        const arrayBuffer = await response.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const bimData = await loadBimGeometryFromZip(zip, options);
        bimData.Instances = buildInstances(bimData.BimGeometry);
        bimData.Query = new BimQuery(bimData);
        bimData.Resolver = bimData.Query.Resolver;
        bimData.ThreeGeometry = buildGeometry(bimData.Instances);
        return bimData;
    }
}

/**
 * Reads the BOS parquet tables from a JSZip archive into a BimGeometry object.
 */
export async function loadBimGeometryFromZip(zip: JSZip, options: BimLoaderOptions): Promise<BimData> {
    // Find the file in the zip archive
    function findFileEndingWith(suffix: string): string {
        const lowerSuffix = suffix.toLowerCase();
        const name = Object.keys(zip.files).find((n) =>
            n.toLowerCase().endsWith(lowerSuffix)
        );
        if (!name)
            throw new Error(`Could not find "${suffix}" in zip archive.`);
        return name;
    }

    // Read the table, and put the columns directly
    async function readParquetTable(
        name: string,
        r: any,
        ctor: any = undefined
    ) {
        const entryName = findFileEndingWith(name + '.parquet');
        const file = await zip.files[entryName].async('arraybuffer');
        const metadata = await parquetMetadataAsync(file);
        await parquetRead({
            file,
            compressors,
            metadata,
            onChunk(chunk: ColumnData) {
                let data = chunk.columnData;

                // Convert everything except explicit BigInt64Array
                // Which happens for the "long" value that is encoded 
                if (ctor && data.constructor.name != ctor.name && !(data instanceof BigInt64Array)) {
                    data = new ctor(data);
                }
                r[chunk.columnName] = data;
            },
        });
    }

    console.time('Reading parquet tables');
    const bd = new BimData();
    const bg = {};
    await readParquetTable('Instances', bg, Int32Array);
    await readParquetTable('VertexBuffer', bg, Int32Array);
    await readParquetTable('IndexBuffer', bg, Uint32Array);
    await readParquetTable('Meshes', bg, Int32Array);
    await readParquetTable('Materials', bg, Uint8Array);
    await readParquetTable('Transforms', bg, Float32Array);
    bd.BimGeometry = bg as BimGeometry;
    
    await readParquetTable('Entities', bd.Entities = {} as BimEntities, Int32Array);

    if (options && options.loadParameters)
    {
        await readParquetTable('Descriptors', bd.Descriptors = {} as BimParameterDescriptors);
        await readParquetTable('IntegerParameters', bd.IntegerParameters = {} as BimParameterTable, Int32Array);
        await readParquetTable('SingleParameters', bd.SingleParameters = {} as BimParameterTable, Int32Array);
        await readParquetTable('StringParameters', bd.StringParameters = {} as BimParameterTable, Int32Array);
        await readParquetTable('EntityParameters', bd.EntityParameters = {} as BimParameterTable, Int32Array);
        await readParquetTable('PointParameters', bd.PointParameters = {} as BimParameterTable, Int32Array);
    }

    await readParquetTable('Strings', bd);
    return bd;
}
