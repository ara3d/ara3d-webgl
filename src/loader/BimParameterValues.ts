import { EntityIndex, DescriptorIndex } from './bimData';


export interface BimParameterValues {
    Entity: Array<EntityIndex>;
    Descriptor: Array<DescriptorIndex>;
    Value: Array<number>;
}
