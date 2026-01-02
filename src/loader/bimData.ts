import * as THREE from 'three';
import { BimGeometry } from './bimGeometry';
import { Instance } from './buildInstances';
import { BimResolver } from './bimResolver';
import { BimQuery } from './bimQuery';
import { buildGeometry } from './buildGeometryGroup';
import { BimEntities } from './bimEntities';

// Type-safe indexers 
export type EntityIndex = number & { __brand: "EntityIndex" };
export type StringIndex = number & { __brand: "StringIndex" };
export type InstanceIndex = number & { __brand: "InstanceIndex" };

// Contains the BIM data loaded from Parquet, and the THREE geometry 
export class BimData 
{
    BimGeometry: BimGeometry;
    Entities: BimEntities;
    Strings: Array<string>;
    ThreeGeometry: THREE.Group;
    Resolver: BimResolver;
    Query: BimQuery;
    Instances: Array<Instance>;

    rebuildGeometry(instances: Instance[]): THREE.Group
    {
       return buildGeometry(instances);
    }
}


