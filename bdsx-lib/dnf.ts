import { FloatRegister, Register } from "./assembler";
import { AnyFunction } from "./common";
import { NativePointer } from "./core";
import { dll } from "./dll";
import { FunctionFromTypes_js, makefunc, MakeFuncOptions, ParamType } from "./makefunc";
import type { Type, UnwrapTypeArrayToArray } from "./nativetype";
import { arrayEquals } from "./util";


enum Prop {
    rva,
    parameterTypes,
    returnType,
    opts,
    templates
}

declare global {
    interface Function {
        overloads?:AnyFunction[];
        overloadInfo?:dnf.OverloadInfo;
        isNativeFunction?:boolean;
        [nativeCall]?:AnyFunction;
    }
}

const nativeCall = Symbol('nativeCall');
const PARAM_FLOAT_REGISTERS:FloatRegister[] = [FloatRegister.xmm0, FloatRegister.xmm1, FloatRegister.xmm2, FloatRegister.xmm3];
const PARAM_REGISTERS:Register[] = [Register.rcx, Register.rdx, Register.r8, Register.r9];

function checkEntryWithValues(func:AnyFunction, thisv:unknown, args:ArrayLike<unknown>):boolean {
    const info = func.overloadInfo!;
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
    const info = func.overloadInfo!;
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

function checkEntryTemplates(func:AnyFunction, thisv:Type<any>|null|undefined, args:ArrayLike<unknown>):boolean {
    const templates = func.overloadInfo![Prop.templates];
    if (templates == null) return false;
    if (thisv != null) {
        const opts = func.overloadInfo![Prop.opts];
        if (opts !== null && opts.this !== thisv) return false;
    }
    if (args.length > templates.length) return false;
    for (let i=0;i<args.length;i++) {
        if (templates[i] !== args[i]) return false;
    }
    return true;
}

function makeOverloadNativeCall(func:AnyFunction):AnyFunction {
    const info = func.overloadInfo!;
    return func[nativeCall] = makefunc.js(dll.current.add(info[Prop.rva]), info[Prop.returnType], info[Prop.opts], ...info[Prop.parameterTypes]);
}

function makeFunctionNativeCall(nf:AnyFunction):AnyFunction {
    const overloads = nf.overloads;
    if (overloads == null || overloads.length === 0) {
        throw Error(`it does not have overloads`);
    }
    if (overloads.length === 1) {
        const overload = overloads[0];
        return nf[nativeCall] = overload[nativeCall] || makeOverloadNativeCall(overload);
    } else {
        return nf[nativeCall] = function(this:unknown):any {
            const ctor = this ? (this as any).constructor : null;
            for (const overload of overloads) {
                if (!checkEntryTemplates(overload, ctor, arguments)) continue;
                const func = overload[nativeCall] || makeOverloadNativeCall(overload);
                return func.bind(this);
            }
            for (const overload of overloads) {
                if (!checkEntryWithValues(overload, this, arguments)) continue;
                const func = overload[nativeCall] || makeOverloadNativeCall(overload);
                return func.apply(this, arguments);
            }
            throw Error('overload not found');
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
            public readonly nf:AnyFunction,
            public readonly name:string,
            public readonly thisType:Type<THIS>|null) {
        }

        /**
         * search overloads with types
         */
        get(thisv:unknown|null, paramTypes:Type<any>[], templates?:unknown[]):AnyFunction|null{
            const thisType:Type<any>|null = thisv !== null ? this.thisType : (thisv as any).constructor;
            const overloads = this.nf.overloads;
            if (overloads == null) {
                throw Error(`it does not have overloads`);
            }
            for (const entry of overloads) {
                if (templates != null && !checkEntryTemplates(entry, thisType, templates)) continue;
                if (!checkEntryWithTypes(entry, this.thisType, paramTypes)) continue;
                return entry;
            }
            return null;
        }

        /**
         * search overloads with templates
         */
        getByTemplates(thisType?:Type<any>|null, ...args:unknown[]):AnyFunction|null{
            if (thisType == null) thisType = this.thisType;
            const overloads = this.nf.overloads;
            if (overloads == null) {
                throw Error(`it does not have overloads`);
            }
            for (const entry of overloads) {
                if (!checkEntryTemplates(entry, thisType, args)) continue;
                return entry;
            }
            return null;
        }

        /**
         * search overloads with values
         */
        getByValues<ARGS extends any[]>(thisv:unknown, ...args:ARGS):((...args:any[])=>any)|null{
            const overloads = this.nf.overloads;
            if (overloads == null) {
                throw Error(`it does not have overloads`);
            }
            if (overloads.length === 1) {
                return overloads[0];
            } else {
                for (const overload of overloads) {
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
            const overloads = this.nf.overloads;
            if (overloads == null) {
                throw Error(`it does not have overloads`);
            }
            if (thisType == null) thisType = this.thisType as Type<any>;
            for (const overload of overloads) {
                if (!checkEntryWithTypes(overload, thisType, args)) continue;
                return overload;
            }
            return null;
        }

        getAddress():NativePointer {
            return getAddressOf(this.nf);
        }

        getInfo():OverloadInfo {
            return getOverloadInfo(this.nf);
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
            const overloads = this.nf.overloads;
            if (overloads == null) {
                throw Error(`it does not have overloads`);
            }

            func.overloadInfo = [0, paramTypes, null as any, null];
            func[nativeCall] = func;

            for (let i=0;i<overloads.length;i++) {
                const overload = overloads[i];
                const info = overload.overloadInfo!;
                const paramTypes2 = info[1];
                if (arrayEquals(paramTypes2, paramTypes)) {
                    overloads[i] = overload;
                    return;
                }
            }
            overloads.push(func);
        }

        /**
         * ignore original features.
         */
        overwrite(func:(this:THIS, ...args:any[])=>any):void {
            this.nf[nativeCall] = func;
        }

        reform<OPTS extends MakeFuncOptions<any>|null, RETURN extends ParamType, PARAMS extends ParamType[]>(
            returnType:RETURN,
            opts?: OPTS,
            ...params: PARAMS):
            FunctionFromTypes_js<NativePointer, OPTS, PARAMS, RETURN> {
            const addr = this.getAddress();
            return makefunc.js(addr, returnType, opts, ...params);
        }
    }


    // rva, parameterTypes, returnType, opts, templates
    export type OverloadInfo = [number, makefunc.Paramable[], makefunc.Paramable, MakeFuncOptions<any>|null, unknown[]?];

    export function makeOverload():AnyFunction {
        function nf(this:unknown):any {
            return (nf[nativeCall] || makeOverloadNativeCall(nf)).apply(this, arguments);
        }
        return nf;
    }

    export function getAddressOf(nf:AnyFunction):NativePointer {
        return dll.current.add(getOverloadInfo(nf)[Prop.rva]);
    }

    export function getOverloadInfo(nf:AnyFunction):OverloadInfo {
        const overloads = nf.overloads;
        if (overloads != null) {
            if (overloads.length === 0) {
                throw Error(`it does not have overloads`);
            } else if (overloads.length >= 2) {
                throw Error(`it has multiple overloads`);
            }
            nf = overloads[0];
        }
        const info = nf.overloadInfo;
        if (info == null) {
            throw Error(`it does not have a overload info`);
        }
        return info;
    }

    /**
     * make a deferred native function
     */
    export function make():AnyFunction {
        function nf(this:unknown):any {
            return (nf[nativeCall] || makeFunctionNativeCall(nf)).apply(this, arguments);
        }
        nf.isNativeFunction = true;
        return nf;
    }
}
