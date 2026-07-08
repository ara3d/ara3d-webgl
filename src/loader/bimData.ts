import * as THREE from 'three'
import { BimGeometry } from './bimGeometry'
import { Instance } from './buildInstances'
import { BimResolver } from './bimResolver'
import { BimQuery } from './bimQuery'
import { buildGeometry } from './buildGeometryGroup'
import { BimEntities } from './bimEntities'
import { BimParameterValues } from './BimParameterValues'
import { BimParameterDescriptors } from './BimParameterDescriptors'

// Type-safe indexers
export type EntityIndex = number & { __brand: 'EntityIndex' };
export type StringIndex = number & { __brand: 'StringIndex' };
export type InstanceIndex = number & { __brand: 'InstanceIndex' };
export type DescriptorIndex = number & { __brand: 'InstanceIndex' };

// Contains the BIM data loaded from Parquet, and the THREE geometry
export class BimData {
  BimGeometry: BimGeometry
  Entities: BimEntities
  Strings: Array<string>
  ThreeGeometry: THREE.Group
  Resolver: BimResolver
  Query: BimQuery
  Instances: Array<Instance>

  Descriptors: BimParameterDescriptors
  IntegerParameters: BimParameterValues
  StringParameters: BimParameterValues
  EntityParameters: BimParameterValues
  SingleParameters: BimParameterValues
  PointParameters: BimParameterValues

  rebuildGeometry (instances: Array<Instance>): THREE.Group {
    return buildGeometry(instances)
  }
}
