import { VoidPointer } from "../core";
import { dnf } from "../dnf";
import { NetworkIdentifier, ServerNetworkHandler } from "../minecraft";
import { CxxString, int32_t } from "../nativetype";
import { minecraftTsReady } from "./ready";

declare module "../minecraft" {
    interface ServerNetworkHandler {
        vftable: VoidPointer;
        readonly motd:CxxString;
        readonly maxPlayers: int32_t;

        disconnectClient(client:NetworkIdentifier):void;

        /**
         * @alias allowIncomingConnections
         */
        setMotd(motd:string):void;
        allowIncomingConnections(motd:string, b:boolean):void;
    }
}

ServerNetworkHandler.abstract({
    vftable: VoidPointer,
    motd:[CxxString, 0x260],
    maxPlayers:[int32_t, 0x2D8],
});

/**
 * Alias of allowIncomingConnections
 */
ServerNetworkHandler.prototype.setMotd = function(motd:string):void {
    this.allowIncomingConnections(motd, true);
};

minecraftTsReady(()=>{
    dnf(ServerNetworkHandler, 'disconnectClient').overload(function(client:NetworkIdentifier){
        this.disconnectClient(client, 0, 'disconnectionScreen.disconnected', false);
    }, NetworkIdentifier);
});
