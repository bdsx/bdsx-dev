import { createAbstractObject } from "../abstractobject";
import { VoidPointer } from "../core";
import { dnf } from "../dnf";
import { DimensionId } from "../enums";
import { events } from "../events";
import { DedicatedServer, Dimension, Minecraft, NetworkHandler, SemVersion, ServerInstance, SharedConstants } from "../minecraft";
import minecraft = require("../minecraft");

declare module "../minecraft" {
    interface ServerInstance {
        vftable:VoidPointer;
        server:DedicatedServer;
        minecraft:Minecraft;
        networkHandler:NetworkHandler;

        createDimension(id:DimensionId):Dimension;
        getActivePlayerCount():number;
        disconnectAllClients(message?:string):void;
        disconnectClient(client:NetworkIdentifier):void;
        disconnectClient(client:NetworkIdentifier, message:string, skipMessage:boolean):void;
        getMotd():string;
        setMotd(motd:string):void;
        getMaxPlayers():number;
        setMaxPlayers(count:number):void;
        updateCommandList():void;
        getNetworkProtocolVersion():number;
        getGameVersion():SemVersion;
        nextTick():Promise<void>;
    }

    let serverInstance:ServerInstance;
}

ServerInstance.abstract({
    vftable:VoidPointer,
    server:[DedicatedServer.ref(), 0x98],
    minecraft:[Minecraft.ref(), 0xa0],
    networkHandler:[NetworkHandler.ref(), 0xa8],
});

createAbstractObject.setAbstractProperty(minecraft, 'serverInstance');

ServerInstance.prototype.createDimension = function(id:DimensionId):Dimension {
    return this.minecraft.getLevel().createDimension(id);
};

ServerInstance.prototype.getActivePlayerCount = function():number {
    return this.minecraft.getLevel().getActivePlayerCount();
};

dnf(ServerInstance, 'disconnectAllClients').overload(function(){
    this.disconnectAllClients('disconnectionScreen.disconnected');
});

ServerInstance.prototype.getMotd = function():string {
    return this.minecraft.getServerNetworkHandler().motd;
};

ServerInstance.prototype.setMotd = function(motd:string):void {
    return this.minecraft.getServerNetworkHandler().setMotd(motd);
};
ServerInstance.prototype.getMaxPlayers = function():number {
    return this.minecraft.getServerNetworkHandler().maxPlayers;
};
ServerInstance.prototype.setMaxPlayers = function(count:number):void {
    this.minecraft.getServerNetworkHandler().setMaxNumPlayers(count);
};
ServerInstance.prototype.updateCommandList = function():void {
    for (const player of this.minecraft.getLevel().players.toArray()) {
        player.sendNetworkPacket(this.minecraft.getCommands().getRegistry().serializeAvailableCommands());
    }
};
ServerInstance.prototype.getNetworkProtocolVersion = function():number {
    return SharedConstants.NetworkProtocolVersion;
};
ServerInstance.prototype.getGameVersion = function():SemVersion {
    return SharedConstants.CurrentGameSemVersion;
};
ServerInstance.prototype.nextTick = function():Promise<void> {
    return events.serverUpdate.promise();
};
