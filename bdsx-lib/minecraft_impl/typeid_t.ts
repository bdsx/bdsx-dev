import { typeid_t } from "../minecraft";
import { uint16_t } from "../nativetype";

declare module "../minecraft" {
    interface typeid_t<T0> {
        id:uint16_t;
    }
}

typeid_t.define({
    id:uint16_t,
});
