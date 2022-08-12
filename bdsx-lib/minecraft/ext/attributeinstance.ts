import { VoidPointer } from "../../core";
import { float32_t } from "../../nativetype";
import { AttributeInstance } from "..";

declare module ".." {
    interface AttributeInstance {
        vftable:VoidPointer;
        u1:VoidPointer;
        u2:VoidPointer;
        currentValue:float32_t;
        minValue:float32_t;
        maxValue:float32_t;
        defaultValue:float32_t;
    }
}

AttributeInstance.abstract({
    vftable:VoidPointer,
    u1:VoidPointer,
    u2:VoidPointer,
    currentValue: [float32_t, 0x84],
    minValue: [float32_t, 0x7C],
    maxValue: [float32_t, 0x80],
    defaultValue: [float32_t, 0x78],
});
