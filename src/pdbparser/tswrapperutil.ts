import { TsFile, TsImportItem } from "./tsimport";
import { tswNames } from "./tswnames";
import { tsw } from "./tswriter";


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

export namespace wrapperUtil {
    export interface TsBase extends TsFile {
        makeVariable(kind:tsw.Kind, initial:tsw.Value):tsw.Name;
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
            return new WrappedItem(this.value,this.type, this.wrapper, component);
        }

        static createPair(base:TsBase, wrapper:tsw.ItemPair&Wrapper, component:tsw.ItemPair):WrappedItem {
            return new WrappedItem(
                base.makeVariable(component.getKind(), new tsw.DotCall(wrapper.value, tswNames.make, [component.value])),
                new tsw.TemplateType(wrapper.type, [component.type]),
                wrapper,
                component
            );
        }
    }

    export interface Wrapper {
        wrappedMap?:WeakMap<tsw.ItemPair, WrappedItem>;
    }

    export class WrapperBase implements Wrapper {
        wrappedMap?:WeakMap<tsw.ItemPair, WrappedItem>;

        is(pair:tsw.ItemPair):pair is WrappedItem {
            return pair instanceof WrappedItem && pair.wrapper === this;
        }
    }
    export class TypeWrapper extends WrapperBase {
        readonly type:tsw.TypeName;
        public wrappedMap?:WeakMap<tsw.ItemPair, WrappedItem>;

        constructor(name:string) {
            super();
            this.type = new tsw.TypeName(name);
        }

        wrap(component:tsw.ItemPair):WrappedItem {
            return getFromMap(this, component, ()=>new WrappedItem(
                component.value,
                new tsw.TemplateType(this.type, [component.type]),
                this,
                component
            ));
        }
    }
    export class RefWrapper extends WrapperBase {
        readonly value:tsw.NameProperty;
        public wrappedMap?:WeakMap<tsw.ItemPair, WrappedItem>;

        constructor(name:string) {
            super();
            this.value = new tsw.NameProperty(name);
        }

        wrap(component:tsw.ItemPair):tsw.ItemPair {
            return getFromMap(this, component, ()=>new WrappedItem(
                new tsw.DotCall(component.value, this.value, []),
                component.type,
                this,
                component
            ));
        }
    }
    export class ImportItem extends TsImportItem {
        public variable:tsw.NamePair|null = null;
        public readonly base:TsBase;

        constructor(
            base:TsBase,
            from:TsFile,
            name:string) {
            super(base, from, name);
        }

        import():Wrapper&tsw.ItemPair {
            return super.import();
        }

        protected _allocate(component:tsw.ItemPair):WrappedItem{
            const This = this.import();
            return WrappedItem.createPair(this.base, This, component);
        }
        wrap(component:tsw.ItemPair):tsw.ItemPair {
            const This = this.import();
            return getFromMap(This, component, ()=>this._allocate(component));
        }
        is(pair:tsw.ItemPair):pair is WrappedItem {
            const This = this.import();
            return pair instanceof WrappedItem && pair.wrapper === This;
        }
    }
}
