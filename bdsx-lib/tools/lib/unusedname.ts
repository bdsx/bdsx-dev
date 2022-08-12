/**
 * @internal
 */

export interface ScopeMethod {
    existName(name:string):boolean;
}

export namespace ScopeMethod {
    export const empty:ScopeMethod = {
        existName(name) {
            return false;
        }
    };
}

export class UnusedName {
    private readonly generatedNames = new Map<string, number>();

    hasName(name:string):boolean {
        return this.generatedNames.has(name);
    }

    deleteName(name:string):boolean {
        return this.generatedNames.delete(name);
    }

    makeName(scope:ScopeMethod, name:string):string {
        let counter:number|undefined;
        for (;;) {
            counter = this.generatedNames.get(name);
            if (counter == null) {
                if (scope.existName(name)) {
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
            if (!scope.existName(nname)) {
                this.generatedNames.set(name, counter);
                return nname;
            }
        }
    }
}
