import { bool_t, CxxString, uint8_t } from "../../nativetype";
import { ObjectiveCriteria } from "..";

declare module ".." {
    interface ObjectiveCriteria {
        name:CxxString;
        readOnly:bool_t;
        renderType:uint8_t;
    }
}

ObjectiveCriteria.abstract({
    name:CxxString,
    readOnly:bool_t,
    renderType:uint8_t,
});
