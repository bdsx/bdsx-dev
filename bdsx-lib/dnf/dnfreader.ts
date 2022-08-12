import { AnyFunction, unreachable } from "../common";
import { defineNativeField, makeAddressGetter, makeNativeGetter, NativeFunctionType, NativeTemplateClass } from "../complextype";
import { NativePointer } from "../core";
import { dll } from "../dll";
import { dnf } from "./dnf";
import { dnfdb } from "./dnftypes";
import { MakeFuncOptions } from "../makefunc";
import { NativeClass, NativeClassType } from "../nativeclass";
import { NativeType, Type } from "../nativetype";
import { serializeTypes } from "../typeserializer";
import { isBaseOf } from "../util";
import { DataFileStream } from "../writer/datafilestream";
import fs = require('fs');

type ClassItem = NativeClassType<NativeClass>;
type TemplateClassItem = typeof NativeTemplateClass;
interface ItemInfo {
    id:number;
    name:string;
    value:any;
    type:dnfdb.ItemType;
}
const nullItemInfo:ItemInfo = {
    id: -1,
    name: 'null',
    value: null,
    type: dnfdb.ItemType.Null
};
Object.freeze(nullItemInfo);

interface SerializableType {
    name:string;
    [serializeTypes.typeId]?:number;
}

function combine(...args:Record<string, SerializableType>[]):Map<string, SerializableType> {
    const out = new Map<string, SerializableType>();
    for (const m of args) {
        for (const key in m) {
            out.set(key, m[key] as any);
        }
    }
    return out;
}

const combined = combine(
    require('../nativetype'),
    require('../core'),
    require('../pointer'),
    require('../cxxvector'),
    require('../complextype'),
    require('../nativeclass'),
    require('../sharedpointer'),
    require('../jsonvalue'));

export class DNFDB extends DataFileStream {
    private readonly map = new Map<number, ItemInfo>();
    private readonly addressTable:Int32Array;
    private readonly offsets = new Int32Array(dnfdb.ItemType.Count);

    constructor(filePath:string) {
        super(fs.openSync(filePath, 'r'));
        const version = this.readInt32();
        if (version !== dnfdb.VERSION) throw Error(`Version mismatch(actual=${version}, expected=${dnfdb.VERSION})`);
        this.readBuffer(this.offsets, 0, this.offsets.byteLength);

        let total = 0;
        for (let i=0;i<dnfdb.ItemType.Count;i++) {
            const count = this.offsets[i];
            this.offsets[i] = total;
            total += count;
        }

        this.map.set(0, nullItemInfo);
        const nativeTypeOffset = this.offsets[dnfdb.ItemType.NativeType];
        for (let i=0;i<dnfdb.nativeTypes.length;i++) {
            const name = dnfdb.nativeTypes[i];
            const type = combined.get(name);
            if (type == null) {
                throw Error(`${name} not found`);
            }
            const typeId = nativeTypeOffset + i;
            type[serializeTypes.typeId] = typeId;

            this.map.set(typeId, {
                id: typeId,
                name: type.name,
                value: type,
                type: dnfdb.ItemType.NativeType,
            });
        }
        this.addressTable = new Int32Array(total);
        this.readBuffer(this.addressTable, 0, this.addressTable.byteLength);
    }

    private _getTypeFromId(id:number):dnfdb.ItemType {
        for (let i=0;i<dnfdb.ItemType.Count;i++) {
            if (id < this.offsets[i]) {
                return (i-1) as dnfdb.ItemType;
            }
        }
        throw Error(`id out of range(id=${id})`);
    }

    private _seekId(key:string):number {
        const hashv = dnfdb.hash(key);
        let count = this.readLeb128();
        if (count === 0) return -1;
        const offset = this.tell();
        let start = hashv % count;
        for (;;) {
            this.seek(offset+start*8);
            for (let i=start;i<count;i++) {
                const id = this.readInt32();
                const hashmatch = this.readInt32() >>> 0;
                if (hashmatch !== hashv) continue;
                if (id === -1) continue;
                const fp = this.tell();
                this.seek(this.addressTable[id]);
                const name = this.readString();
                if (name === key) {
                    return id;
                } else {
                    this.seek(fp);
                }
            }
            if (start === 0) return -1;
            count = start;
            start = 0;
        }
    }

    private _seekItem(name:string):ItemInfo|null {
        const id = this._seekId(name);
        if (id === -1) return null;
        let res = this.map.get(id);
        if (res != null) return res;
        res = this._readItemContinue(id, name);
        this.map.set(id, res);
        return res;
    }

    private _getFromId(id:number):ItemInfo {
        let res = this.map.get(id);
        if (res == null) {
            this.seek(this.addressTable[id]);
            const name = this.readString();
            res = this._readItemContinue(id, name);
            this.map.set(id, res);
        } else if (res.value === undefined) {
            this.seek(this.addressTable[id]);
            const name = this.readString();
            res.value = this._readItemContinueValue(res.type, id, name);
        }
        return res;
    }

    private _readRefHead():ItemInfo {
        const id = this.readLeb128();
        const item = this.map.get(id);
        if (item != null) return item;

        const prev = this.tell();
        this.seek(this.addressTable[id]);
        const name = this.readString();
        const parentId = this.readLeb128();
        this.seek(prev);

        const info = {
            id,
            name,
            parentId,
            value: undefined,
            type:this._getTypeFromId(id),
        };
        this.map.set(id, info);
        return info;
    }

    private _readRef():ItemInfo {
        const id = this.readLeb128();
        if (id === 0) {
            return nullItemInfo;
        }
        const item = this.map.get(id);
        if (item != null) return item;

        const prev = this.tell();
        const address = this.addressTable[id];
        if (address === -1) throw Error(`${id}: Invalid address`);
        this.seek(address);
        const name = this.readString();
        const out = this._readItemContinue(id, name);
        this.seek(prev);
        return out;
    }

    private _getProperty(target:unknown, info:ItemInfo):any {
        switch (info.type) {
        case dnfdb.ItemType.Null: throw Error(`Unexpected type: ${info.type}`);
        case dnfdb.ItemType.Variable: {
            const [type, rva] = info.value;
            if (type === null) {
                const value = dll.base.add(rva);
                Object.defineProperty(target, info.name, {value});
                return value;
            } else {
                defineNativeField(target as any, info.name, rva, type);
                return (target as any)[info.name];
            }
        }
        default: {
            const value = info.value;
            Object.defineProperty(target, info.name, {value});
            return value;
        }
        }
    }

    private _setProperty(target:unknown, info:ItemInfo, value:unknown):void {
        switch (info.type) {
        case dnfdb.ItemType.Null: throw Error(`Unexpected type: ${info.type}`);
        case dnfdb.ItemType.Variable: {
            const [type, rva] = info.value;
            if (type === null) throw Error(`${info.name}, not assignable`);
            defineNativeField(target as any, info.name, rva, type as Type<any>);
            (target as any)[info.name] = value;
            break;
        }
        default: throw Error(`${info.name}, not assignable`);
        }
    }

    private _makePropertyDescriptor(info:ItemInfo):PropertyDescriptor {
        const self = this;
        switch (info.type) {
        case dnfdb.ItemType.Null: throw Error(`Unexpected type: ${info.type}`);
        case dnfdb.ItemType.Variable:
            return {
                set(v){
                    const [type, rva] = self._getFromId(info.id).value;
                    if (type === null) throw Error(`${info.name}, not assignable`);
                    defineNativeField(this, info.name, rva, type as Type<any>);
                    (this as any)[info.name] = v;
                },
                get(){
                    const [type, rva] = self._getFromId(info.id).value;
                    if (type === null) {
                        const value = dll.base.add(rva);
                        Object.defineProperty(this, info.name, {value});
                        return value;
                    } else {
                        defineNativeField(this, info.name, 0, type as Type<any>);
                        return (this as any)[info.name];
                    }
                },
                configurable: true
            };
        default:
            return {
                get(){
                    const value = self._getFromId(info.id).value;
                    Object.defineProperty(this, info.name, {value});
                    return value;
                },
                configurable: true
            };
        }
    }

    private _readNamespaceTo<T>(object:T):T {
        const offset = this.tell();
        const self = this;
        const proxyBack:any = new Proxy({}, {
            set(_, name:string, value):boolean {
                self.seek(offset);
                const info = self._seekItem(name);
                if (info === null) {
                    Object.defineProperty(object, name, {value:value, writable: true});
                    return true;
                }
                self._setProperty(object, info, value);
                return true;
            },
            get(_, name:string){
                self.seek(offset);
                const info = self._seekItem(name);
                if (info === null) throw Error(`${name} is not defined`);
                return self._getProperty(object, info);
            }
        });
        Object.setPrototypeOf(object, proxyBack);
        return object;
    }

    private _readNamespace(id?:number):any {
        const out:any = this._readNamespaceTo({});
        if (id != null) out[serializeTypes.typeId] = id;
        return out;
    }

    private _readClassStaticContainer(target:unknown):void {
        const properties:Record<string|symbol, PropertyDescriptor> = {};
        for (;;) {
            const info = this._readRefHead();
            if (info === nullItemInfo) break;
            properties[info.name] = this._makePropertyDescriptor(info);
        }
        Object.defineProperties(target, properties);
    }

    private _readClassPropertyContainer(target:unknown):void {
        const self = this;

        const properties:Record<string|symbol, PropertyDescriptor> = {};

        for (;;) {
            const info = this._readRefHead();
            switch (info.type) {
            case dnfdb.ItemType.Null:
                Object.defineProperties(target, properties);
                return;
            case dnfdb.ItemType.Function:
                if (info.name === '.ctor') {
                    properties[NativeType.ctor] = properties.constructWith = {
                        get(){
                            const value = self._getFromId(info.id).value;
                            Object.defineProperties(target, {
                                constructWith:{value},
                                [NativeType.ctor]:{value}
                            });
                            return value;
                        },
                        configurable: true
                    };
                } else {
                    properties[info.name] = {
                        get(){
                            const value = self._getFromId(info.id).value;
                            Object.defineProperty(target, info.name, {value});
                            return value;
                        },
                        configurable: true
                    };
                }
                break;
            default: unreachable();
            }
        }
    }

    private _readClass(id:number, className:string):ClassItem {
        const parentClassRef = this._readRef();
        let parentClass:ClassItem = (parentClassRef.value as ClassItem);
        switch (parentClassRef.type) {
        case dnfdb.ItemType.NativeType:
            if (!isBaseOf(parentClass, NativeClass)) {
                throw Error(`${parentClass} is not class`);
            }
            break;
        case dnfdb.ItemType.Class: break;
        case dnfdb.ItemType.Null: parentClass = NativeClass; break;
        default: throw Error(`${parentClass} is not class`);
        }
        class Class extends parentClass {
            static readonly [serializeTypes.typeId] = id;
        }
        Object.defineProperties(Class, {
            name: {value:className},
        });
        this._readClassStaticContainer(Class);
        this._readClassPropertyContainer(Class.prototype);
        return Class as ClassItem;
    }

    private _readStaticObject():Record<string, unknown> {
        const out:Record<string, unknown> = {};
        for (;;) {
            const info = this._readRef();
            if (info === nullItemInfo) break;
            out[info.name] = info.value;
        }
        return out;
    }

    private _readTemplateClass(id:number, className:string):TemplateClassItem {
        const parentClassRef = this._readRef();
        let parentClass:TemplateClassItem = parentClassRef.value as TemplateClassItem;
        if (parentClass !== NativeClass) {
            switch (parentClassRef.type) {
            case dnfdb.ItemType.Class: break;
            case dnfdb.ItemType.Null: parentClass = NativeTemplateClass; break;
            default: throw Error(`${parentClass} is not class`);
            }
        }
        const that = this;
        class Class extends parentClass {
            static readonly [serializeTypes.typeId] = id;
            static make(...items:any[]):any {
                const key = serializeTypes(items);
                const found = Class._makeGet(key);
                if (found != null) return found;

                that.seek(serializedTable);
                const item = that._seekItem(key);
                if (item === null) {
                    const out = NativeTemplateClass._make(items);
                    Class._makeSet(key, out);
                    return out;
                }
                Class._makeSet(key, item.value as any);
                return item.value;
            }
        }
        Object.defineProperties(Class, {
            name: {value:className},
        });
        const serializedTable = this.tell();
        this._readClassStaticContainer(Class);
        return Class;
    }

    private _readTemplateType(id:number):TemplateClassItem {
        const typeInfo = this._readRef();
        const type = typeInfo.value;
        const params = this._readRefValues();
        const out = type.make(...params);
        out[serializeTypes.typeId] = id;
        this._readClassStaticContainer(out);
        this._readClassPropertyContainer(out.prototype);
        return out;
    }

    private _readRefType(id:number):NativeType<any> {
        const type = this._readRef().value as {ref():any};
        if (!isBaseOf(type, NativeClass)) throw Error(`${type} is not NativeClass`);
        const reftype = type.ref();
        reftype[serializeTypes.typeId] = id;
        return reftype;
    }

    private _readFunctionOptions():MakeFuncOptions<any>|null {
        const [hasThisType, isStructureReturn] = this.readBooleans(2);
        if (!hasThisType && !isStructureReturn) return null;
        const out:MakeFuncOptions<any> = {};
        if (hasThisType) {
            out.this = this._readRef().value;
        }
        if (isStructureReturn) {
            out.structureReturn = true;
        }
        return out;
    }

    private _readFunction(id:number):AnyFunction {
        const offset = this.tell();
        const fn = dnf.make(()=>{
            this.seek(offset);
            return this._readRefValues();
        });
        fn[serializeTypes.typeId] = id;
        return fn;
    }

    private _readFunctionType(id:number):NativeFunctionType<AnyFunction> {
        const returnType = this._readRef();
        if (!dnfdb.isType(returnType.type)) throw Error(`is not type`);
        if (returnType === null) throw Error(`function type - null return`);
        const opts = this._readFunctionOptions();
        const params = this._readRefValues();
        const fntype = NativeFunctionType.make(returnType.value as Type<any>, opts, ...params);
        fntype[serializeTypes.typeId] = id;
        return fntype;
    }

    private _readRefValues():any[]{
        const out:any[] = [];
        for (;;) {
            const type = this._readRef();
            if (type === null) return out;
            if (!dnfdb.isType(type.type)) throw Error(`is not type`);
            out.push(type.value);
        }
    }

    private _readRedirect():ItemInfo{
        return this._readRef();
    }

    private _readVariable():[Type<any>|null, number] {
        const type = this._readRef().value;
        const rva = this.readLeb128();
        return [type as Type<any>, rva];
    }

    private _readAddress():NativePointer {
        const rva = this.readLeb128();
        return dll.base.add(rva);
    }

    private _readVariableGetter(name:string):AnyFunction {
        const out:[number, Type<any>, string][] = [];
        for (;;) {
            const rva = this.readLeb128();
            if (rva === 0) break;
            const type = this._readRef().value;
            if (type === null) throw Error(`${name}, null type variable`);
            const tparams = this.readString();
            out.push([rva, type as Type<any>, tparams]);
        }
        return makeNativeGetter(name, out);
    }

    private _readAddressGetter(name:string):AnyFunction {
        const out:[number, string][] = [];
        for (;;) {
            const rva = this.readLeb128();
            if (rva === 0) break;
            const tparams = this.readString();
            out.push([rva, tparams]);
        }
        return makeAddressGetter(name, out);
    }

    private _readFunctionOverload():AnyFunction {
        const rva = this.readLeb128();
        const params = this._readRefValues();
        const returnType = this._readRef().value;
        if (returnType === null) throw Error(`function - null return`);
        const opts = this._readFunctionOptions();
        const info:dnf.OverloadInfo = [rva, params, returnType as Type<any>, opts];

        const templateParams = this.readString();
        if (templateParams !== '') info[4] = templateParams;

        return dnf.makeOverload(info);
    }

    private _readItemContinueValue(type:dnfdb.ItemType, id:number, name:string):any {
        let out:ItemInfo;
        switch (type) {
        case dnfdb.ItemType.Null: return null;
        case dnfdb.ItemType.StaticObject: return this._readStaticObject();
        case dnfdb.ItemType.Class: return this._readClass(id, name);
        case dnfdb.ItemType.TemplateClass: return this._readTemplateClass(id, name);
        case dnfdb.ItemType.TemplateType: return this._readTemplateType(id);
        case dnfdb.ItemType.Function: return this._readFunction(id);
        case dnfdb.ItemType.FunctionOverload: return this._readFunctionOverload();
        case dnfdb.ItemType.FunctionType: return this._readFunctionType(id);
        case dnfdb.ItemType.Namespace: return this._readNamespace(id);
        case dnfdb.ItemType.Variable: return this._readVariable();
        case dnfdb.ItemType.AddressVariable: return this._readAddress();
        case dnfdb.ItemType.VariableGetter: return this._readVariableGetter(name);
        case dnfdb.ItemType.AddressGetter: return this._readAddressGetter(name);
        case dnfdb.ItemType.TypeList: return this._readRefValues();
        case dnfdb.ItemType.Ref: return this._readRefType(id);
        case dnfdb.ItemType.Redirect:
            out = this._readRedirect();
            break;
        default:
            unreachable();
        }
        return out;
    }

    private _readItemContinue(id:number, name:string):ItemInfo {
        const type = this._getTypeFromId(id);
        if (type === dnfdb.ItemType.Null) return nullItemInfo;
        const value = this._readItemContinueValue(type, id, name);
        return { id, name, type, value };
    }

    readNamespace(target?:unknown):any {
        if (target != null) return this._readNamespaceTo(target);
        else return this._readNamespace();
    }
}
