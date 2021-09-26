import { VoidPointer } from "../core";
import { CommandOutputSender, MinecraftCommands } from "../minecraft";

declare module "../minecraft"  {
    interface MinecraftCommands {
        vftable:VoidPointer;
        sender:CommandOutputSender;
    }
}

MinecraftCommands.abstract({
    vftable:VoidPointer,
    sender:CommandOutputSender.ref(),
});
