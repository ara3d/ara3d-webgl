import * as THREE from 'three';
import { BimGeometry } from './bimGeometry';
import { Instance } from './buildInstances';
import { BimResolver } from './bimResolver';
import { BimQuery } from './bimQuery';
import { buildGeometry, buildGeometryAsync } from './buildGeometryGroup';
import { BimEntities } from './bimEntities';
import { BimParameterTable } from './BimParameterTable';
import { BimParameterDescriptors } from './BimParameterDescriptors';
import { perfDuration, perfLongTask, perfNow } from '../perf/perf';
import { buildViewStateRuntime, ViewStateRuntime } from '../renderState/viewStateRuntime';

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
    ViewState: ViewStateRuntime | null = null;
    
    Descriptors: BimParameterDescriptors
    IntegerParameters: BimParameterTable;
    StringParameters: BimParameterTable;
    EntityParameters: BimParameterTable;
    SingleParameters: BimParameterTable;
    PointParameters: BimParameterTable;

    buildViewStateGeometry(instances: Array<Instance | undefined>): THREE.Group
    {
       const startedAt = perfNow();
       this.ViewState = buildViewStateRuntime(instances);
       perfDuration('bimData.buildViewStateGeometry', startedAt, {
            sourceInstanceCount: instances.length
       });
       return this.ViewState.model.group;
    }

    rebuildGeometry(instances: Array<Instance | undefined>): THREE.Group
    {
       const startedAt = perfNow();
       const geometry = buildGeometry(instances);
       perfDuration('bimData.rebuildGeometry', startedAt, {
            sourceInstanceCount: instances.length
       });
       perfLongTask('bimData.rebuildGeometry.longTask', startedAt, 50, {
            sourceInstanceCount: instances.length
       });
       return geometry;
    }

    async rebuildGeometryAsync(instances: Array<Instance | undefined>): Promise<THREE.Group>
    {
       const startedAt = perfNow();
       const geometry = await buildGeometryAsync(instances);
       perfDuration('bimData.rebuildGeometry', startedAt, {
            sourceInstanceCount: instances.length
       });
       perfLongTask('bimData.rebuildGeometry.longTask', startedAt, 50, {
            sourceInstanceCount: instances.length
       });
       return geometry;
    }
}


