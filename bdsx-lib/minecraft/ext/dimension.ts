import { VoidPointer } from "../../core";
import { Dimension } from "..";

declare module ".." {
    interface Dimension {
        vftable:VoidPointer;
    }
}

Dimension.abstract({
    vftable:VoidPointer,
});
