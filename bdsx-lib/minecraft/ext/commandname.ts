import { CxxString, uint8_t } from "../../nativetype";
import { CommandName } from "..";

declare module ".." {
    interface CommandName {
        name:string;
        unknown:uint8_t;
    }
}

CommandName.define({
    name: CxxString,
    unknown: uint8_t,
});
