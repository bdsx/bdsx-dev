
enum TypeCode {
    Integer,
    True,
    False,
    Type,
    Array,
    ArrayEnd,
}

declare global {
    interface Function {
        [serializeTypes.typeId]?:number;
    }
}

export function serializeTypes(args:ArrayLike<any>):string {
    const out:number[] = [];
    function leb128(n:number):void {
        while (n >= 0x80) {
            out.push(n & 0x7f);
            n >>= 7;
        }
        out.push(n);
    }
    function writeType(type:{[serializeTypes.typeId]?:number, name?:string}):void {
        const typeidx = type[serializeTypes.typeId];
        if (typeidx == null) throw Error(`${type}: no typeId`);
        leb128(typeidx);
    }
    function write(args:ArrayLike<any>):void {
        const n = args.length;
        for (let i=0;i<n;i++) {
            const arg = args[i];
            if (arg instanceof Array) {
                out.push(TypeCode.Array);
                write(arg);
                out.push(TypeCode.ArrayEnd);
            }
            switch (typeof arg) {
            case 'boolean':
                out.push(arg ? TypeCode.True : TypeCode.False);
                break;
            case 'number':
                out.push(TypeCode.Integer);
                leb128(arg);
                break;
            case 'function':
            case 'object':
                out.push(TypeCode.Type);
                writeType(arg);
                break;
            default:
                throw Error(`unsupported type ${typeof arg}`);
            }
        }
    }
    write(args);
    return String.fromCharCode(...out);
}

export namespace serializeTypes {
    export const typeId = Symbol('key');
}
