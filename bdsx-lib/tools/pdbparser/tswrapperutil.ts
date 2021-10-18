import { tsw } from "../lib/tswriter";
import { TsFile, TsImportItem } from "./tsimport";
import { tswNames } from "./tswnames";


function getFromMap(wrapper:wrapperUtil.Wrapper, component:tsw.ItemPair, getter:()=>wrapperUtil.WrappedItem):wrapperUtil.WrappedItem {
    if (wrapper.wrappedMap != null) {
        const res = wrapper.wrappedMap.get(component);
        if (res != null) return res;
    } else {
        wrapper.wrappedMap = new WeakMap;
    }
    const out = getter();
    wrapper.wrappedMap.set(component, out);
    return out;
}

declare module "../lib/tswriter" {
    namespace tsw {
        interface ItemPair {
            mapped?:wrapperUtil.Wrapper;
        }
    }
}

export namespace wrapperUtil {
    export interface TsBase extends TsFile {
        makeVariable(initial:tsw.Value):tsw.Name;
    }
    export class WrappedItem extends tsw.ItemPair {
        public readonly value:tsw.Name;
        public readonly type:tsw.TemplateType;

        constructor(
            value:tsw.Value,
            type:tsw.Type,
            public readonly wrapper:Wrapper,
            public readonly component:tsw.ItemPair
        ){
            super(value, type);
        }

        notNull():WrappedItem {
            const type = this.type.notNull();
            if (this.type === type) return this;
            return new WrappedItem(this.value, type, this.wrapper, this.component);
        }
        changeValue(value:tsw.Value):WrappedItem {
            if (this.value === value) return this;
            return new WrappedItem(value, this.type, this.wrapper, this.component);
        }
        changeType(type:tsw.Type):WrappedItem {
            if (this.type === type) return this;
            return new WrappedItem(this.value, type, this.wrapper, this.component);
        }
        changeBoth(value:tsw.Value, type:tsw.Type):WrappedItem {
            if (this.value === value && this.type === type) return this;
            return new WrappedItem(value, type, this.wrapper, this.component);
        }
        changeComponent(component:tsw.ItemPair):WrappedItem {
            if (this.component === component) return this;
            return this.wrapper.wrap(component);
        }
    }

    export abstract class Wrapper extends tsw.ItemPair {
        wrappedMap?:WeakMap<tsw.ItemPair, WrappedItem>;

        is(pair:tsw.ItemPair):pair is WrappedItem {
            return pair instanceof WrappedItem && pair.wrapper === this;
        }
        abstract wrapValue(value:tsw.Value):tsw.Value;
        abstract wrapType(type:tsw.Type):tsw.Type;
        wrap(component:tsw.ItemPair):WrappedItem {
            return getFromMap(this, component, ()=>new WrappedItem(
                this.wrapValue(component.value),
                this.wrapType(component.type),
                this,
                component
            ));
        }
    }
    export class DefaultWrapper extends Wrapper {
        constructor(
            value:tsw.Value,
            type:tsw.Type,
            public readonly base:TsBase
        ) {
            super(value, type);
        }
        wrapValue(value:tsw.Value):tsw.Value {
            return this.base.makeVariable(new tsw.DotCall(this.value, tswNames.make, [value]));
        }
        wrapType(type:tsw.Type):tsw.Type {
            return new tsw.TemplateType(this.type, [type]);
        }
    }
    export class TypeWrapper extends Wrapper {
        readonly type:tsw.TypeName;
        public wrappedMap?:WeakMap<tsw.ItemPair, WrappedItem>;

        constructor(name:string) {
            super(tsw.Constant.null, new tsw.TypeName(name));
        }

        wrapValue(value:tsw.Value):tsw.Value {
            return value;
        }
        wrapType(type:tsw.Type):tsw.Type {
            return new tsw.TemplateType(this.type, [type]);
        }
    }
    export class RefWrapper extends Wrapper {
        readonly valueProp:tsw.NameProperty;
        public wrappedMap?:WeakMap<tsw.ItemPair, WrappedItem>;

        constructor(name:string) {
            super(tsw.Constant.null, tsw.BasicType.null);
            this.valueProp = new tsw.NameProperty(name);
        }

        wrapValue(value:tsw.Value):tsw.Value {
            return new tsw.DotCall(value, this.valueProp, []);
        }
        wrapType(type:tsw.Type):tsw.Type {
            return type;
        }
    }

    export class ImportItem extends TsImportItem {
        public variable:tsw.NamePair|null = null;
        public readonly base:TsBase;

        constructor(
            base:TsBase,
            from:TsFile,
            name:string,
            public readonly wrapper:new(value:tsw.Value, type:tsw.Type, base:TsBase)=>Wrapper = DefaultWrapper) {
            super(base, from, name);
        }

        import():Wrapper {
            const item = super.import();
            if (item.mapped != null) return item.mapped;
            const Wrapper = this.wrapper;
            const wrapped = new Wrapper(item.value, item.type, this.base);
            item.mapped = wrapped;
            return wrapped;
        }

        wrap(component:tsw.ItemPair):tsw.ItemPair {
            const This = this.import();
            return This.wrap(component);
        }
        is(pair:tsw.ItemPair):pair is WrappedItem {
            const This = this.import();
            return pair instanceof WrappedItem && pair.wrapper === This;
        }
    }
}
