import { CommandOrigin, ServerCommandOrigin } from "..";
import './commandorigin';

declare module ".." {
    interface ServerCommandOrigin extends CommandOrigin {
        /** @deprecated is CommandOrigin constructor */
        constructWith():void;
    }
}

ServerCommandOrigin.setExtends(CommandOrigin);
ServerCommandOrigin.define({}, 0x58);
