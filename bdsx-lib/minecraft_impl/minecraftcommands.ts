import { VoidPointer } from "../core";
import { CommandOutputSender, MinecraftCommands } from "../minecraft";
import { bool_t } from "../nativetype";
import { SharedPtr as SharedPtr2 } from "../sharedpointer";

declare module "../minecraft"  {
    interface MinecraftCommands {
        vftable:VoidPointer;
        sender:CommandOutputSender;

        executeCommand(ctx:SharedPtr2<CommandContext>, mute:bool_t):MCRESULT;
    }
}

MinecraftCommands.abstract({
    vftable:VoidPointer,
    sender:CommandOutputSender.ref(),
});
