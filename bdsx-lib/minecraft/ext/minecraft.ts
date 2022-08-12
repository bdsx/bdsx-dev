import { VoidPointer } from "../../core";
import { Minecraft } from "..";

declare module ".." {
    interface Minecraft {
        vftable:VoidPointer;
    }
}

Minecraft.abstract({
    vftable:VoidPointer,
});
