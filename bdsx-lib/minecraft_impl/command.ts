import { asm } from "../assembler";
import { CommandVFTable } from "../bds/command";
import { NativePointer, VoidPointer } from "../core";
import { dnf } from "../dnf";
import { Command, CommandParameterData, CommandParameterDataType, CommandRegistry, type_id } from "../minecraft";
import { KeysFilter, NativeClass, NativeClassType } from "../nativeclass";
import { bool_t, int16_t, int32_t, Type } from "../nativetype";

declare module "../minecraft" {
    namespace Command {
        class VFTable extends NativeClass {
            destructor:VoidPointer;
            execute:VoidPointer|null;
        }
        function mandatory<CMD extends Command,
            KEY extends keyof CMD,
            KEY_ISSET extends KeysFilter<CMD, bool_t>|null>(
                this:{new():CMD},
                key:KEY,
                keyForIsSet:KEY_ISSET,
                desc?:string|null,
                type?:CommandParameterDataType,
                name?:string,
            ):CommandParameterData;
        function optional<CMD extends Command,
            KEY extends keyof CMD,
            KEY_ISSET extends KeysFilter<CMD, bool_t>|null>(
            this:{new():CMD},
            key:KEY,
            keyForIsSet:KEY_ISSET,
            desc?:string|null,
            type?:CommandParameterDataType,
            name?:string,
        ):CommandParameterData;
        function manual(
            name:string,
            paramType:Type<any>,
            offset:number,
            flag_offset?:number,
            optional?:boolean,
            desc?:string|null,
            type?:CommandParameterDataType,
        ):CommandParameterData;
    }
    interface Command {
        vftable:CommandVFTable;
        u1:int32_t;
        u2:VoidPointer|null;
        u3:int32_t;
        u4:int16_t;
    }
}

Command.VFTable.define({
    destructor:VoidPointer,
    execute:VoidPointer,
});

Command.define({
    vftable:CommandVFTable.ref(), // 0x00
    u1:int32_t, // 0x08
    u2:VoidPointer, // 0x10
    u3:int32_t, // 0x18
    u4:int16_t, // 0x1c
});

Command.mandatory = function<CMD extends Command,
    KEY extends keyof CMD,
    KEY_ISSET extends KeysFilter<CMD, bool_t>|null>(
    this:{new():CMD},
    key:KEY,
    keyForIsSet:KEY_ISSET,
    desc?:string|null,
    type:CommandParameterDataType = CommandParameterDataType.NORMAL,
    name:string = key as string):CommandParameterData {
    const cmdclass = this as NativeClassType<any>;
    const paramType = cmdclass.typeOf(key as string);
    const offset = cmdclass.offsetOf(key as string);
    const flag_offset = keyForIsSet !== null ? cmdclass.offsetOf(keyForIsSet as string) : -1;
    return Command.manual(name, paramType, offset, flag_offset, false, desc, type);
};

Command.optional = function<CMD extends Command,
    KEY extends keyof CMD,
    KEY_ISSET extends KeysFilter<CMD, bool_t>|null>(
    this:{new():CMD},
    key:KEY,
    keyForIsSet:KEY_ISSET,
    desc?:string|null,
    type:CommandParameterDataType = CommandParameterDataType.NORMAL,
    name:string = key as string):CommandParameterData {
    const cmdclass = this as NativeClassType<any>;
    const paramType = cmdclass.typeOf(key as string);
    const offset = cmdclass.offsetOf(key as string);
    const flag_offset = keyForIsSet !== null ? cmdclass.offsetOf(keyForIsSet as string) : -1;
    return Command.manual(name, paramType, offset, flag_offset, true, desc, type);
};

Command.manual = function(
    name:string,
    paramType:Type<any>,
    offset:number,
    flag_offset:number = -1,
    optional:boolean = false,
    desc?:string|null,
    type:CommandParameterDataType = CommandParameterDataType.NORMAL):CommandParameterData {
    const param = CommandParameterData.construct();
    const getTypeId = dnf(type_id).getByTemplates(null, CommandRegistry, paramType);
    if (getTypeId === null) throw Error(`${paramType.name} type_id not found`);
    param.tid.id = getTypeId().id;
    const parser = dnf(CommandRegistry, 'parse').getByTemplates(paramType);
    if (parser === null) throw Error(`${paramType.name} parser not found`);
    param.parser = dnf.getAddressOf(parser);
    param.name = name;
    param.type = type;
    if (desc != null) {
        const ptr = new NativePointer;
        ptr.setAddressFromBuffer(asm.const_str(desc));
        param.desc = ptr;
    } else {
        param.desc = null;
    }

    param.unk56 = -1;
    param.offset = offset;
    param.flag_offset = flag_offset;
    param.optional = optional;
    param.pad73 = false;
    return param;
};
