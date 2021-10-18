import { defineConstGetter } from "../constgetter";
import { mcglobal } from "../mcglobal";
import { SharedConstants } from "../minecraft";
import { events } from "./events";

export namespace server {
    export function getMotd():string {
        return mcglobal.minecraft.getServerNetworkHandler().motd;
    }
    export function setMotd(motd:string):void {
        return mcglobal.minecraft.getServerNetworkHandler().setMotd(motd);
    }
    export function getMaxPlayers():number {
        return mcglobal.minecraft.getServerNetworkHandler().maxPlayers;
    }
    export function setMaxPlayers(count:number):void {
        mcglobal.minecraft.getServerNetworkHandler().setMaxNumPlayers(count);
    }
    export function disconnectAllClients(message:string = 'disconnectionScreen.disconnected'):void {
        mcglobal.serverInstance.disconnectAllClients(message);
    }
    export function getActivePlayerCount():number {
        return mcglobal.level.getActivePlayerCount();
    }

    export function nextTick():Promise<void> {
        return events.serverUpdate.promise();
    }
    export const networkProtocolVersion:number = SharedConstants.NetworkProtocolVersion;
    export declare const bdsVersion:string;
}

defineConstGetter(server, 'bdsVersion', ()=>{
    const ver = SharedConstants.CurrentGameSemVersion;
    return ver.getMajor()+'.'+ver.getMinor()+'.'+ver.getPatch();
});
