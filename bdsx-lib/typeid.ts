import { NativePointer } from "./core";
import { dnf } from "./dnf";
import { typeid_t, type_id } from "./minecraft";
import { NativeClass } from "./nativeclass";
import { Type, uint16_t } from "./nativetype";
import { Wrapper } from "./pointer";

const counterWrapper = Symbol();
const typeidmap = Symbol();

const IdCounter = Wrapper.make(uint16_t);
type IdCounter = Wrapper<uint16_t>;

/**
 * dummy class for typeid
 */
export class TypeIdCounter extends NativeClass {
    static [counterWrapper]:IdCounter;
    static readonly [typeidmap] = new WeakMap<Type<any>, typeid_t<any>>();

    static makeId<T, BASE extends TypeIdCounter>(this:typeof TypeIdCounter&(new()=>BASE), type:Type<T>):typeid_t<BASE> {
        const map = this[typeidmap];
        const typeid = map.get(type);
        if (typeid != null) {
            return typeid;
        }

        const counter = this[counterWrapper];
        if (counter.value === 0) throw Error('Cannot make type_id before launch');
        const getTypeId = dnf(type_id).getByTemplates(null, this, type);

        if (getTypeId != null) {
            const newid:typeid_t<BASE> = getTypeId();
            map.set(type, newid);
            return newid;
        } else {
            const newid = new typeid_t<BASE>(true);
            newid.id = counter.value++;
            map.set(type, newid);
            return newid;
        }
    }
}
