import { VoidPointer } from "../core";
import { Command } from "../minecraft";
import { NativeClass } from "../nativeclass";
import { int16_t, int32_t } from "../nativetype";

declare module "../minecraft" {
    namespace Command {
        class VFTable extends NativeClass {
            destructor:VoidPointer;
            execute:VoidPointer|null;
        }
    }
    interface Command {
        vftable:Command.VFTable;
        u1:int32_t;
        u2:VoidPointer|null;
        u3:int32_t;
        u4:int16_t;
    }
}

Command.VFTable = class VFTable extends NativeClass {
    destructor:VoidPointer;
    execute:VoidPointer|null;
};

Command.VFTable.define({
    destructor:VoidPointer,
    execute:VoidPointer,
});

Command.define({
    vftable:Command.VFTable.ref(), // 0x00
    u1:int32_t, // 0x08
    u2:VoidPointer, // 0x10
    u3:int32_t, // 0x18
    u4:int16_t, // 0x1c
});
