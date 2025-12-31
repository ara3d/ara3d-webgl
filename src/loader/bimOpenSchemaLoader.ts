import JSZip from 'jszip';
import { parquetRead, parquetMetadataAsync, parquetSchema, ColumnData, parquetReadObjects, ParquetReadOptions } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import { BimGeometry } from './bimGeometry';
import { buildGeometry } from './buildGeometryGroup';
import { buildGeometryIR } from './bimGeometryIR';
import { BimData } from './bimData';

export interface BimEntities
{
    LocalId: Array<number>;
    GlobalId: Array<number>;
    Document: Array<number>;
    Name: Array<number>;
    Category: Array<number>;
    Type: Array<number>;
}

/**
 * Loader that takes a URL to a .ZIP or .BOS file containing BIM Open Schema geometry parquet tables:
 */
export class BimOpenSchemaLoader 
{
  async load(source: string): Promise<BimData> {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch BOS from ${source}: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const bimData = await loadBimGeometryFromZip(zip);
    bimData.BimGeometryIR = buildGeometryIR(bimData.BimGeometry);
    bimData.ThreeGeometry = buildGeometry(bimData.BimGeometryIR);

    // NOTE: this is not the most efficient way of doing it. Alternatively I could just go through and create a list of all the entity types that I care about. 
    const cats = new Set(bimData.Entities.Category);

    function getCatName(c: number): string
    {
      if (c < 0) return "";
      var nameIndex = bimData.Entities.Name[c];
      if (nameIndex < 0) return "";
      return bimData.Strings[nameIndex];
    }

    const catNames = [...cats].map(getCatName);
    console.log(catNames);

    return bimData;
  }
}

/**
 * Reads the BOS parquet tables from a JSZip archive into a BimGeometry object.
 * This is the same idea as the previous browser version, just using package imports.
 */
export async function loadBimGeometryFromZip(zip: JSZip): Promise<BimData> 
{
  // Find the file in the zip archive
  function findFileEndingWith(suffix: string): string {
    const lowerSuffix = suffix.toLowerCase();
    const name = Object.keys(zip.files).find((n) =>
      n.toLowerCase().endsWith(lowerSuffix));
    if (!name) 
      throw new Error(`Could not find "${suffix}" in zip archive.`);
    return name;
  }

  // Read the table, and put the columns directly
  async function readParquetTable(name: string, r: any, ctor: any = undefined) {
    const entryName = findFileEndingWith(name + ".parquet");
    const file = await zip.files[entryName].async('arraybuffer');
    const metadata = await parquetMetadataAsync(file);
    await parquetRead({file, compressors, metadata, onChunk(chunk: ColumnData) {
      let data = chunk.columnData;
      if (ctor && data.constructor.name != ctor.name)
      {
        data = new ctor(data);         
      }
      r[chunk.columnName] = data; 
    }});
  }
  
  console.time("Reading parquet tables");
  const bd = new BimData();
  const bg = {};
  await readParquetTable('Instances', bg, Int32Array);
  await readParquetTable('VertexBuffer', bg, Int32Array);
  await readParquetTable('IndexBuffer', bg, Uint32Array);
  await readParquetTable('Meshes', bg, Int32Array);
  await readParquetTable('Materials', bg, Uint8Array);
  await readParquetTable('Transforms', bg, Float32Array); 
  bd.BimGeometry = bg as BimGeometry;
  const entities = {}
  await readParquetTable('Entities', entities);
  bd.Entities = entities as BimEntities; 
  await readParquetTable('Strings', bd); 
  return bd;
}


