import { VoidPointer } from "../core";
import { dnf } from "../dnf";
import { nativeClass, NativeClass, nativeField } from "../nativeclass";
import { CxxString, NativeType } from "../nativetype";
import minecraft = require('../minecraft');

@nativeClass()
export class HashedString extends NativeClass {
    @nativeField(VoidPointer)
    hash:VoidPointer|null;
    @nativeField(CxxString)
    str:CxxString;

    [NativeType.ctor]():void {
        this.hash = null;
    }

    set(str:string):void {
        this.str = str;
        this.hash = computeHash(this.add(str_offset));
    }
}
const str_offset = HashedString.offsetOf('str');
const computeHash = dnf(minecraft.HashedString.computeHash).reform(VoidPointer, null, VoidPointer);
