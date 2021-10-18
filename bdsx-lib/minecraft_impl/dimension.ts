import { VoidPointer } from "../core";
import { Dimension } from "../minecraft";

declare module "../minecraft" {
    interface Dimension {
        vftable:VoidPointer;
    }
}

Dimension.abstract({
    vftable:VoidPointer,
});
