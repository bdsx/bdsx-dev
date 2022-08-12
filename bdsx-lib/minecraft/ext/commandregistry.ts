import { AvailableCommandsPacket, CommandParameterData, CommandRegistry } from "..";
import { HasTypeId } from "../../bds/typeid";
import { VoidPointer } from "../../core";
import { CxxVector } from "../../cxxvector";
import { dnf } from "../../dnf/dnf";
import { hook } from "../../hook";
import { bin64_t, CxxString, int32_t, void_t } from "../../nativetype";
import { minecraftTsReady } from "../ext_ready";

declare module ".." {
    interface CommandRegistry extends HasTypeId {
        registerCommand(command:string, description:string, level:CommandPermissionLevel, cheatFlag:CommandFlag, usageFlag:CommandFlag):void;
        registerAlias(command:string, alias:string):void;

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

CommandRegistry.setExtends(HasTypeId);
CommandRegistry.abstract({});

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

minecraftTsReady(()=>{
    const _serializeAvailableCommands = hook(CommandRegistry, 'serializeAvailableCommands')
    .reform(void_t, null, CommandRegistry, AvailableCommandsPacket);

    dnf(CommandRegistry, 'serializeAvailableCommands').overload(function():AvailableCommandsPacket {
        const pk = AvailableCommandsPacket.create();
        _serializeAvailableCommands(this, pk);
        return pk;
    });
});
