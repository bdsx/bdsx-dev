import { createAbstractObject } from "./abstractobject";
import { CommandRegistry, Minecraft, MinecraftCommands, NetworkHandler, ServerInstance, ServerLevel } from "./minecraft";
import asmcode = require("./asm/asmcode");

export namespace mcglobal {
    export declare const serverInstance:ServerInstance;
    export declare const minecraft:Minecraft;
    export declare const level:ServerLevel;
    export declare const commands:MinecraftCommands;
    export declare const networkHandler:NetworkHandler;
    export declare const commandRegistry:CommandRegistry;

    export function init():void {
        const serverInstance = asmcode.serverInstance.as(ServerInstance);
        Object.defineProperty(mcglobal, 'serverInstance', serverInstance);
        Object.defineProperty(mcglobal, 'networkHandler', serverInstance.networkHandler);
        const mc = serverInstance.minecraft;
        Object.defineProperty(mcglobal, 'minecraft', mc);
        Object.defineProperty(mcglobal, 'level', mc.getLevel().as(ServerLevel));
        const commands = mc.getCommands();
        Object.defineProperty(mcglobal, 'commands', commands);
        Object.defineProperty(mcglobal, 'commandRegistry', commands.getRegistry());
    }
}

createAbstractObject.setAbstractProperties(
    mcglobal,
    'serverInstance',
    'minecraft',
    'level',
    'commands',
    'networkHandler',
    'commandRegistry');
