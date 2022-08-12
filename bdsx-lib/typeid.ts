import { dnf } from "./dnf/dnf";
import { typeid_t, type_id } from "./minecraft";
import { NativeClass } from "./nativeclass";
import { Type } from "./nativetype";

const typeidmap = Symbol();

/**
 * dummy class for typeid
 */
export class TypeIdCounter extends NativeClass {
    static readonly [typeidmap] = new WeakMap<Type<any>, typeid_t<any>>();

    static makeId<T, BASE extends TypeIdCounter>(this:typeof TypeIdCounter&(new()=>BASE), type:Type<T>):typeid_t<BASE> {
        const map = this[typeidmap];
        const typeid = map.get(type);
        if (typeid != null) {
            return typeid;
        }

        const TypeIdClass = typeid_t.make(this);
        if (TypeIdClass.count === 0) throw Error('Cannot make type_id before launch');
        const getTypeId = dnf(type_id).getByTemplates(null, this, type);

        if (getTypeId != null) {
            const newid:typeid_t<BASE> = getTypeId();
            map.set(type, newid);
            return newid;
        } else {
            const newid = new typeid_t<BASE>(true);
            newid.id = TypeIdClass.count++;
            map.set(type, newid);
            return newid;
        }
    }
}
