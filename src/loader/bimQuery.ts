import { BimData, DescriptorIndex, InstanceIndex } from './bimData';
import { BimResolver, Parameter } from './bimResolver';
import { Instance } from './buildInstances';

// This class helps us make queries about the BIM data. 

export class BimQuery {
    constructor(readonly Data: BimData) {
        this.Resolver = new BimResolver(Data);
    }

    readonly Resolver: BimResolver;

    FuncToInstances(f: (i: Instance) => string): Map<string, Instance[]> {
        const r = new Map<string, Instance[]>();
        for (const i of this.Resolver.Data.Instances) {
            if (!i) continue;
            const s = f(i);
            let list = r.get(s);
            if (!list) r.set(s, [i]);
            else list.push(i);
        }
        return r;
    }

    CategoryToInstances(): Map<string, Instance[]> {
        return this.FuncToInstances(
            i => this.Resolver.GetInstanceCategoryName(i));
    }

    GlobalIdToInstances(): Map<string, Instance[]> {
        return this.FuncToInstances(
            i => this.Resolver.GetInstanceGlobalId(i));
    }

    GetLevelFromParameters(ps: Array<Parameter>): string   
    {
        if (!ps) return null;
        let p = ps.find(p => p.Name == "Rvt:Element:Level");
        if (!p) return ""; 
        return String(p.Value);
    }

    LevelToInstances(): Map<string, Instance[]> {
        return this.FuncToInstances(
            i => this.GetLevelFromParameters(this.Resolver.GetInstanceParameters(i)));
    }
}
