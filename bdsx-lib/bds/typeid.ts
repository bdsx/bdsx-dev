import { Type } from "../nativetype";
import { TypeIdCounter } from "../typeid";
import minecraft = require('../minecraft');

/** @deprecated */
export const typeid_t = minecraft.typeid_t;
/** @deprecated */
export type typeid_t<T> = minecraft.typeid_t<T>;

/** @deprecated */
export const HasTypeId = TypeIdCounter;
/** @deprecated */
export type HasTypeId = TypeIdCounter;

/** @deprecated */
export function type_id<T, BASE extends TypeIdCounter>(base:typeof TypeIdCounter&{new():BASE}, type:Type<T>):typeid_t<BASE> {
    return base.makeId(type);
}

/** @deprecated */
export namespace type_id {
    /** @deprecated it does nothing */
    export function pdbimport(base:typeof HasTypeId, types:Type<any>[]):void {
        // does nothing
    }
}
