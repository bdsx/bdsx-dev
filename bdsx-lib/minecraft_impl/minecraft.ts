import { VoidPointer } from "../core";
import { Minecraft } from "../minecraft";

declare module "../minecraft" {
    interface Minecraft {
        vftable:VoidPointer;
    }
}

Minecraft.abstract({
    vftable:VoidPointer,
});
