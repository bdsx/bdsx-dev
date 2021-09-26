import { bin } from "../bin";
import { capi } from "../capi";
import { StaticPointer, VoidPointer } from "../core";
import { CxxVector } from "../cxxvector";
import { dnf } from "../dnf";
import { hook } from "../hook";
import { makefunc } from "../makefunc";
import { AvailableCommandsPacket, Command, CommandParameterData, CommandRegistry } from "../minecraft";
import type { Command as CommandLegacy, CommandParameterData as CommandParameterDataLegacy } from "../bds/command";
import { NativeClassType } from "../nativeclass";
import { bin64_t, CxxString, int32_t, NativeType, Type, void_t } from "../nativetype";
import { HasTypeId } from "../bds/typeid";

declare module "../minecraft" {
    interface CommandRegistry extends HasTypeId {
        registerCommand(command:string, description:string, level:CommandPermissionLevel, cheatFlag:CommandFlag, usageFlag:CommandFlag):void;
        registerAlias(command:string, alias:string):void;

        /**
         * CAUTION: this method will destruct all parameters in params
         */
        registerOverloadClass(name:string, commandClass:new()=>(Command|CommandLegacy), params:(CommandParameterData|CommandParameterDataLegacy)[]):void;

        findCommand(command:string):CommandRegistry.Signature|null;
    }

    namespace CommandRegistry {
        interface Overload {
            commandVersion:bin64_t;
            allocator:VoidPointer;
            parameters:CxxVector<CommandParameterData>;
            commandVersionOffset:int32_t;
        }

        interface Symbol {
            data:int32_t;
        }

        interface Signature {
            command:CxxString;
            description:CxxString;
            overloads:CxxVector<Overload>;
            permissionLevel:CommandPermissionLevel;
            commandSymbol:CommandRegistry.Symbol;
            commandAliasEnum:CommandRegistry.Symbol;
            flags:int32_t;
        }
    }
}

const _serializeAvailableCommands = hook(CommandRegistry, 'serializeAvailableCommands')
.reform(void_t, null, CommandRegistry, AvailableCommandsPacket);

dnf(CommandRegistry, 'serializeAvailableCommands').overload(function():AvailableCommandsPacket {
    const pk = AvailableCommandsPacket.create();
    _serializeAvailableCommands(this, pk);
    return pk;
});

CommandRegistry.setExtends(HasTypeId);
CommandRegistry.abstract({});

CommandRegistry.prototype.registerOverloadClass = function(name:string, commandClass:new()=>Command, params:CommandParameterData[]):void {
    const cls = commandClass as NativeClassType<Command>;
    const size = cls[NativeType.size];
    if (!size) throw Error(`${cls.name}: size is not defined`);
    const allocator = makefunc.np((returnval:StaticPointer)=>{
        const ptr = capi.malloc(size);
        const cmd = ptr.as(cls);
        cmd.construct();

        returnval.setPointer(cmd);
        return returnval;
    }, StaticPointer, null, StaticPointer);

    const sig = this.findCommand(name);
    if (sig === null) throw Error(`${name}: command not found`);

    const overload = CommandRegistry.Overload.construct();
    overload.commandVersion = bin.make64(1, 0x7fffffff);
    overload.allocator = allocator;
    overload.parameters.setFromArray(params);
    overload.commandVersionOffset = -1;
    sig.overloads.push(overload);
    this.registerOverloadInternal(sig, sig.overloads.back()!);
    overload.destruct();

    for (const param of params) {
        param.destruct();
    }
};

CommandRegistry.Overload.define({
    commandVersion:bin64_t,
    allocator:VoidPointer,
    parameters:CxxVector.make(CommandParameterData),
    commandVersionOffset:int32_t,
});

CommandRegistry.Symbol.define({
    data:int32_t
});

CommandRegistry.Signature.abstract({
    command:CxxString,
    description:CxxString,
    overloads:CxxVector.make<CommandRegistry.Overload>(CommandRegistry.Overload),
    permissionLevel:int32_t,
    commandSymbol:CommandRegistry.Symbol,
    commandAliasEnum:CommandRegistry.Symbol,
    flags:int32_t,
});
