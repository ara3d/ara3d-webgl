import * as THREE from 'three';
import { BimGeometry } from './bimGeometry';
import { BimGeometryIR } from './bimGeometryIR';

export interface BimEntities
{
    LocalId: Array<number>;
    GlobalId: Array<number>;
    Document: Array<number>;
    Name: Array<number>;
    Category: Array<number>;
    Type: Array<number>;
}

export class BimData {
  BimGeometry: BimGeometry;
  Entities: BimEntities;
  Strings: Array<string>;

  BimGeometryIR: BimGeometryIR;
  ThreeGeometry: THREE.Group;
}
