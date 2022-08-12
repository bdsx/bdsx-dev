import { AnyFunction, notImplemented } from "./common";
import { NativePointer, StaticPointer, VoidPointer, VoidPointerConstructor } from "./core";
import { dll } from "./dll";
import { FunctionFromTypes_js_without_pointer, makefunc, MakeFuncOptions, ParamType } from "./makefunc";
import { NativeClass } from "./nativeclass";
import { int32_t, NativeType, Type as TypeId } from "./nativetype";
import { Singleton } from "./singleton";
import { serializeTypes } from "./typeserializer";

const specializedList = Symbol('specializedList');

interface TemplateClassConstructor {
    templates:any[];
    new():NativeTemplateClass;
}

export class NativeTemplateClass extends NativeClass {
    static readonly templates:any[];
    private static [specializedList]?:Map<string, TemplateClassConstructor>;
    protected static _makeGet(key:string):any {
        const list = this[specializedList];
        if (list == null) {
            return undefined;
        } else {
            return list.get(key);
        }
    }
    protected static _makeSet(key:string, value:TemplateClassConstructor):void {
        let list = this[specializedList];
        if (list == null) {
            list = this[specializedList] = new Map;
        }
        list.set(key, value);
    }
    protected static _make(items:any[]):any {
        const cls = this;
        const name = `${cls.name}<${items.map(item=>item.name || item.toString()).join(',')}>`;
        class Class extends cls {
            static readonly templates = items;
        }
        Object.defineProperty(Class, 'name', {value:name});
        return Class;
    }
    static make(...items:any[]):any{
        const key = serializeTypes(items);
        let list = this[specializedList];
        if (list == null) {
            this[specializedList] = list = new Map;
        } else {
            const found = list.get(key);
            if (found != null) return found;
        }
        const cls = this._make(items);
        list.set(key, cls);
        return cls;
    }
}

const baseAddress = dll.base;

type TemplateFieldInfo = [number, TypeId<any>, string];
export function makeNativeGetter(name:string, infos:TemplateFieldInfo[]):AnyFunction {
    const fnmap:Record<string, TemplateFieldInfo> = Object.create(null);
    for (const info of infos) {
        fnmap[info[2]] = info;
    }
    function fn():any{
        const key = serializeTypes(arguments);
        const info = fnmap[key];
        if (info == null) throw Error(`overload not found`);
        const [rva, type] = info;
        return type[NativeType.getter](dll.base, rva);
    }
    Object.defineProperty(fn, 'name', {value: name});
    return fn;
}
export function makeNativeSetter(name:string, infos:TemplateFieldInfo[]):AnyFunction {
    const fnmap:Record<string, TemplateFieldInfo> = Object.create(null);
    for (const info of infos) {
        fnmap[info[2]] = info;
    }
    function fn(...args:unknown[]):void{
        const value = args.pop();
        const key = serializeTypes(args);
        const info = fnmap[key];
        if (info == null) throw Error(`overload not found`);
        const [rva, type] = info;
        return type[NativeType.setter](dll.base, value, rva);
    }
    Object.defineProperty(fn, 'name', {value: name});
    return fn;
}
type AddressTemplateFieldInfo = [number, string];
export function makeAddressGetter(name:string, infos:AddressTemplateFieldInfo[]):AnyFunction {
    const fnmap:Record<string, AddressTemplateFieldInfo> = Object.create(null);
    for (const info of infos) {
        fnmap[info[1]] = info;
    }
    function nf():NativePointer{
        const key = serializeTypes(arguments);
        const info = fnmap[key];
        if (info == null) throw Error(`overload not found`);
        const [rva] = info;
        return dll.base.add(rva);
    }
    Object.defineProperty(nf, 'name', {value:name});
    return nf;
}
export function defineNativeField<KEY extends keyof any, T>(target:{[key in KEY]:T}, key:KEY, rva:number, type:TypeId<T>):void {
    Object.defineProperty(target, key, {
        get():T {
            return type[NativeType.getter](baseAddress, rva);
        },
        set(value:T):void {
            return type[NativeType.setter](baseAddress, value, rva);
        }
    });
}

let warned = false;
function warn():void {
    if (warned) return;
    warned = true;
    console.log(`NativeFunctionType has potential for memory leaks.`);
}
export class NativeFunctionType<T extends (...args:any[])=>any> extends NativeType<T>{
    parameterTypes:ParamType[];
    returnType:ParamType;
    options:MakeFuncOptions<any>|null;

    static make<OPTS extends MakeFuncOptions<any>|null, RETURN extends makefunc.Paramable, PARAMS extends makefunc.Paramable[]>(
        returnType:RETURN,
        opts?: OPTS,
        ...params: PARAMS):NativeFunctionType<FunctionFromTypes_js_without_pointer<OPTS, PARAMS, RETURN>> {

        const makefunc_np = Symbol();
        type Func = FunctionFromTypes_js_without_pointer<OPTS, PARAMS, RETURN> & {[makefunc_np]?:VoidPointer};
        function getNp(func:Func):VoidPointer {
            const ptr = func[makefunc_np];
            if (ptr != null) return ptr;
            warn();
            console.log(`a function(${ptr}) is allocated.`);
            return func[makefunc_np] = makefunc.np(func as any, returnType, opts, ...params);
        }
        function getJs(ptr:VoidPointer):Func {
            return makefunc.js(ptr, returnType, opts, ...params);
        }
        return new NativeFunctionType<Func>(
            `${returnType.name} (__cdecl*)(${params.map(param=>param.name).join(',')})`,
            8, 8,
            v=>v instanceof Function,
            undefined,
            (ptr, offset)=>getJs(ptr.add(offset, offset!>>31)),
            (ptr, value, offset)=>{
                const nativeproc = getNp(value);
                ptr.setPointer(nativeproc, offset);
                return nativeproc;
            },
            (stackptr, offset)=>getJs(stackptr.getPointer(offset)),
            (stackptr, param, offset)=>stackptr.setPointer(getNp(param), offset));
    }
}

export interface MemberPointerType<B, T> extends VoidPointerConstructor {
}

export class MemberPointer<B, T> extends VoidPointer {
    base:TypeId<B>;
    type:TypeId<T>;

    static make<B, T>(base:TypeId<B>, type:TypeId<T>):MemberPointerType<B, T> {
        class MemberPointerImpl extends MemberPointer<B, T> {
        }
        MemberPointerImpl.prototype.base = base;
        MemberPointerImpl.prototype.type = type;
        return MemberPointerImpl;
    }
}

function unexpected():never {
    throw Error('Unexpected usage');
}

export class NativeVarArgs {
    public offset = 0;
    constructor(
        public readonly stackptr:StaticPointer,
        private readonly startOffset:number) {
        this.offset = this.startOffset;
    }

    static readonly [makefunc.useXmmRegister] = false;
    static isTypeOf(v:unknown):v is NativeVarArgs {
        return v instanceof NativeVarArgs;
    }
    static isTypeOfWeak(v:unknown):v is NativeVarArgs {
        return v instanceof NativeVarArgs;
    }
    static [makefunc.getter](ptr:StaticPointer, offset?:number):NativeVarArgs {
        unexpected();
    }
    static [makefunc.setter](ptr:StaticPointer, param:NativeVarArgs, offset?:number):void {
        unexpected();
    }
    static [makefunc.getFromParam](stackptr:StaticPointer, offset?:number):NativeVarArgs {
        return new NativeVarArgs(stackptr, offset || 0);
    }
    static [makefunc.setToParam](stackptr:StaticPointer, param:NativeVarArgs, offset?:number):void {
        notImplemented();
    }
    static [makefunc.ctor_move](to:StaticPointer, from:StaticPointer):void {
        unexpected();
    }
    static [makefunc.dtor](ptr:StaticPointer):void {
        unexpected();
    }
    static get [makefunc.size]():number {
        unexpected();
        return 0;
    }
}

export class EnumType<T> extends NativeType<T> {
    private constructor() {
        super(
            int32_t.name,
            int32_t[NativeType.size],
            int32_t[NativeType.align],
            int32_t.isTypeOf, int32_t.isTypeOfWeak,
            int32_t[NativeType.getter] as any,
            int32_t[NativeType.setter] as any,
            int32_t[makefunc.getFromParam] as any,
            int32_t[makefunc.setToParam] as any);
    }
    static make<T>(enumtype:T):EnumType<T[keyof T]> {
        return Singleton.newInstance(EnumType, enumtype, ()=>new EnumType<T[keyof T]>());
    }
}
