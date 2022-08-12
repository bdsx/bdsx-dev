import { CxxString } from "../../nativetype";
import { CommandContext, CommandOrigin } from "..";

declare module ".." {
    interface CommandContext {
        command:CxxString;
        origin:CommandOrigin;
    }
}

CommandContext.define({
    command:CxxString,
    origin:CommandOrigin.ref(),
}, 0x30);
