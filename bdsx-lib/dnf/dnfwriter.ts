import * as fs from 'fs';
import { dnfdb } from "./dnftypes";
import { serializeTypes } from "../typeserializer";
import { DataFileStream } from "../writer/datafilestream";
import { unique } from "../unique";

const itemTypeSorted:dbw.Item[][] = [];
const itemIdOffsets:number[] = [];
const primitiveItems:dbw.Item[] = [];
for (let i=0;i<dnfdb.ItemType.Count;i++) {
    itemTypeSorted[i] = [];
    itemIdOffsets[i] = 0;
}

export class DBWriter extends DataFileStream {
    constructor(filePath:string) {
        super(fs.openSync(filePath, 'w'));
    }

    writeHashMap(names:Map<string, dbw.ChildItem>):void {
        const itemcount = names.size;
        this.writeLeb128(itemcount);

        const paircount = itemcount << 1;

        const keys = new Int32Array(paircount);
        for (let i=0;i<keys.length;i+=2) {
            keys[i] = -1;
        }

        for (const [name, addr] of names) {
            const hashv = dnfdb.hash(name);
            let offset = ((hashv % itemcount) << 1);
            while (keys[offset] !== -1) {
                offset = (offset + 2) % paircount;
            }
            keys[offset++] = addr.getId();
            keys[offset] = hashv;
        }
        this.writeBuffer(keys);
    }

    writeRef(type:dbw.Item|null):void {
        this.writeLeb128(type !== null ? type.getId() : 0);
    }

    writeRefs(types:Iterable<dbw.Item>):void{
        for (const type of types) {
            this.writeRef(type);
        }
        this.writeRef(null);
    }

    writeFunctionOptions(opts:dbw.FuncOptions|null):void {
        if (opts == null) {
            this.writeBooleans([
                false, false
            ]);
            return;
        }
        this.writeBooleans([
            opts.this != null,
            opts.structureReturn || false
        ]);
        if (opts.this != null) {
            this.writeRef(opts.this);
        }
    }

    save():void {
        // update id, count items
        const items = dbw.Item.getAll();

        dbw.root._replacePlaceHolder();
        dbw.Item.resetIterating(items);

        for (const item of items) {
            item.updateIdIndex();
        }

        const counts = new Int32Array(dnfdb.ItemType.Count);
        let itemIdOffset = 0;
        for (let i=0;i<dnfdb.ItemType.Count;i++) {
            itemIdOffsets[i] = itemIdOffset;
            const count = itemTypeSorted[i].length;
            counts[i] = count;
            itemIdOffset += count;
        }
        for (const item of items) {
            item.updateId();
        }

        // version
        this.writeInt32(dnfdb.VERSION);

        // address count map
        this.writeBuffer(counts);

        let totalCount = 0;
        for (const n of counts) {
            totalCount += n;
        }
        if (totalCount !== items.length) throw Error(`count mismatch (total=${totalCount}, items.length=${items.length})`);

        // address map
        const addressMapPointer = this.tell();
        const addresses = new Int32Array(items.length);
        this.writeBuffer(addresses);

        // content
        dbw.root.writeAsMap();

        // db
        for (const item of items) {
            item.import();
        }

        // back to address map
        let errorCount = 0;
        let itemIndex = 0;
        for (const array of itemTypeSorted) {
            for (const item of array) {
                if (item.address === 0) {
                    console.error(`${item}: not imported`);
                    errorCount++;
                }
                addresses[itemIndex++] = item.address;
            }
        }
        if (errorCount !== 0) process.exit(-1);

        this.seek(addressMapPointer);
        this.writeBuffer(addresses);
        this.close();
    }
}

let instance:DBWriter;

interface ItemHasOuter {
    name:string;
    outer:dbw.Container|null;
}

function getFullNameFromItem(item:ItemHasOuter):string {
    if (item.outer === null) return 'null.'+item.name;
    if (item.outer === dbw.root) return item.name;
    return item.outer.getFullName()+'.'+item.name;
}

function replacePlaceHolderOfMap<T extends dbw.Item>(items:Map<string, T>):void {
    for (const [key, item] of items) {
        const replaced = item._replacePlaceHolder();
        if (replaced !== item) {
            items.set(key, replaced as T);
        }
    }
}

function replacePlaceHolderOfArray<T extends dbw.Item>(items:T[]):boolean {
    let replacedRes = false;
    const n = items.length;
    for (let i=0;i<n;i++) {
        const item = items[i];
        const replaced = item._replacePlaceHolder();
        if (replaced !== item) {
            items[i] = item;
            replacedRes = true;
        }
    }
    return replacedRes;
}

export namespace dbw {
    export function create(filename:string):void {
        instance = new DBWriter(filename);
    }

    export function save():void {
        instance.save();
    }

    export interface FuncOptions {
        this?:Item;
        structureReturn?:boolean;
    }

    export abstract class Item {
        [serializeTypes.typeId]?:number;

        public idIndex:number = -1;
        public address:number = 0;

        protected iterating = false;

        getContainer():Container {
            throw Error(`${this} does not have the container`);
        }

        getPropertyContainer():Container {
            throw Error(`${this} does not have the property container`);
        }

        member(key:string):Item {
            return this.getContainer().member(key);
        }

        import():void {
            if (this.idIndex === -1) throw Error(`${this}: idIndex not defined`);
            if (this.address !== 0) return;
            this.writeToDb();
        }

        writeToDb():void {
            if (this.idIndex === -1) throw Error(`${this}: idIndex not defined`);
            if (this.address !== 0) {
                throw Error(`${this}: already written`);
            }
            this.address = instance.tell();
        }

        getFullName():string {
            return 'object';
        }
        toString():string {
            return `[${this.getFullName()}:${this.constructor.name}]`;
        }

        getId():number {
            const typeId = this[serializeTypes.typeId];
            if (typeId == null) throw Error(`${this}: id not defined`);
            return typeId;
        }

        _getAll(list:Item[]):void {
            if (this.iterating) return;
            this.iterating = true;
            list.push(this);
        }
        _replacePlaceHolder():this {
            this.iterating = true;
            return this;
        }

        updateIdIndex():void {
            const type = this.getType();
            const array = itemTypeSorted[type];
            this.idIndex = array.length;
            array.push(this);
        }

        updateId():void {
            const type = this.getType();
            this[serializeTypes.typeId] = itemIdOffsets[type] + this.idIndex;
        }

        abstract getType():dnfdb.ItemType;

        static getAll():Item[] {
            const items:Item[] = [];
            for (const item of primitiveItems) {
                item._getAll(items);
            }
            root._getAll(items);
            Item.resetIterating(items);
            return items;
        }

        static resetIterating(items:Item[]):void {
            for (const item of items) {
                item.iterating = false;
            }
        }
    }
    export abstract class PrimitiveItem extends Item {
        constructor(typeIndex:number) {
            super();
            this.address = -1;
            this.idIndex = typeIndex;
            itemTypeSorted[this.getType()][typeIndex] = this;
            primitiveItems.push(this);
        }

        updateIdIndex():void {
            // updated on the init phase
        }
    }
    export class NullItem extends PrimitiveItem {
        constructor() {
            super(0);
        }

        getType(): dnfdb.ItemType {
            return dnfdb.ItemType.Null;
        }
    }
    export class NativeType extends PrimitiveItem {
        getType():dnfdb.ItemType {
            return dnfdb.ItemType.NativeType;
        }

        writeToDb():void {
            // nothing to write
        }

        static make(typeNameOrId:string|number):NativeType {
            if (typeof typeNameOrId === 'string') {
                const id = dnfdb.nativeTypesMap.get(typeNameOrId);
                if (id == null) {
                    throw Error(`${typeNameOrId} is not a reserved native type`);
                }
                typeNameOrId = id;
            }
            return unique.make(NativeType, typeNameOrId);
        }
    }
    export abstract class ChildItem extends Item implements ItemHasOuter {
        constructor(
            public readonly outer:Container,
            public readonly name:string) {
            super();

            const container = outer.getContainer();
            if (!container.isAvailableItem(this)) {
                throw Error(`${container} cannot contains ${this}`);
            }
            const oldone = container.items.get(name);
            if (oldone != null) {
                if (oldone instanceof PlaceHolder) {
                    oldone.replacedTo = this;
                    container.items.set(name, oldone);
                } else {
                    throw Error(`already exists (old=${oldone}, new=${this})`);
                }
            }
            container.items.set(name, this);
        }

        _getAll(list:Item[]):void {
            if (this.iterating) return;
            super._getAll(list);
            const owner = this.outer.owner;
            if (owner != null) {
                owner._getAll(list);
            }
        }
        _replacePlaceHolder():this {
            this.iterating = true;
            return this;
        }

        writeToDb():void {
            super.writeToDb();
            instance.writeString(this.name);
        }

        getFullName():string {
            return getFullNameFromItem(this);
        }
    }
    export const nullItem = new NullItem;

    export class Container implements ItemHasOuter {
        public readonly items = new Map<string, ChildItem>();

        constructor(
            public readonly outer:Container|null,
            public readonly name:string,
            public owner:Item|null) {
        }

        member(key:string):Item {
            const items = this.items;
            let item = items.get(key);
            if (item == null) {
                item = new PlaceHolder(this, key);
                items.set(key, item);
            }
            return item;
        }

        isAvailableItem(item:ChildItem):boolean {
            return true;
        }
        getContainer():Container {
            return this;
        }

        _getAll(list:Item[]):void {
            for (const item of this.items.values()) {
                item._getAll(list);
            }
        }
        _replacePlaceHolder():void {
            replacePlaceHolderOfMap(this.items);
        }
        writeAsMap():void {
            instance.writeHashMap(this.items);
        }
        writeAsList():void {
            instance.writeRefs(this.items.values());
        }

        getFullName():string {
            return getFullNameFromItem(this);
        }

        toString():string {
            if (this.owner === null) return '[unknown Container]';
            return `[${this.owner.getFullName()}:Container]`;
        }
    }
    export class RootContainer extends Container {
        constructor() {
            super(null, '[root]', null);
        }
        getOwnerId(): number {
            return nullItem.getId();
        }
    }
    export abstract class HasContainer extends ChildItem {
        constructor(outer:Container, name:string,
            protected readonly container:Container) {
            super(outer, name);
            container.owner = this;
        }
        getContainer():Container {
            return this.container;
        }
        _getAll(list:Item[]):void {
            if (this.iterating) return;
            super._getAll(list);
            this.container._getAll(list);
        }
        _replacePlaceHolder():this {
            if (this.iterating) return this;
            super._replacePlaceHolder();
            this.container._replacePlaceHolder();
            return this;
        }
    }
    export class Namespace extends HasContainer {
        constructor(outer:Container, name:string) {
            super(outer, name, new Container(outer, name, null));
        }
        writeToDb():void {
            super.writeToDb();
            this.container.writeAsMap();
        }
        getType():dnfdb.ItemType {
            return dnfdb.ItemType.Namespace;
        }

        static make(outer:Container, name:string):Namespace {
            return unique.make(Namespace, outer, name);
        }
    }
    export class PlaceHolder extends Namespace {
        public replacedTo:Item|null = null;

        constructor(outer:Container, name:string) {
            super(outer, name);
        }
    }
    export class TemplateClass extends HasContainer {
        public readonly specialized = new Map<string, Class>();

        constructor(outer:Container, name:string, public readonly parent:Item|null) {
            super(outer, name, new ClassStaticContainer(outer, name, null));
        }
        static make(outer:Container, name:string, parent:Item|null):TemplateClass {
            return unique.make(TemplateClass, outer, name, parent);
        }
        _getAll(list:Item[]):void {
            if (this.iterating) return;
            super._getAll(list);
            for (const item of this.specialized.values()) {
                item._getAll(list);
            }
        }
        _replacePlaceHolder():this {
            if (this.iterating) return this;
            super._replacePlaceHolder();
            replacePlaceHolderOfMap(this.specialized);
            return this;
        }
        writeToDb():void {
            super.writeToDb();
            instance.writeRef(this.parent);
            instance.writeHashMap(this.specialized);
            this.container.writeAsList();
        }
        getType():dnfdb.ItemType {
            return dnfdb.ItemType.TemplateClass;
        }
    }
    class ClassStaticContainer extends Container {
        isAvailableItem(item:ChildItem):boolean {
            return dnfdb.isClassStaticItem(item.getType());
        }
    }
    class ClassPropertyContainer extends Container {
        isAvailableItem(item:ChildItem):boolean {
            return dnfdb.isClassPropertyItem(item.getType());
        }
    }
    export class StaticObject extends HasContainer {
        constructor(outer:Container, name:string) {
            super(outer, name, new ClassStaticContainer(outer, name, null));
        }
        static make(outer:Container, name:string):StaticObject {
            return unique.make(StaticObject, outer, name);
        }
        writeToDb():void {
            super.writeToDb();
            this.container.writeAsList();
        }
        getType():dnfdb.ItemType {
            return dnfdb.ItemType.StaticObject;
        }
    }
    export class Class extends HasContainer {
        public readonly propertyContainer:ClassPropertyContainer;
        constructor(outer:Container, name:string, public readonly parent:Item|null) {
            super(outer, name, new ClassStaticContainer(outer, name, null));
            this.propertyContainer = new ClassPropertyContainer(outer, 'property.'+name, this);
        }
        static make(outer:Container, name:string, parent:Item|null):Class {
            return unique.make(Class, outer, name, parent);
        }
        getPropertyContainer():Container {
            return this.propertyContainer;
        }
        _getAll(list:Item[]):void {
            if (this.iterating) return;
            super._getAll(list);
            this.propertyContainer._getAll(list);
        }
        _replacePlaceHolder():this {
            if (this.iterating) return this;
            super._replacePlaceHolder();
            this.propertyContainer._replacePlaceHolder();
            return this;
        }
        writeToDb():void {
            super.writeToDb();

            instance.writeRef(this.parent);
            for (const item of this.container.items.values()) {
                const type = item.getType();
                if (!dnfdb.isClassStaticItem(type)) {
                    throw Error(`${item} is not vaild for the class item ${this}`);
                }
            }
            for (const item of this.propertyContainer.items.values()) {
                const type = item.getType();
                if (!dnfdb.isClassPropertyItem(type)) {
                    throw Error(`${item} is not vaild for the class item ${this}`);
                }
            }
            this.container.writeAsList();
            this.propertyContainer.writeAsList();
        }
        getType():dnfdb.ItemType {
            return dnfdb.ItemType.Class;
        }
    }
    export class FunctionOverload extends Item {
        public rva:number = 0;
        public type:FunctionType;
        public templateParams:Item[] = [];

        constructor(public readonly key:unknown) {
            super();
        }

        _getAll(list:Item[]):void {
            if (this.iterating) return;
            super._getAll(list);
            this.type._getAll(list);
            for (const param of this.templateParams) {
                param._getAll(list);
            }
        }
        _replacePlaceHolder():this {
            if (this.iterating) return this;
            super._replacePlaceHolder();
            this.type = this.type._replacePlaceHolder();
            replacePlaceHolderOfArray(this.templateParams);
            return this;
        }
        writeToDb():void {
            super.writeToDb();
            instance.writeLeb128(this.rva);
            instance.writeRef(this.type);
            instance.writeString(serializeTypes(this.templateParams));
        }

        getType():dnfdb.ItemType {
            return dnfdb.ItemType.FunctionOverload;
        }

        static make(key:unknown):FunctionOverload {
            return unique.make(FunctionOverload, key);
        }
    }
    export class Function extends ChildItem {
        public readonly overloads:FunctionOverload[] = [];

        constructor(outer:Container, name:string) {
            super(outer, name);
        }

        _getAll(list:Item[]):void {
            if (this.iterating) return;
            super._getAll(list);
            for (const overload of this.overloads) {
                overload._getAll(list);
            }
        }
        _replacePlaceHolder():this {
            if (this.iterating) return this;
            super._replacePlaceHolder();
            replacePlaceHolderOfArray(this.overloads);
            return this;
        }
        writeToDb():void {
            super.writeToDb();
            for (const overload of this.overloads) {
                instance.writeRef(overload);
            }
            instance.writeLeb128(0);
        }
        getType():dnfdb.ItemType {
            return dnfdb.ItemType.Function;
        }

        static make(outer:Container, name:string):dbw.Function {
            return unique.make(Function, outer, name);
        }
    }
    export class FunctionType extends Item {
        constructor(
            public readonly returnType:Item,
            public readonly opts:FuncOptions|null,
            public readonly params:readonly Item[]) {
            super();
        }

        _getAll(list:Item[]):void {
            if (this.iterating) return;
            super._getAll(list);
            if (this.opts !== null && this.opts.this != null) {
                this.opts.this._getAll(list);
            }
            this.returnType._getAll(list);
            for (const param of this.params) {
                param._getAll(list);
            }
        }
        _replacePlaceHolder():this {
            if (this.iterating) return this;
            super._replacePlaceHolder();
            const returnType = this.returnType._replacePlaceHolder();
            const params = this.params.slice();
            const replaced = replacePlaceHolderOfArray(params);
            if (returnType !== this.returnType || replaced) {
                return FunctionType.make(returnType, this.opts, params) as this;
            }
            return this;
        }
        writeToDb():void {
            super.writeToDb();
            instance.writeRef(this.returnType);
            instance.writeFunctionOptions(this.opts);
            instance.writeRefs(this.params);
        }
        getType():dnfdb.ItemType {
            return dnfdb.ItemType.FunctionType;
        }

        static make(returnType:Item, opts:FuncOptions|null, params:Item[]):FunctionType {
            return unique.make(FunctionType, returnType, opts, params);
        }
    }
    export class TypeList extends Item {
        constructor(public readonly types:Item[]) {
            super();
        }
        _getAll(list:Item[]):void {
            if (this.iterating) return;
            super._getAll(list);
            for (const type of this.types) {
                type._getAll(list);
            }
        }
        _replacePlaceHolder():this {
            if (this.iterating) return this;
            super._replacePlaceHolder();

            const newTypes = this.types.slice();
            const replaced = replacePlaceHolderOfArray(newTypes);
            if (replaced) return TypeList.make(newTypes) as this;
            return this;
        }
        writeToDb():void {
            super.writeToDb();
            for (const type of this.types) {
                instance.writeRef(type);
            }
        }
        getType():dnfdb.ItemType {
            return dnfdb.ItemType.TypeList;
        }
        static make(types:Item[]):TypeList {
            return unique.make(TypeList, types);
        }
        getFullName(): string {
            return '['+this.types.map(v=>v.getFullName()).join(', ')+']';
        }
    }
    export class TemplateType extends Item {
        public parametersSerialized:string|null = null;
        public readonly container:Container;
        public readonly propertyContainer:Container;

        constructor(
            public readonly type:Item, public readonly parameters:readonly Item[]) {
            super();
            this.container = new Container(root, type.getFullName()+'<'+parameters.map(item=>item.getFullName()).join(', ')+'>', this);
            this.propertyContainer = new Container(root, type.getFullName()+'<'+parameters.map(item=>item.getFullName()).join(', ')+'>', this);
        }

        getContainer():Container {
            return this.container;
        }
        getPropertyContainer():Container {
            return this.propertyContainer;
        }
        _getAll(list:Item[]):void {
            if (this.iterating) return;
            super._getAll(list);
            this.container._getAll(list);
            this.propertyContainer._getAll(list);
            this.type._getAll(list);
            for (const param of this.parameters) {
                param._getAll(list);
            }
        }
        _replacePlaceHolder():this {
            if (this.iterating) return this;
            super._replacePlaceHolder();
            const type = this.type._replacePlaceHolder();
            const parameters = this.parameters.slice();
            replacePlaceHolderOfArray(parameters);

            const replaced = replacePlaceHolderOfArray(parameters);
            if (type !== this.type || replaced) return TemplateType.make(type, parameters) as this;
            return this;
        }
        writeToDb():void {
            super.writeToDb();
            instance.writeRef(this.type);
            instance.writeRefs(this.parameters);
            this.container.writeAsList();
            this.propertyContainer.writeAsList();
        }
        getType():dnfdb.ItemType {
            return dnfdb.ItemType.TemplateType;
        }
        getFullName():string {
            return `${this.type.getFullName()}<${this.parameters.map(v=>v.getFullName()).join(', ')}>`;
        }

        static make(type:Item, params:Item[]):TemplateType {
            return unique.make(TemplateType, type, params);
        }
    }
    export class Ref extends Item {
        constructor(public readonly base:Item){
            super();
        }

        _getAll(list:Item[]):void {
            if (this.iterating) return;
            super._getAll(list);
            this.base._getAll(list);
        }
        _replacePlaceHolder():this {
            if (this.iterating) return this;
            super._replacePlaceHolder();
            const base = this.base._replacePlaceHolder();
            if (this.base !== base) return Ref.make(base) as this;
            else return this;
        }
        writeToDb():void {
            super.writeToDb();
            instance.writeRef(this.base);
        }
        getType():dnfdb.ItemType {
            return dnfdb.ItemType.Ref;
        }
        getFullName():string {
            return `${this.base.getFullName()}*`;
        }
        static make(base:Item):Ref {
            return unique.make(Ref, base);
        }
    }
    export class Redirect extends ChildItem {
        constructor(outer:Container, name:string, public readonly target:Item) {
            super(outer, name);
        }
        _getAll(list:Item[]):void {
            if (this.iterating) return;
            super._getAll(list);
            this.target._getAll(list);
        }
        _replacePlaceHolder():this {
            if (this.iterating) return this;
            super._replacePlaceHolder();
            const target = this.target._replacePlaceHolder();
            if (this.target !== target) return Redirect.make(this.outer, this.name, target) as this;
            else return this;
        }
        writeToDb():void {
            super.writeToDb();
            instance.writeRef(this.target);
        }
        getType():dnfdb.ItemType {
            return dnfdb.ItemType.Redirect;
        }

        static make(outer:Container, name:string, target:Item):Redirect {
            return unique.make(Redirect, outer, name, target);
        }
    }
    /**
     * only contains rva but it needs for template param references
     */
    export class VariableOverload extends Item {
        rva:number;
        constructor(public readonly key:unknown) {
            super();
        }

        getType():dnfdb.ItemType {
            return dnfdb.ItemType.VariableOverload;
        }

        static make(key:unknown, rva:number):VariableOverload {
            const v = unique.make(VariableOverload, key);
            v.rva = rva;
            return v;
        }
    }
    export class Variable extends ChildItem {
        constructor(outer:Container, name:string, public readonly type:Item|null, public readonly v:VariableOverload) {
            super(outer, name);
        }

        _getAll(list:Item[]):void {
            if (this.iterating) return;
            super._getAll(list);
            if (this.type !== null) {
                this.type._getAll(list);
            }
        }
        _replacePlaceHolder():this {
            if (this.iterating) return this;
            super._replacePlaceHolder();
            const type = this.type !== null ? this.type._replacePlaceHolder() : null;
            if (this.type !== type) return Variable.make(this.outer, this.name, type, this.v) as this;
            else return this;
        }
        writeToDb():void {
            super.writeToDb();
            if (this.type !== null) {
                instance.writeRef(this.type);
            }
            instance.writeLeb128(this.v.rva);
        }
        getType():dnfdb.ItemType {
            return this.type === null ? dnfdb.ItemType.AddressVariable : dnfdb.ItemType.Variable;
        }

        static make(outer:Container, name:string, type:Item|null, v:VariableOverload):Variable {
            return unique.make(Variable, outer, name, type, v);
        }
    }
    export class VariableGetter extends ChildItem {
        public readonly infos:[VariableOverload, Item, Item[]][] = [];

        constructor(outer:Container, name:string) {
            super(outer, name);
        }

        writeToDb():void {
            super.writeToDb();

            for (const [v, type, tparams] of this.infos) {
                instance.writeLeb128(v.address);
                instance.writeRef(type);
                instance.writeString(serializeTypes(tparams));
            }
            instance.writeLeb128(0);
        }
        getType():dnfdb.ItemType {
            return dnfdb.ItemType.VariableGetter;
        }

        static make(base:Container, name:string):VariableGetter {
            return unique.make(VariableGetter, base, name);
        }
    }
    export class AddressGetter extends ChildItem {
        public readonly infos:[VariableOverload, Item[]][] = [];

        constructor(outer:Container, name:string) {
            super(outer, name);
        }

        _getAll(list:Item[]):void {
            if (this.iterating) return;
            super._getAll(list);
            for (const [overload, params] of this.infos) {
                overload._getAll(list);
                for (const param of params) {
                    param._getAll(list);
                }
            }
        }
        _replacePlaceHolder():this {
            if (this.iterating) return this;
            super._replacePlaceHolder();
            const n = this.infos.length;
            for (let i=0;i<n;i++) {
                replacePlaceHolderOfArray(this.infos[i][1]);
            }
            return this;
        }
        writeToDb():void {
            super.writeToDb();
            for (const [v, tparams] of this.infos) {
                instance.writeString(serializeTypes(tparams));
            }
            instance.writeLeb128(0);
        }
        getType():dnfdb.ItemType {
            return dnfdb.ItemType.AddressGetter;
        }

        static make(outer:Container, name:string):AddressGetter {
            return unique.make(AddressGetter, outer, name);
        }
    }
    export const root = new RootContainer;
}

for (const typeName of dnfdb.nativeTypes) {
    dbw.NativeType.make(typeName);
}
