import { BimData, StringIndex, EntityIndex, InstanceIndex, DescriptorIndex } from './bimData';
import { BimEntities } from './bimEntities';
import { BimGeometry } from './bimGeometry';
import { BimParameterDescriptors } from './BimParameterDescriptors';
import { BimParameterTable } from './BimParameterTable';
import { Instance } from './buildInstances';

// This class helps us efficiently look up data based on indices and a type-safe way. 

export type Parameter = { Name: string, Value: any }

export class BimResolver 
{
    constructor(readonly Data: BimData) 
    {
        this.Entities = Data.Entities ?? ({} as BimEntities);
        this.Strings = Data.Strings ?? [];
        this.BimGeometry = Data.BimGeometry;
        this.InstanceCount = this.BimGeometry.InstanceEntityIndex.length;
        this.EntityCount = this.Entities.Category.length;
        this.Descriptors = Data.Descriptors;
        this.DescriptorCount = 0;
        this.ParameterMap = new Map<EntityIndex, Array<Parameter>>();
        
        // If there are no descriptors, we don't have to do parameter processing
        if (!this.Descriptors)
        {
            return;
        }
        
        console.time("Computing parameters");
        this.DescriptorCount = this.Descriptors.Name.length;
        this.ProcessParameters(Data.IntegerParameters);
        this.ProcessParameters(Data.SingleParameters);
        this.ProcessParameters(Data.StringParameters);
        this.ProcessParameters(Data.EntityParameters);
        console.timeEnd("Computing parameters");
    }

    GetVal(rawVal: number, descType: number): any
    {
        if (descType == 3) return this.Strings[rawVal];
        if (descType == 2) {
            if (rawVal >= 0)
                return this.GetEntityName(rawVal as EntityIndex);
            return ""; 
        }
        return rawVal;
    }

    ProcessParameters(table: BimParameterTable)
    {
        if (!table || !table.Value || !table.Descriptor || !table.Entity) return;
        for (let i=0; i < table.Value.length; i++)
        {
            let descIndex = table.Descriptor[i];
            let entityIndex = table.Entity[i];
            let rawVal = table.Value[i];
            if (descIndex < 0) continue;
            let nameIndex = this.Descriptors.Name[descIndex];
            let descType = this.Descriptors.Type[descIndex];
            let Value = this.GetVal(rawVal, descType);
            let Name = this.Strings[nameIndex];
            let param = { Name, Value } as Parameter;
            let tmp = this.ParameterMap.get(entityIndex);
            if (tmp === undefined)
            {
                this.ParameterMap.set(entityIndex, [param]);
            }
            else
            {
                tmp.push(param);
            }
        }
    }

    readonly Descriptors: BimParameterDescriptors;
    readonly Strings: Array<string>;
    readonly Entities: BimEntities;
    readonly InstanceCount: number;
    readonly EntityCount: number;
    readonly BimGeometry: BimGeometry;
    readonly DescriptorCount: number;
    
    readonly ParameterMap: Map<EntityIndex, Array<Parameter>>;

    GetString(stringIndex: StringIndex): string { return this.Strings[stringIndex]; }

    GetEntityName(i: EntityIndex): string { return this.GetString(this.Entities.Name[i]); }
    GetEntityCategory(i: EntityIndex): EntityIndex { return this.Entities.Category[i]; }
    GetEntityCategoryName(i: EntityIndex): string { return this.GetEntityName(this.GetEntityCategory(i)); }
    GetEntityType(i: EntityIndex): EntityIndex { return this.Entities.Type[i]; }
    GetEntityTypeName(i: EntityIndex): string { return this.GetEntityName(this.GetEntityType(i)); }
    GetEntityDocument(i: EntityIndex): EntityIndex { return this.Entities.Type[i]; }
    GetEntityDocumentName(i: EntityIndex): string { return this.GetEntityName(this.GetEntityDocument(i)); }
    GetEntityParameters(i: EntityIndex): Array<Parameter> { return this.ParameterMap.get(i); }

    GetInstanceName(i: Instance): string { return this.GetEntityName(i.entity); }
    GetInstanceCategoryName(i: Instance): string { return this.GetEntityCategoryName(i.entity); }
    GetInstanceTypeName(i: Instance): string { return this.GetEntityTypeName(i.entity); }
    GetInstanceDocumentName(i: Instance): string { return this.GetEntityDocumentName(i.entity); }
    GetInstanceGlobalId(i: Instance): string { return this.GetString(this.Entities.GlobalId[i.entity]); }
    GetInstanceParameters(i: Instance): Array<Parameter> { return this.GetEntityParameters(i.entity); }

    GetDescriptorName(i: DescriptorIndex): string { return this.GetString(this.Descriptors.Name[i]); }
    GetDescriptorType(i: DescriptorIndex): number { return this.Descriptors.Type[i]; }
    GetDescriptorGroup(i: DescriptorIndex): string { return this.GetString(this.Descriptors.Group[i]); }
    GetDescriptorUnits(i: DescriptorIndex): string { return this.GetString(this.Descriptors.Units[i]); }

    *EntityIndices(): Iterable<EntityIndex> { for (let i = 0; i < this.EntityCount; i++) yield i as EntityIndex; }
    *InstanceIndices(): Iterable<InstanceIndex> { for (let i = 0; i < this.InstanceCount; i++) yield i as InstanceIndex; }
    *DescriptorIndices(): Iterable<DescriptorIndex> { for (let i = 0; i < this.DescriptorCount; i++) yield i as DescriptorIndex; }

    first<T>(iterable: Iterable<T>, predicate: (value: T) => boolean, _default: T): T {
        for (const value of iterable) 
            if (predicate(value)) return value;
        return _default;
    }

    FindDescriptor(name: string): DescriptorIndex { return this.first(this.DescriptorIndices(), i => this.GetDescriptorName(i) == name, -1 as DescriptorIndex); }
}
