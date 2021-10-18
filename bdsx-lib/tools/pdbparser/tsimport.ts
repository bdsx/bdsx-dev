import { tsw } from "../lib/tswriter";
import { UnusedName } from "../lib/unusedname";

const modulePathes = new Set<string>();

export class TsFile implements UnusedName.Scope {
    public readonly imports = new tsw.ImportList(this);

    constructor(
        public readonly path:string
    ) {
        if (modulePathes.has(path)) throw Error(`${path}: Filename dupplicated`);
        modulePathes.add(path);
    }

    existName(name:string):boolean {
        return false;
    }

    canAccessGlobalName(name:string):boolean {
        return false;
    }
}

export class TsImportItem {
    private target:tsw.ImportTarget|null = null;
    private basicImport:tsw.NamePair|null = null;

    constructor(
        public readonly base:TsFile,
        public readonly from:TsFile,
        public readonly name:string) {
    }

    private _importDirect():tsw.ItemPair {
        const target = this.target!;
        return target.importDirect();
    }

    import():tsw.ItemPair {
        if (this.basicImport === null) {
            if (this.target === null) {
                this.target = this.base.imports.from(this.from.path);
            }
            return this.basicImport = this.target.import(this.name);
        }

        const importName = this.basicImport.value.name;
        if (!this.base.canAccessGlobalName(importName)) {
            return this._importDirect().member(this.name);
        }
        return this.basicImport;
    }

    importValue():tsw.Value {
        return this.import().value;
    }
    importType():tsw.Type {
        return this.import().type;
    }
}
