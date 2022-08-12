import { tsw } from "../lib/tswriter";

const modulePathes = new Set<string>();

export class TsFile {
    public readonly imports = new tsw.ImportList;

    constructor(
        public readonly path:string
    ) {
        if (modulePathes.has(path)) throw Error(`${path}: Filename dupplicated`);
        modulePathes.add(path);
    }
}
