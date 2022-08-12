import { Json } from "..";
import { EnumType } from "../../complextype";
import { StaticPointer } from "../../core";
import { dnf } from "../../dnf/dnf";
import { bool_t, CxxString, int32_t, NativeType, StringUtf8 } from "../../nativetype";

declare module ".." {
    namespace Json {
        interface Value {
            [NativeType.ctor]():void;
            constructWith(value:unknown):void;
            get(key:string|number):Json.Value;
            getValue():any;
            setValue(value:unknown):void;
            toString():string;
            toJSON():any;
        }
        namespace Value {
            function constructWith(value:unknown):Value;
        }
    }
}

Json.Value.define({}, 0x10, 0x8);

Json.Value.constructWith = function(value:unknown):Json.Value {
    const json = new Json.Value(true);
    json.constructWith(value);
    return json;
};

Json.Value.prototype[NativeType.ctor] = function():void {
    const ptr:StaticPointer = this as any;
    ptr.setUint8(Json.ValueType.Null, 8);
};
console.log(Json.Value.prototype.constructWith);
dnf(Json.Value, 'constructWith').set(function(value:unknown):void {
    const ptr:StaticPointer = this as any;
    switch (typeof value) {
    case 'boolean':
        ptr.setUint8(Json.ValueType.Boolean, 8);
        ptr.setBoolean(value);
        break;
    case 'number':
        if ((value|0) === value) {
            ptr.setUint8(Json.ValueType.Int32, 8);
            ptr.setInt32(value);
        } else {
            ptr.setUint8(Json.ValueType.Float64, 8);
            ptr.setFloat64(value);
        }
        break;
    case 'object':
        if (value === null) {
            ptr.setUint8(Json.ValueType.Null, 8);
        } else {
            jsonValueCtorWithType.call(this, Json.ValueType.Object);
            for (const key in value) {
                if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
                const child = jsonValueResolveReference(this, key, false);
                child.setValue((value as any)[key]);
            }
        }
        break;
    case 'string':
        jsonValueCtorWithString.call(this, value);
        break;
    default:
        throw TypeError(`unexpected json type: ${typeof value}`);
    }
});
Json.Value.prototype.get = function(key:string|number):Json.Value {
    if (typeof key === 'number') {
        if ((key|0) === key) {
            return jsonValueGetByInt.call(this, key);
        }
        key = key+'';
    }
    return jsonValueGetByString.call(this, key);
};

Json.Value.prototype.getValue = function():any {
    const ptr:StaticPointer = this as any;
    const type = this.type();
    switch (type) {
    case Json.ValueType.Null:
        return null;
    case Json.ValueType.Int32:
        return ptr.getInt32();
    case Json.ValueType.Int64:
        return ptr.getInt64AsFloat();
    case Json.ValueType.Float64:
        return ptr.getFloat64();
    case Json.ValueType.String: {
        const ptrv = ptr.getNullablePointer();
        return ptrv === null ? '' : ptrv.getString();
    }
    case Json.ValueType.Boolean:
        return ptr.getBoolean();
    case Json.ValueType.Array: {
        const out:any[] = [];
        const n = this.size();
        for (let i=0;i<n;i++) {
            out[i] = this.get(i).getValue();
        }
        return out;
    }
    case Json.ValueType.Object: {
        const out:Record<string, any> = {};
        for (const key of this.getMemberNames()) {
            out[key] = this.get(key).getValue();
        }
        return out;
    }
    default:
        throw Error(`unexpected type: ${type}`);
    }
};
Json.Value.prototype.setValue = function(value:unknown):void {
    this.destruct();
    this.constructWith(value);
};
Json.Value.prototype.toString = function():string {
    return this.getValue()+'';
};
Json.Value.prototype.toJSON = function():string {
    return this.getValue();
};

const jsonValueCtorWithType = dnf(Json.Value, 'constructWith').getByTypes(null, EnumType.make(Json.ValueType))!;
const jsonValueCtorWithString = dnf(Json.Value, 'constructWith').getByTypes(null, CxxString)!;
const jsonValueGetByInt = dnf(Json.Value, 'operator_index').getByTypes(null, int32_t)!;
const jsonValueGetByString = dnf(Json.Value, 'operator_index').getByTypes(null, StringUtf8)!;
const jsonValueResolveReference = dnf(Json.Value, 'resolveReference').reform(Json.Value, null, Json.Value, CxxString, bool_t);
