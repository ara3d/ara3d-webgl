import { BimData, StringIndex, EntityIndex, InstanceIndex } from './bimData';
import { BimEntities } from './bimEntities';
import { BimGeometry } from './bimGeometry';
import { Instance } from './buildInstances';

// This class helps us efficiently look up data based on indices and a type-safe way. 

export class BimResolver {
    constructor(readonly Data: BimData) {
        this.Entities = Data.Entities;
        this.Strings = Data.Strings;
        this.BimGeometry = Data.BimGeometry;
        this.InstanceCount = this.BimGeometry.InstanceEntityIndex.length;
        this.EntityCount = this.Entities.Category.length;
    }

    readonly Strings: Array<string>;
    readonly Entities: BimEntities;

    readonly InstanceCount: number;
    readonly EntityCount: number;
    readonly BimGeometry: BimGeometry;

    GetString(stringIndex: StringIndex): string { return this.Strings[stringIndex]; }

    GetEntityName(i: EntityIndex): string { return this.GetString(this.Entities.Name[i]); }
    GetEntityCategory(i: EntityIndex): EntityIndex { return this.Entities.Category[i]; }
    GetEntityCategoryName(i: EntityIndex): string { return this.GetEntityName(this.GetEntityCategory(i)); }
    GetEntityType(i: EntityIndex): EntityIndex { return this.Entities.Type[i]; }
    GetEntityTypeName(i: EntityIndex): string { return this.GetEntityName(this.GetEntityType(i)); }
    GetEntityDocument(i: EntityIndex): EntityIndex { return this.Entities.Type[i]; }
    GetEntityDocumentName(i: EntityIndex): string { return this.GetEntityName(this.GetEntityDocument(i)); }

    GetInstanceName(i: Instance): string { return this.GetEntityName(i.entity); }
    GetInstanceCategoryName(i: Instance): string { return this.GetEntityCategoryName(i.entity); }
    GetInstanceTypeName(i: Instance): string { return this.GetEntityTypeName(i.entity); }
    GetInstanceDocumentName(i: Instance): string { return this.GetEntityDocumentName(i.entity); }
    GetInstanceGlobalId(i: Instance): string { return this.GetString(this.Entities.GlobalId[i.entity]); }

    *EntityIndices(): Iterable<EntityIndex> { for (let i = 0; i < this.EntityCount; i++) yield i as EntityIndex; }
}
