import { StringIndex, EntityIndex } from './bimData'

// Data specific to the entities table

export interface BimEntities {
    LocalId: Array<number>;
    GlobalId: Array<StringIndex>;
    Document: Array<EntityIndex>;
    Name: Array<StringIndex>;
    Category: Array<EntityIndex>;
    Type: Array<EntityIndex>;
}
