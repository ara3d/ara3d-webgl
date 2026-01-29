import { EntityIndex, DescriptorIndex } from './bimData';

export interface BimParameterTable {
    Entity: Array<EntityIndex>;
    Descriptor: Array<DescriptorIndex>;
    Value: Array<number>;
}
