import { VoidPointer } from "../../core";
import { DedicatedServer, Minecraft, NetworkHandler, ServerInstance } from "..";

declare module ".." {
    interface ServerInstance {
        vftable:VoidPointer;
        server:DedicatedServer;
        minecraft:Minecraft;
        networkHandler:NetworkHandler;

        disconnectAllClients(message:string):void;
        disconnectClient(client:NetworkIdentifier):void;
        disconnectClient(client:NetworkIdentifier, message:string, skipMessage:boolean):void;
    }
}

ServerInstance.abstract({
    vftable:VoidPointer,
    server:[DedicatedServer.ref(), 0x98],
    minecraft:[Minecraft.ref(), 0xa0],
    networkHandler:[NetworkHandler.ref(), 0xa8],
});
