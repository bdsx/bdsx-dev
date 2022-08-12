import { VoidPointer } from "../../core";
import { dnf } from "../../dnf/dnf";
import { makefunc } from "../../makefunc";
import { CxxString, void_t } from "../../nativetype";
import { minecraftTsReady } from "../ext_ready";
import { Actor, BlockPos, CommandOrigin, Dimension, Level, mce, ScriptCommandOrigin, ServerCommandOrigin, ServerLevel, Vec3 } from "..";

declare module ".." {
    interface CommandOrigin {
        vftable:VoidPointer;
        uuid:mce.UUID;
        level:ServerLevel;

        constructWith(vftable:VoidPointer, level:ServerLevel):void;
        isServerCommandOrigin():boolean;
        isScriptCommandOrigin():boolean;

        getRequestId():CxxString;
        getName():string;
        getBlockPosition(): BlockPos;
        getWorldPosition(): Vec3;
        getLevel(): Level;

        /**
         * actually, it's nullable when the server is just started without any joining
         */
        getDimension(): Dimension;
        /**
         * it returns null if the command origin is the console
         */
        getEntity():Actor|null;

        /**
         * return the command result
         */
        handleCommandOutputCallback(value:unknown & IExecuteCommandCallback['data']):void;
    }
}

CommandOrigin.abstract({
    vftable:VoidPointer,
    uuid:mce.UUID,
    level:ServerLevel.ref(),
});

CommandOrigin.prototype.isServerCommandOrigin = function():boolean {
    return this.vftable.equals(ServerCommandOrigin.vftable);
};
CommandOrigin.prototype.isScriptCommandOrigin = function():boolean {
    return this.vftable.equals(ScriptCommandOrigin.vftable);
};

// void destruct(CommandOrigin* origin);
CommandOrigin.prototype.destruct = makefunc.js([0x00], void_t, {this: CommandOrigin});

// std::string CommandOrigin::getRequestId();
CommandOrigin.prototype.getRequestId = makefunc.js([0x08], CxxString, {this: CommandOrigin, structureReturn: true});

// std::string CommandOrigin::getName();
CommandOrigin.prototype.getName = makefunc.js([0x10], CxxString, {this: CommandOrigin, structureReturn: true});

// BlockPos CommandOrigin::getBlockPosition();
CommandOrigin.prototype.getBlockPosition = makefunc.js([0x18], BlockPos, {this: CommandOrigin, structureReturn: true});

// Vec3 getWorldPosition(CommandOrigin* origin);
CommandOrigin.prototype.getWorldPosition = makefunc.js([0x20], Vec3, {this: CommandOrigin, structureReturn: true});

// Level* getLevel(CommandOrigin* origin);
CommandOrigin.prototype.getLevel = makefunc.js([0x28], Level, {this: CommandOrigin});

// Dimension* (*getDimension)(CommandOrigin* origin);
CommandOrigin.prototype.getDimension = makefunc.js([0x30], Dimension, {this: CommandOrigin});

// Actor* getEntity(CommandOrigin* origin);
CommandOrigin.prototype.getEntity = makefunc.js([0x38], Actor, {this: CommandOrigin});

minecraftTsReady(()=>{
    dnf(CommandOrigin, 'constructWith').overload(function(vftable:VoidPointer, level:ServerLevel):void{
        this.vftable = vftable;
        this.level = level;
        this.uuid = mce.UUID.generate();
    }, VoidPointer, ServerLevel);
});
