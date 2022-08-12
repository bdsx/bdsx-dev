import { FloatRegister, Register } from "../assembler";
import { AnyFunction } from "../common";
import { NativePointer, StaticPointer } from "../core";
import { dll } from "../dll";
import { FunctionFromTypes_js, makefunc, MakeFuncOptions, ParamType } from "../makefunc";
import { minecraftTsReady } from "../minecraft/ext_ready";
import type { Type, UnwrapTypeArrayToArray } from "../nativetype";
import { serializeTypes } from "../typeserializer";
import { arrayEquals } from "../util";

enum Prop {
    rva,
    parameterTypes,
    returnType,
    opts,
    templates
}

declare global {
    interface Function {
        isNativeFunction?:boolean;
        [nativeCall]?:AnyFunction;
        [overloads]?:AnyFunction[];
        [templateMap]?:Record<string, AnyFunction[]>;
        [overloadInfo]?:dnf.OverloadInfo;
    }
}

const nativeCall = Symbol('nativeCall');
const overloads = Symbol('overloads');
const overloadInfo = Symbol('overloadInfo');
const templateMap = Symbol('templateMap');

const PARAM_FLOAT_REGISTERS:FloatRegister[] = [FloatRegister.xmm0, FloatRegister.xmm1, FloatRegister.xmm2, FloatRegister.xmm3];
const PARAM_REGISTERS:Register[] = [Register.rcx, Register.rdx, Register.r8, Register.r9];

function checkEntryWithValues(func:AnyFunction, thisv:unknown, args:ArrayLike<unknown>):boolean {
    const info = func[overloadInfo]!;
    const opts = info[Prop.opts];
    if (opts !== null) {
        const thisType:Type<any> = opts.this;
        if (thisType !== null) {
            if (!thisType.isTypeOf(thisv)) return false;
        }
    }
    const params = info[Prop.parameterTypes];
    for (let i=0;i<args.length;i++) {
        if (!params[i].isTypeOf(args[i])) return false;
    }
    return true;
}

function checkEntryWithTypes(func:AnyFunction, thisv:Type<any>|null, args:Type<any>[]):boolean {
    const info = func[overloadInfo]!;
    const opts = info[Prop.opts];
    if (opts !== null) {
        const thisType = opts.this;
        if (thisType !== null) {
            if (thisType !== thisv) return false;
        }
    }
    const params = info[Prop.parameterTypes];
    if (args.length !== params.length) return false;
    for (let i=0;i<args.length;i++) {
        if (params[i] !== args[i]) return false;
    }
    return true;
}

function makeOverloadNativeCall(func:AnyFunction):AnyFunction {
    const info = func[overloadInfo]!;
    return func[nativeCall] = makefunc.js(dll.current.add(info[Prop.rva]), info[Prop.returnType], info[Prop.opts], ...info[Prop.parameterTypes]);
}

function makeFunctionNativeCall(nf:AnyFunction, provider:()=>AnyFunction[]):AnyFunction {
    let overs = nf[overloads];
    if (overs == null) {
        overs = nf[overloads] = provider();
    }
    if (overs.length === 0) {
        throw Error(`Invalid native function, ${nf.name}`);
    }
    if (overs.length === 1) {
        const overload = overs[0];
        return nf[nativeCall] = overload[nativeCall] || makeOverloadNativeCall(overload);
    }

    let tmaps:Record<string, AnyFunction[]>|null = null;
    for (const over of overs) {
        const info = over[overloadInfo];
        if (info == null) continue;
        const templateKey = info[Prop.templates];
        if (templateKey == null) continue;
        if (tmaps === null) tmaps = {};
        const arr = tmaps[templateKey];
        if (arr == null) tmaps[templateKey] = [over];
        else arr.push(over);
    }
    if (tmaps !== null) {
        nf[templateMap] = tmaps;
        return nf[nativeCall] = function(this:unknown):any {
            let overs = nf[overloads]!;
            try {
                const s = serializeTypes(arguments);
                const list = nf[templateMap]![s];
                if (list != null) {
                    overs = list;
                }
            } catch(_) {
            }
            for (const overload of overs) {
                if (!checkEntryWithValues(overload, this, arguments)) continue;
                const func = overload[nativeCall] || makeOverloadNativeCall(overload);
                return func.apply(this, arguments);
            }
            throw Error(`overload not found`);
        };
    } else {
        return nf[nativeCall] = function(this:unknown):any {
            const overs = nf[overloads]!;
            for (const overload of overs) {
                if (!checkEntryWithValues(overload, this, arguments)) continue;
                const func = overload[nativeCall] || makeOverloadNativeCall(overload);
                return func.apply(this, arguments);
            }
            throw Error(`overload not found`);
        };
    }
}

export function dnf<T>(cls:Type<T>, key:keyof T):dnf.Tool<T>;
export function dnf(nf:AnyFunction):dnf.Tool<void>;
export function dnf(nf:AnyFunction|Type<any>, methodName?:keyof any):dnf.Tool<any> {
    if (methodName != null) {
        return new dnf.Tool(nf.prototype[methodName], String(methodName), nf as any);
    } else {
        return new dnf.Tool(nf as any, '[Native Function]', null);
    }
}

// deferred native function
export namespace dnf {
    export class Tool<THIS> {
        constructor(
            public nf:AnyFunction,
            public name:string,
            public thisType:Type<THIS>|null) {
        }

        getVFTableOffset():[number] {
            if (this.thisType === null) throw Error(`this type is not determined`);
            const vftable:StaticPointer = (this.thisType as any).addressof_vftable;
            if (vftable == null) throw Error(`${this.thisType.name}.addressof_vftable not found`);
            const addr = this.getAddress();
            for (let offset=0;offset<0x1000;offset+= 8) {
                if (vftable.getPointer(offset).equals(addr)) return [offset];
            }
            throw Error(`cannot find a function in the vftable`);
        }

        /**
         * search overloads with types
         */
        get(paramTypes:Type<any>[], templates?:unknown[]):AnyFunction|null{
            let overs:AnyFunction[]|undefined;
            if (templates != null) {
                const tmaps = this.nf[templateMap];
                if (tmaps == null) throw Error(`it does not have templates`);
                const s = serializeTypes(templates);
                overs = tmaps[s];
                if (overs == null) throw Error(`template not found`);
            } else {
                overs = this.nf[overloads];
                if (overs == null) throw Error(`it does not have overloads`);
            }
            for (const over of overs) {
                if (!checkEntryWithTypes(over, this.thisType, paramTypes)) continue;
                return over;
            }
            return null;
        }

        /**
         * search overloads with templates
         */
        getByTemplates(thisType?:Type<any>|null, ...args:unknown[]):AnyFunction|null{
            if (thisType == null) thisType = this.thisType;
            const tmaps = this.nf[templateMap];
            if (tmaps == null) throw Error(`it does not have templates`);
            const s = serializeTypes(args);
            const list = tmaps[s];
            if (list == null) throw Error(`template not found`);
            return list[0];
        }

        /**
         * search overloads with values
         */
        getByValues<ARGS extends any[]>(thisv:unknown, ...args:ARGS):((...args:any[])=>any)|null{
            const overs = this.nf[overloads];
            if (overs == null) {
                throw Error(`it does not have overloads`);
            }
            if (overs.length === 1) {
                return overs[0];
            } else {
                for (const overload of overs) {
                    if (!checkEntryWithValues(overload, thisv, args)) continue;
                    return overload;
                }
            }
            return null;
        }

        getByTypes<ARGS extends Type<any>[]>(thisType?:null, ...args:ARGS):((this:THIS,...args:UnwrapTypeArrayToArray<ARGS>)=>any)|null;
        getByTypes<THIS, ARGS extends Type<any>[]>(thisType:Type<THIS>, ...args:ARGS):((this:THIS,...args:UnwrapTypeArrayToArray<ARGS>)=>any)|null;

        /**
         * search overloads with parameter types
         */
        getByTypes<THIS, ARGS extends Type<any>[]>(thisType?:Type<THIS>|null, ...args:ARGS):((this:THIS,...args:UnwrapTypeArrayToArray<ARGS>)=>any)|null{
            const overs = this.nf[overloads];
            if (overs == null) {
                throw Error(`it does not have overloads`);
            }
            if (thisType == null) thisType = this.thisType as Type<any>;
            for (const overload of overs) {
                if (!checkEntryWithTypes(overload, thisType, args)) continue;
                return overload;
            }
            return null;
        }

        getAddress():NativePointer {
            return dll.current.add(this.getInfo()[Prop.rva]);
        }

        getInfo():OverloadInfo {
            let nf = this.nf;
            const overs = nf[overloads];
            if (overs != null) {
                if (overs.length === 0) {
                    throw Error(`${this.name} does not have overloads`);
                } else if (overs.length >= 2) {
                    throw Error(`${this.name} has multiple overloads`);
                }
                nf = overs[0];
            }
            const info = nf[overloadInfo];
            if (info == null) {
                if (!minecraftTsReady.isReady()) {
                    throw Error(`minecraft.ts is not ready. use minecraftTsReady(callback) for using dnf`);
                }
                throw Error(`${this.name} does not have a overload info`);
            }
            return info;
        }

        getRegistersForParameters():[Register[], FloatRegister[]] {
            const info = this.getInfo();
            const params = info[1];
            const opts = info[3];
            const rs:Register[] = [];
            const frs:FloatRegister[] = [];
            let index = 0;
            if (opts !== null) {
                if (opts.this != null) {
                    rs.push(PARAM_REGISTERS[index++]);
                }
                if (opts.structureReturn) {
                    rs.push(PARAM_REGISTERS[index++]);
                }
            }
            for (const type of params) {
                if (type[makefunc.useXmmRegister]) frs.push(PARAM_FLOAT_REGISTERS[index++]);
                else rs.push(PARAM_REGISTERS[index++]);
                if (rs.length >= 4) break;
            }
            return [rs, frs];
        }

        overload(func:(this:THIS, ...args:any[])=>any, ...paramTypes:Type<any>[]):void {
            const overs = this.nf[overloads];
            if (overs == null) {
                throw Error(`it does not have overloads`);
            }

            func[overloadInfo] = [0, paramTypes, null as any, null];
            func[nativeCall] = func;

            for (let i=0;i<overs.length;i++) {
                const overload = overs[i];
                const info = overload[overloadInfo];
                if (info == null) {
                    if (!minecraftTsReady.isReady()) {
                        throw Error(`minecraft.ts is not ready. use minecraftTsReady(callback) for using dnf`);
                    }
                    throw Error(`it does not have a overload info`);
                }
                const paramTypes2 = info[1];
                if (arrayEquals(paramTypes2, paramTypes)) {
                    overs[i] = overload;
                    return;
                }
            }
            overs.push(func);
        }

        /**
         * set only for JS calls
         */
        set(func:(this:THIS, ...args:any[])=>any):void {
            this.nf[nativeCall] = func;
        }

        reform<OPTS extends MakeFuncOptions<any>|null, RETURN extends ParamType, PARAMS extends ParamType[]>(
            returnType:RETURN,
            opts?: OPTS,
            ...params: PARAMS):
            FunctionFromTypes_js<NativePointer, OPTS, PARAMS, RETURN> {
            const addr = this.getAddress();
            const out = makefunc.js(addr, returnType, opts, ...params);
            const info = out[overloadInfo] = this.getInfo().slice() as OverloadInfo;
            info[Prop.parameterTypes] = params;
            info[Prop.returnType] = returnType;
            info[Prop.opts] = opts || null;
            return out;
        }
    }


    // rva, parameterTypes, returnType, opts, templates
    export type OverloadInfo = [number, makefunc.Paramable[], makefunc.Paramable, MakeFuncOptions<any>|null, string?];

    export function makeOverload(oi:OverloadInfo):AnyFunction {
        function nativeFunction(this:unknown):any {
            return (nativeFunction[nativeCall] || makeOverloadNativeCall(nativeFunction)).apply(this, arguments);
        }
        nativeFunction[overloadInfo] = oi;
        return nativeFunction;
    }

    export function getAddressOf(nf:AnyFunction):NativePointer {
        return dll.current.add(getOverloadInfo(nf)[Prop.rva]);
    }

    export function getOverloadInfo(nf:AnyFunction):OverloadInfo {
        const overs = nf[overloads];
        if (overs != null) {
            if (overs.length === 0) {
                throw Error(`it does not have overloads`);
            } else if (overs.length >= 2) {
                throw Error(`it has multiple overloads`);
            }
            nf = overs[0];
        }
        const info = nf[overloadInfo];
        if (info == null) {
            if (!minecraftTsReady.isReady()) {
                throw Error(`minecraft.ts is not ready. use minecraftTsReady(callback) for using dnf`);
            }
            throw Error(`it does not have a overload info`);
        }
        return info;
    }

    export function make(provider:()=>AnyFunction[]):AnyFunction {
        function nativeFunction(this:unknown):any {
            return (nativeFunction[nativeCall] || makeFunctionNativeCall(nativeFunction, provider)).apply(this, arguments);
        }
        nativeFunction.isNativeFunction = true;
        return nativeFunction;
    }
}
