import * as THREE from 'three';
import { BimGeometry } from './bimGeometry';
import { Instance } from './buildInstances';
import { BimResolver } from './bimResolver';
import { BimQuery } from './bimQuery';
import { buildGeometry } from './buildGeometryGroup';
import { BimEntities } from './bimEntities';
import { BimParameterTable } from './BimParameterTable';
import { BimParameterDescriptors } from './BimParameterDescriptors';

// Type-safe indexers 
export type EntityIndex = number & { __brand: "EntityIndex" };
export type StringIndex = number & { __brand: "StringIndex" };
export type InstanceIndex = number & { __brand: "InstanceIndex" };
export type DescriptorIndex = number & { __brand: "InstanceIndex" };

// Contains the BIM data loaded from Parquet, and the THREE geometry 
export class BimData 
{
    BimGeometry: BimGeometry;
    Entities: BimEntities;
    Strings: Array<string>;
    ThreeGeometry: THREE.Group;
    Resolver: BimResolver;
    Query: BimQuery;
    Instances: Array<Instance | undefined>;
    
    Descriptors: BimParameterDescriptors
    IntegerParameters: BimParameterTable;
    StringParameters: BimParameterTable;
    EntityParameters: BimParameterTable;
    SingleParameters: BimParameterTable;
    PointParameters: BimParameterTable;

    rebuildGeometry(instances: Array<Instance | undefined>): THREE.Group
    {
       return buildGeometry(instances);
    }
}


