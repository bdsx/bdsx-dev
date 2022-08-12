import { tsw } from "../lib/tswriter";
import { unique } from "../../unique";

enum AddedState {
    Added,
    Expanded,
    Failed,
}

class ParamInfo {
    public count = 1;
    public keyTypes:tsw.Type[]|null = null;

    constructor(public readonly key:number, public types:tsw.Type[], public readonly names:tsw.Name[]) {
    }

    add(other:ParamInfo):AddedState {
        const info = new tsw.MergeInfo(
            this.keyTypes !== null ? tsw.MergeInfo.wildcard : null,
            other.keyTypes !== null ? tsw.MergeInfo.wildcard : null,
        );
        const res = tsw.Type.merge(this.types, other.types, info);
        if (res === null) return AddedState.Failed;
        if (res === this.types) return AddedState.Added;

        const keyTypes:tsw.Type[] = [];
        function append(target:tsw.Type|null, info:ParamInfo):void {
            if (target !== null && target !== tsw.MergeInfo.wildcard) {
                if (info.keyTypes !== null) {
                    for (const item of info.keyTypes) {
                        keyTypes.push(target.replaceAll(tsw.MergeInfo.wildcard, item));
                    }
                } else {
                    keyTypes.push(target);
                }
            }
        }

        append(info.target1, this);
        append(info.target2, other);
        this.keyTypes = keyTypes;

        let counter = 0;
        const n = other.names.length;
        for (let i=0;i<n;i++) {
            const name1 = this.names[i];
            const name2 = other.names[i];
            if (name1 !== name2 && name1.name !== name2.name) {
                this.names[i] = unique.make(tsw.Name, 'v'+(++counter));
            }
        }

        this.count += other.count;
        if (res !== this.types) {
            this.types = res;
            return AddedState.Expanded;
        } else {
            return AddedState.Added;
        }
    }

    reduce():boolean {
        if (this.keyTypes === null) return false;

        let total = 0;
        let target = -1;
        const n = this.types.length;
        for (let i=0;i<n;i++) {
            total += this.types[i].count(tsw.MergeInfo.wildcard);
            if (total === 1 && target === -1) target = i;
            if (total >= 2) return false;
        }
        if (target === -1) return false;

        this.types[target] = this.types[target].replaceAll(tsw.MergeInfo.wildcard, tsw.Type.smartOr(this.keyTypes));
        this.keyTypes = null;
        return true;
    }
}

const IS_STATIC = 0x80000000;
const HAS_RETURN_TYPE = 0x40000000;
const HAS_THIS_TYPE = 0x20000000;

export class FunctionMerge {
    private readonly paramCountMap = new Map<number, ParamInfo[]>();

    private addInfo(info:ParamInfo):void {
        const infos = this.paramCountMap.get(info.key);
        if (infos == null) {
            this.paramCountMap.set(info.key, [info]);
            return;
        } else {
            for (const target of infos) {
                if (target.add(info) !== AddedState.Failed) {
                    return;
                }
            }
            infos.push(info);
        }
    }

    add(returnType:tsw.Type|null, thisType:tsw.Type|null, paramTypes:tsw.Type[], paramNames:tsw.Name[], isStatic:boolean):void {
        let key = paramTypes.length;
        const types = paramTypes.slice();
        if (isStatic) key |= IS_STATIC;
        // if (thisType !== null) {
        //     key |= HAS_THIS_TYPE;
        //     types.push(thisType);
        // }
        if (returnType !== null) {
            key |= HAS_RETURN_TYPE;
            types.push(returnType);
        }
        const info = new ParamInfo(key, types, paramNames);
        this.addInfo(info);
    }

    reduce():void {
        for (;;) {
            const newInputs:ParamInfo[] = [];
            for (const infos of this.paramCountMap.values()) {
                for (let i=0;i<infos.length;) {
                    const item = infos[i];
                    if (item.reduce()) {
                        // loop
                        infos.splice(i, 1);
                        newInputs.push(item);
                    } else {
                        i++;
                    }
                }
            }
            if (newInputs.length === 0) return;
            for (const item of newInputs) {
                this.addInfo(item);
            }
        }
    }

    *entries():IterableIterator<FunctionMerge.Result> {
        for (const [key, infos] of this.paramCountMap) {
            for (const info of infos) {
                const types = info.types.slice();
                const out:FunctionMerge.Result = {
                    returnType:null,
                    thisType:null,
                    params:[],
                    isStatic: (key & IS_STATIC) !== 0,
                };
                if (info.keyTypes !== null) {
                    const type = tsw.Type.smartOr(info.keyTypes);
                    if (type !== tsw.BasicType.any) {
                        out.templates = new tsw.TemplateDecl([['T', type]]);
                    } else {
                        out.templates = new tsw.TemplateDecl([['T']]);
                    }
                }
                if ((key & HAS_RETURN_TYPE) !== 0) {
                    out.returnType = types.pop()!;
                }
                if ((key & HAS_THIS_TYPE) !== 0) {
                    out.thisType = types.pop()!;
                    out.params.push(new tsw.VariableDefineItem(tsw.Name.this, out.thisType));
                }
                const n = types.length;
                for (let i=0;i<n;i++) {
                    const name = info.names[i];
                    const type = types[i];
                    const item = new tsw.VariableDefineItem(name, type);
                    out.params.push(item);
                }

                // undefined to optional
                for (let i=n-1;i>=0;i--) {
                    const item = out.params[i];
                    if (item.type instanceof tsw.TypeOr) {
                        const type = item.type.remove(tsw.BasicType.undefined);
                        if (type !== item.type) {
                            const name = info.names[i];
                            out.params[i] = new tsw.VariableDefineItem(name, type, tsw.OPTIONAL);
                        }
                    }
                }
                yield out;
            }
        }
    }
}

export namespace FunctionMerge {
    export interface Result {
        returnType:tsw.Type|null;
        thisType:tsw.Type|null;
        params:tsw.VariableDefineItem[];
        isStatic:boolean;
        templates?:tsw.TemplateDecl;
    }
}
