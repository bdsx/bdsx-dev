import { CommandOrigin, ServerCommandOrigin } from "../minecraft";
import './commandorigin';

declare module "../minecraft" {
    interface ServerCommandOrigin extends CommandOrigin {
        /** @deprecated is CommandOrigin constructor */
        constructWith():void;
    }
}

ServerCommandOrigin.setExtends(CommandOrigin);
ServerCommandOrigin.define({}, 0x58);
