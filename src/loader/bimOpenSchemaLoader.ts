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
import { BimResolver } from './bimResolver';
import { BimQuery } from './bimQuery';

/**
 * Loader that takes a URL to a .ZIP or .BOS file containing BIM Open Schema geometry parquet tables:
 */
export class BimOpenSchemaLoader {
    async load(source: string): Promise<BimData> {
        const response = await fetch(source);
        if (!response.ok) {
            throw new Error(
                `Failed to fetch BOS from ${source}: ${response.status} ${response.statusText}`
            );
        }

        const arrayBuffer = await response.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const bimData = await loadBimGeometryFromZip(zip);
        bimData.Resolver = new BimResolver(bimData);
        bimData.Query = new BimQuery(bimData);
        bimData.Instances = buildInstances(bimData.BimGeometry);
        bimData.ThreeGeometry = buildGeometry(bimData.Instances);
        return bimData;
    }
}

/**
 * Reads the BOS parquet tables from a JSZip archive into a BimGeometry object.
 * This is the same idea as the previous browser version, just using package imports.
 */
export async function loadBimGeometryFromZip(zip: JSZip): Promise<BimData> {
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
                if (ctor && data.constructor.name != ctor.name) {
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
    const entities = {};
    await readParquetTable('Entities', entities, BigInt64Array);
    bd.Entities = entities as BimEntities;
    await readParquetTable('Strings', bd);
    return bd;
}
