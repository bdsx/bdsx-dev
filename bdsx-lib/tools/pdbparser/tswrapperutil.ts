import { dbw } from "../../dnf/dnfwriter";
import { tsw } from "../lib/tswriter";
import { unique } from "../../unique";
import { ScopeMethod } from "../lib/unusedname";
import { TsFile } from "./tsimport";


function getFromMap(wrapper:Wrapper, component:ResItem, getter:()=>WrappedItem):WrappedItem {
    if (wrapper.wrappedMap != null) {
        const res = wrapper.wrappedMap.get(component);
        if (res != null) return res;
    } else {
        wrapper.wrappedMap = new WeakMap;
    }
    const out = getter();
    const v = out.component.value;
    wrapper.wrappedMap.set(component, out);
    unique.allocId(out);
    return out;
}
export class ResItem {
    constructor(
        public readonly value:dbw.Item,
        public readonly type:tsw.Type) {
    }

    static propertyToKey?(prop:tsw.Property):string;

    member(prop:tsw.Property|string):ResItem {
        if (prop instanceof tsw.Property) {
            if (prop instanceof tsw.NameProperty) {
                prop = prop.name;
            } else {
                const key = ResItem.propertyToKey!(prop);
                return ResItem.make(
                    this.value.member(key),
                    unique.callm(this.type, 'member', prop)
                );
            }
        }
        return ResItem.make(
            this.value.member(prop),
            unique.callm(this.type, 'member', prop)
        );
    }
    changeValue(value:dbw.Item):ResItem {
        if (this.value === value) return this;
        return ResItem.make(value, this.type);
    }
    changeType(type:tsw.Type):ResItem {
        if (this.type === type) return this;
        return ResItem.make(this.value, type);
    }
    notNull():ResItem {
        const notNull = this.type.notNull();
        if (this.type === notNull) return this;
        return ResItem.make(this.value, notNull);
    }
    static make(value:dbw.Item, type:tsw.Type):ResItem {
        return unique.make(ResItem, value, type);
    }
    static basic(name:string):ResItem {
        return unique.make(ResItem, dbw.NativeType.make(name), unique.make(tsw.TypeName, name));
    }
    static fromName(name:string):ResItem {
        return unique.make(ResItem, dbw.root.member(name), unique.make(tsw.TypeName, name));
    }
    static fromProperty(name:tsw.Property):ResItem {
        if (name instanceof tsw.NameProperty) {
            return ResItem.fromName(name.name);
        } else {
            throw Error(`${name} is not name property`);
        }
    }

    static readonly any = ResItem.make(dbw.nullItem, tsw.BasicType.any);
    static readonly anyArray = ResItem.make(dbw.nullItem, new tsw.ArrayType(tsw.BasicType.any));
    static readonly never = ResItem.make(dbw.nullItem, tsw.BasicType.never);
}

export class WrappedItem extends ResItem {
    public readonly type:tsw.TemplateType;

    constructor(
        value:dbw.Item,
        type:tsw.Type,
        public readonly wrapper:Wrapper,
        public readonly component:ResItem
    ){
        super(value, type);
    }

    notNull():WrappedItem {
        const type = this.type.notNull();
        if (this.type === type) return this;
        return unique.make(WrappedItem, this.value, type, this.wrapper, this.component);
    }
    changeValue(value:dbw.Item):WrappedItem {
        if (this.value === value) return this;
        return unique.make(WrappedItem, value, this.type, this.wrapper, this.component);
    }
    changeType(type:tsw.Type):WrappedItem {
        if (this.type === type) return this;
        return unique.make(WrappedItem, this.value, type, this.wrapper, this.component);
    }
    changeBoth(value:dbw.Item, type:tsw.Type):WrappedItem {
        if (this.value === value && this.type === type) return this;
        return unique.make(WrappedItem, value, type, this.wrapper, this.component);
    }
    changeComponent(scope:ScopeMethod, component:ResItem):WrappedItem {
        if (this.component === component) return this;
        return this.wrapper.wrap(scope, component);
    }
}

export abstract class Wrapper extends ResItem {
    wrappedMap?:WeakMap<ResItem, WrappedItem>;

    constructor(pair:ResItem) {
        super(pair.value, pair.type);
    }
    is(pair:ResItem):pair is WrappedItem {
        return pair instanceof WrappedItem && pair.wrapper === this;
    }
    abstract wrapValue(scope:ScopeMethod, value:dbw.Item):dbw.Item;
    abstract wrapType(scope:ScopeMethod, type:tsw.Type):tsw.Type;
    wrap(scope:ScopeMethod, component:ResItem):WrappedItem {
        return getFromMap(this, component, ()=>new WrappedItem(
            this.wrapValue(scope, component.value),
            this.wrapType(scope, component.type),
            this,
            component
        ));
    }
}
export class DefaultWrapper extends Wrapper {
    constructor(
        pair:ResItem,
        public readonly base:TsFile
    ) {
        super(pair);
    }
    wrapValue(scope:ScopeMethod, value:dbw.Item):dbw.Item {
        return dbw.TemplateType.make(this.value, [value]);
    }
    wrapType(scope:ScopeMethod, type:tsw.Type):tsw.Type {
        return unique.make(tsw.TemplateType, this.type, [type]);
    }
}
export class TypeWrapper extends Wrapper {
    readonly type:tsw.TypeName;
    public wrappedMap?:WeakMap<ResItem, WrappedItem>;

    constructor(name:string|ResItem) {
        super(typeof name === 'string' ? new ResItem(dbw.nullItem, new tsw.TypeName(name)) : name);
    }

    wrapValue(scope:ScopeMethod, value:dbw.Item):dbw.Item {
        return value;
    }
    wrapType(scope:ScopeMethod, type:tsw.Type):tsw.Type {
        return new tsw.TemplateType(this.type, [type]);
    }
}
export class RefWrapper extends Wrapper {
    public wrappedMap?:WeakMap<ResItem, WrappedItem>;

    constructor() {
        super(new ResItem(dbw.nullItem, tsw.BasicType.null));
    }

    wrapValue(scope:ScopeMethod, value:dbw.Item):dbw.Item {
        return dbw.Ref.make(value);
    }
    wrapType(scope:ScopeMethod, type:tsw.Type):tsw.Type {
        return type;
    }
}

export class ImportItem {
    private target:tsw.ImportTarget|null = null;
    private basicImport:ResItem|null = null;

    constructor(
        public readonly base:TsFile,
        public readonly from:TsFile,
        public readonly name:string,
        public readonly typeOnly:boolean = false) {
    }

    protected _importDirect(scope:ScopeMethod):tsw.Type {
        const target = this.target!;
        return target.importDirect(scope).type;
    }

    isImported():boolean {
        return this.basicImport !== null;
    }

    isWrapper(wrapper:Wrapper):boolean {
        if (this.basicImport === null) return false;
        if (this.basicImport === wrapper) return true;
        const typev = this.typeOnly ? dbw.nullItem : dbw.NativeType.make(this.name);
        if (wrapper.value !== typev) return false;
        if (wrapper.type instanceof tsw.TypeMember) {
            return this.target!.isImportDirect(wrapper.type.item) && wrapper.type.property.getNameOrThrow() === this.name;
        }
        return wrapper.type === this.basicImport.type;
    }

    import(scope:ScopeMethod):ResItem {
        const typev = this.typeOnly ? dbw.nullItem : dbw.NativeType.make(this.name);
        if (this.basicImport === null) {
            if (this.target === null) {
                this.target = this.base.imports.from(this.from.path);
            }
            const imported = this.target.import(scope, this.name);
            this.basicImport = ResItem.make(typev, imported.type);
        }

        const importName = this.basicImport.type.getNameOrThrow();
        if (scope.existName(importName)) {
            const type = unique.callm(this._importDirect(scope), 'member', this.name);
            return ResItem.make(typev, type);
        }
        return this.basicImport;
    }

    importValue(scope:ScopeMethod):dbw.Item {
        return this.import(scope).value;
    }
    importType(scope:ScopeMethod):tsw.Type {
        return this.import(scope).type;
    }
}

export class ImportWrapper extends ImportItem {
    public variable:tsw.NamePair|null = null;
    public readonly base:TsFile;

    constructor(
        base:TsFile,
        from:TsFile,
        name:string,
        typeOnly?:boolean,
        public readonly wrapper:new(value:ResItem, base:TsFile)=>Wrapper = DefaultWrapper) {
        super(base, from, name, typeOnly);
    }

    import(scope:ScopeMethod):Wrapper {
        const item = super.import(scope);
        return unique.make(this.wrapper, item, this.base);
    }

    wrap(scope:ScopeMethod, component:ResItem):ResItem {
        const This = this.import(scope);
        return This.wrap(scope, component);
    }

    is(pair:ResItem):pair is WrappedItem {
        if (!this.isImported()) return false;
        if (!(pair instanceof WrappedItem)) return false;
        return this.isWrapper(pair.wrapper);
    }
}
