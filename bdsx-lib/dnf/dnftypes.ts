
export namespace dnfdb {
    export const VERSION = 0;
    export const nativeTypes = [
        'void_t',
        'bool_t',
        'int8_t',
        'int16_t',
        'int32_t',
        'int64_as_float_t',
        'uint8_t',
        'uint16_t',
        'uint32_t',
        'uint64_as_float_t',
        'bin64_t',
        'float32_t',
        'float64_t',
        'VoidPointer',
        'StaticPointer',
        'NativePointer',
        'CxxString',
        'CxxVector',
        'NativeType',
        'NativeTemplateClass',
        'NativeFunctionType',
        'MemberPointer',
        'MantleClass',
        'NativeClass',
        'Ptr',
        'SharedPtr',
        'EnumType',
        'PointerLike',
        'CxxVectorToArray',
        'GslStringSpan',
        'Wrapper',
        'JsonValue', //
        'StringAnsi',
        'StringUtf8',
        'StringUtf16',
        'nullptr_t',
        'NativeVarArgs',
        'CxxStringWrapper',
    ] as const;

    export type NativeTypeName = (typeof dnfdb.nativeTypes)[number] ;

    export const nativeTypesMap = new Map<string, number>();
    for (let i=0;i<nativeTypes.length;i++) {
        nativeTypesMap.set(nativeTypes[i], i);
    }

    export enum ItemType {
        Null,
        NativeType,
        Class,
        TemplateClass,
        TemplateType,
        Namespace,
        StaticObject,
        Function,
        FunctionOverload,
        FunctionType,
        Variable,
        VariableOverload,
        AddressVariable,
        VariableGetter,
        AddressGetter,
        TypeList,
        Ref,
        Redirect,
        Count,
    }

    export function hash(v:string):number {
        const n = v.length;
        let out = 0;
        let shift = 0;
        for (let i=0;i<n;i++) {
            const chr = (v.charCodeAt(i) + i) | 0;
            out = (out + ((chr << shift) | (chr >>> (32-shift)))) | 0;
            shift = (shift + 7) & 0x1f;
        }
        out = (out + n) | 0;
        return out >>> 0;
    }

    export function isClassStaticItem(type:ItemType):boolean {
        switch (type) {
        case ItemType.Null:
        case ItemType.Class:
        case ItemType.TemplateClass:
        case ItemType.VariableGetter:
        case ItemType.Variable:
        case ItemType.AddressVariable:
        case ItemType.AddressGetter:
        case ItemType.Function:
        case ItemType.Namespace:
        case ItemType.StaticObject:
            return true;
        default:
            return false;
        }
    }

    export function isClassPropertyItem(type:ItemType):boolean {
        switch (type) {
        case ItemType.Null:
        case ItemType.Function:
            return true;
        default:
            return false;
        }
    }

    export function isType(type:ItemType):boolean {
        switch (type) {
        case ItemType.Class:
        case ItemType.TemplateClass:
        case ItemType.NativeType:
        case ItemType.FunctionType:
        case ItemType.TypeList:
            return true;
        default:
            return false;
        }
    }
}
