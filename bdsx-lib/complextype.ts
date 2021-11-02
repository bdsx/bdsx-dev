import { VoidPointer, VoidPointerConstructor } from "./core";
import { dll } from "./dll";
import { FunctionFromTypes_js_without_pointer, makefunc, MakeFuncOptions, ParamType } from "./makefunc";
import { NativeClass } from "./nativeclass";
import { int32_t, NativeType, Type } from "./nativetype";
import { Singleton } from "./singleton";

const specializedList = Symbol('specializedList');

function itemsEquals(items1:ArrayLike<unknown>, items2:ArrayLike<unknown>):boolean {
    const n = items1.length;
    if (n !== items2.length) return false;
    for (let i=0;i<n;i++) {
        const item1 = items1[i];
        const item2 = items2[i];
        if (item1 instanceof Array) {
            if (!(item2 instanceof Array)) return false;
            if (!itemsEquals(item1, item2)) return false;
        } else {
            if (item1 !== item2) return false;
        }
    }
    return true;
}

interface TemplateClassConstructor {
    templates:any[];
    new():NativeTemplateClass;
}

function makeTemplateClass(cls:new()=>NativeTemplateClass, items:any[]):TemplateClassConstructor {
    class SpecializedTemplateClass extends cls {
        static readonly templates = items;
    }
    Object.defineProperty(SpecializedTemplateClass, 'name', {value: `${cls.name}<${items.map(item=>item.name || item.toString()).join(',')}>`});
    return SpecializedTemplateClass;
}

export class NativeTemplateClass extends NativeClass {
    static readonly templates:any[];

    static make(this:new()=>NativeTemplateClass, ...items:any[]):any{
        let list:TemplateClassConstructor[] = (this as any)[specializedList];
        if (list == null) {
            (this as any)[specializedList] = list = [];
        } else {
            for (const cls of list) {
                if (itemsEquals(items, cls.templates)) return cls;
            }
        }
        const cls = makeTemplateClass(this, items);
        list.push(cls);
        return cls as any;
    }
}

const baseAddress = dll.base;

export class NativeTemplateVariable<T> {
    constructor(public readonly type:Type<T>, public readonly rva:number) {
    }

    get value():T {
        return this.type[NativeType.getter](baseAddress, this.rva);
    }
    set value(v:T) {
        this.type[NativeType.setter](baseAddress, v, this.rva);
    }
}

export function makeNativeGetter(infos:[number, Type<any>, any[]][]):()=>any {
    return function (){
        for (const [rva, type, args] of infos) {
            if (itemsEquals(args, arguments)) return type[NativeType.getter](dll.base, rva);
        }
        throw Error(`overload not found`);
    };
}
export function defineNativeField<KEY extends keyof any, T>(target:{[key in KEY]:T}, key:KEY, rva:number, type:Type<T>):void {
    Object.defineProperty(target, key, {
        get():T {
            return type[NativeType.getter](baseAddress, rva);
        },
        set(value:T):void {
            return type[NativeType.setter](baseAddress, value, rva);
        }
    });
}
export function defineNativeAddressField<KEY extends keyof any, T>(target:{[key in KEY]:T}, key:KEY, rva:number, type:Type<T>):void {
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
    base:Type<B>;
    type:Type<T>;

    static make<B, T>(base:Type<B>, type:Type<T>):MemberPointerType<B, T> {
        class MemberPointerImpl extends MemberPointer<B, T> {
        }
        MemberPointerImpl.prototype.base = base;
        MemberPointerImpl.prototype.type = type;
        return MemberPointerImpl;
    }
}

export const NativeVarArgs = new NativeType<any[]>(
    '...',
    0,
    0,
    ()=>{ throw Error('Unexpected usage'); },
    ()=>{ throw Error('Unexpected usage'); },
    ()=>{ throw Error('Unexpected usage'); },
    ()=>{ throw Error('Not implemented'); },
    ()=>{ throw Error('Not implemented'); },
    ()=>{ throw Error('Unexpected usage'); },
    ()=>{ throw Error('Unexpected usage'); },
    ()=>{ throw Error('Unexpected usage'); },
    ()=>{ throw Error('Unexpected usage'); }
);
export type NativeVarArgs = any[];

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
