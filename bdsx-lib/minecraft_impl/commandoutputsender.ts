import { VoidPointer } from "../core";
import { CommandOutputSender } from "../minecraft";

declare module "../minecraft" {
    interface CommandOutputSender {
        vftable:VoidPointer;
    }

}

CommandOutputSender.abstract({
    vftable:VoidPointer,
});
