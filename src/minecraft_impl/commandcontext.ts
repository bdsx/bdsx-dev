import { CommandContext, CommandOrigin } from "../minecraft";
import { CxxString } from "../nativetype";

declare module "../minecraft" {
    interface CommandContext {
        command:CxxString;
        origin:CommandOrigin;
    }
}

CommandContext.define({
    command:CxxString,
    origin:CommandOrigin.ref(),
}, 0x30);
