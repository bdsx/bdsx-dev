/**
 * @internal
 */

const nullScope:UnusedName.Scope = {
    existName() { return false; },
    canAccessGlobalName() { return false; }
};

export class UnusedName {
    private readonly generatedNames = new Map<string, number>();

    constructor(public readonly scope:UnusedName.Scope = nullScope) {
    }

    hasName(name:string):boolean {
        return this.generatedNames.has(name);
    }

    deleteName(name:string):boolean {
        return this.generatedNames.delete(name);
    }

    makeName(name:string):string {
        let counter:number|undefined;
        for (;;) {
            counter = this.generatedNames.get(name);
            if (counter == null) {
                if (this.scope.existName(name)) {
                    this.generatedNames.set(name, counter = 1);
                    break;
                }
                this.generatedNames.set(name, 1);
                return name;
            }
            break;
        }
        for (;;) {
            const nname = name + (++counter);
            if (!this.scope.existName(nname)) {
                this.generatedNames.set(name, counter);
                return nname;
            }
        }
    }
}

export namespace UnusedName {
    export interface Scope {
        existName(name:string):boolean;
        canAccessGlobalName(bame:string):boolean;
    }
}
