import { uint16_t } from "../../nativetype";
import { typeid_t } from "..";

declare module ".." {
    interface typeid_t<T> {
        id:uint16_t;
    }
}

typeid_t.define({
    id:uint16_t,
});
