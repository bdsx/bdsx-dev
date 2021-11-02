import { notImplemented } from "../../common";
import { PdbId } from "./symbolparser";
import { tsw } from "../lib/tswriter";

interface Identifier extends PdbId<PdbId.Data> {
    templateInfo?:TemplateInfo;
    filted?:boolean;
}

export class TemplateDeclParam {
    constructor(
        public readonly name:string,
        public readonly type:Identifier,
        public readonly typeWrapped:Identifier,
        public readonly variadic:boolean
    ) {
    }
}

export class TemplateInfo {
    constructor(
        public readonly parent:TemplateInfo|null,
        /**
         * candidates of template parameters
         * contains parent template parameters
         */
        public readonly paramTypes:TemplateDeclParam[],
        /**
         * actual inputed parameters
         * contains parent template parameters
         */
        public readonly parameters:(Identifier|Identifier[])[],
        public readonly variadicOffsetOfThis:number,
    ) {
    }

    /**
     * strip parent parameters
     */
    getOwnParametersOnly():(Identifier|Identifier[])[] {
        return this.parameters.slice(this.parent !== null ? this.parent.parameters.length : 0);
    }


    infer(template:PdbId<PdbId.Data>[]):PdbId<PdbId.Data>[]|null {
        const n = template.length;
        if (n !== this.parameters.length) return null;
        const out:PdbId<PdbId.Data>[] = [];
        for (let i=0;i<n;i++) {
            const type = this.parameters[i];
            if (type instanceof Array) {
                notImplemented();
            } else {
                const key = template[i];
                if (type.infer(key, out) === null) return null;
            }
        }
        return out;
    }

    makeTemplateDecl(toTsw:(item:PdbId<PdbId.Data>)=>tsw.Type):tsw.TemplateDecl {
        const out:[string, (tsw.Type|null)?][] = [];
        for (const param of this.paramTypes) {
            if (param.variadic) {
                out.push([param.name, new tsw.ArrayType(toTsw(param.type))]);
            } else {
                if (param.type === PdbId.any_t) {
                    out.push([param.name]);
                } else {
                    out.push([param.name, toTsw(param.type)]);
                }
            }
        }
        return new tsw.TemplateDecl(out);
    }

    makeTemplateTypes(toTsw:(item:PdbId<PdbId.Data>)=>tsw.Type, stripParentTemplates:boolean):[string, (tsw.Type|null)?][] {
        const out:[string, (tsw.Type|null)?][] = [];
        let i=0;
        if (stripParentTemplates && this.parent !== null) i = this.parent.paramTypes.length;
        for (;i<this.paramTypes.length;i++) {
            const param = this.paramTypes[i];
            if (param.variadic) {
                out.push([param.name, new tsw.ArrayType(toTsw(param.typeWrapped))]);
            } else {
                if (param.typeWrapped === PdbId.any_t) {
                    out.push([param.name]);
                } else {
                    out.push([param.name, toTsw(param.typeWrapped)]);
                }
            }
        }
        return out;
    }

    makeWrappedTemplateDecl(toTsw:(item:PdbId<PdbId.Data>)=>tsw.Type):tsw.TemplateDecl {
        const out:[string, (tsw.Type|null)?][] = [];
        for (const param of this.paramTypes) {
            if (param.variadic) {
                out.push([param.name, new tsw.ArrayType(toTsw(param.typeWrapped))]);
            } else {
                if (param.typeWrapped === PdbId.any_t) {
                    out.push([param.name]);
                } else {
                    out.push([param.name, toTsw(param.typeWrapped)]);
                }
            }
        }
        return new tsw.TemplateDecl(out);
    }

    appendTypes(types:PdbId<PdbId.Data>[], variadicType:PdbId<PdbId.Data>|null):void {
        let i = this.paramTypes.length;
        if (types.length === 1 && i === 0 && variadicType === null) {
            const t = types[i];
            this.paramTypes.push(new TemplateDeclParam(
                `T`,
                t.unwrapType(),
                t,
                false
            ));
            return;
        }
        for (const t of types) {
            this.paramTypes.push(new TemplateDeclParam(
                `T${i++}`,
                t.unwrapType(),
                t,
                false
            ));
        }
        if (variadicType !== null) {
            this.paramTypes.push(new TemplateDeclParam(
                `T${i++}`,
                variadicType.unwrapType(),
                variadicType,
                true
            ));
        }
    }

    static from(item:Identifier):TemplateInfo {
        if (item.templateInfo != null) {
            return item.templateInfo;
        }
        if (item.parent === null) {
            item.templateInfo = TEMPLATE_INFO_EMPTY;
            return item.templateInfo;
        }

        function getTemplateItem(item:Identifier):PdbId<PdbId.Data>|null {
            if (item.is(PdbId.Function)) {
                const funcbase = item.data.functionBase;
                if (funcbase.templateBase !== null) {
                    return funcbase;
                }
            }
            if (item.templateBase !== null) return item;
            return null;
        }
        try {
            const parentInfo = TemplateInfo.from(item.parent);
            let parameters:(Identifier|Identifier[])[] = parentInfo.parameters;

            let types:Identifier[]|null = null;
            let variadicType:Identifier|null = null;

            const templateItem = getTemplateItem(item);
            if (item.is(PdbId.TemplateBase)) {
                const data = item.data;
                if (data.specialized.length !== 0) {
                    const first = data.specialized[0];
                    let count = first.templateParameters!.length;
                    const slen = data.specialized.length;
                    for (let i=1;i<slen;i++) {
                        const n = data.specialized[i].templateParameters!.length;
                        if (n < count) count = n;
                    }
                    for (const s of data.specialized) {
                        if (!PdbId.filter(s)) continue;

                        let j=0;
                        const srctypes = s.templateParameters!;
                        if (types === null) {
                            types = [];
                            for (;j<count;j++) {
                                const srctype = srctypes[j];
                                types.push(srctype.getTypeOfIt());
                            }
                        } else {
                            for (;j<count;j++) {
                                const srctype = srctypes[j];
                                types[j] = types[j].unionWith(srctype.getTypeOfIt());
                            }
                        }
                        for (;j<srctypes.length;j++) {
                            const srctype = srctypes[j];
                            if (variadicType === null) {
                                variadicType = srctype.getTypeOfIt();
                            } else {
                                variadicType = variadicType.unionWith(srctype.getTypeOfIt());
                            }
                        }
                    }
                }

                if (types === null) {
                    item.templateInfo = new TemplateInfo(
                        parentInfo,
                        parentInfo.paramTypes,
                        parameters,
                        -1,
                    );
                } else {
                    let variadicOffset:number;
                    if (variadicType !== null) {
                        variadicOffset = types.length;
                    } else {
                        variadicOffset = -1;
                    }
                    item.templateInfo = new TemplateInfo(
                        parentInfo,
                        parentInfo.paramTypes.slice(),
                        parameters,
                        variadicOffset
                    );
                    item.templateInfo.appendTypes(types, variadicType);
                }
            } else if (templateItem !== null) {
                const base = TemplateInfo.from(templateItem.templateBase!);
                if (base.variadicOffsetOfThis !== -1) {
                    const args = templateItem.templateParameters!.slice(base.variadicOffsetOfThis);
                    for (const arg of args) {
                        if (arg instanceof Array) {
                            throw Error(`Unexpected array`);
                        }
                    }
                    parameters = parameters.concat(templateItem.templateParameters!.slice(0, base.variadicOffsetOfThis), [args]);
                } else {
                    parameters = parameters.concat(templateItem.templateParameters!);
                }

                item.templateInfo = new TemplateInfo(
                    parentInfo,
                    base.paramTypes,
                    parameters,
                    base.variadicOffsetOfThis
                );
            } else {
                if (parentInfo.parameters.length === 0) {
                    item.templateInfo = TEMPLATE_INFO_EMPTY;
                } else {
                    item.templateInfo = new TemplateInfo(
                        parentInfo,
                        parentInfo.paramTypes,
                        parameters,
                        -1
                    );
                }
            }

            return item.templateInfo;
        } catch (err) {
            console.error('> TemplateInfo.from');
            throw err;
        }
    }
}
const TEMPLATE_INFO_EMPTY = new TemplateInfo(null, [], [], -1);
