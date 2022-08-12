import { VoidPointer } from "../../core";
import { CommandOutputSender } from "..";

declare module ".." {
    interface CommandOutputSender {
        vftable:VoidPointer;
    }

}

CommandOutputSender.abstract({
    vftable:VoidPointer,
});
