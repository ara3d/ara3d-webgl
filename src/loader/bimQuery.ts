import { BimData, InstanceIndex } from './bimData';
import { BimResolver } from './bimResolver';
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
}
