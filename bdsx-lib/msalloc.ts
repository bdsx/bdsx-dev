import { capi } from "./capi";
import { NativePointer, StaticPointer } from "./core";
import { dllraw } from "./dllraw";
import { makefunc } from "./makefunc";
import { uint64_as_float_t } from "./nativetype";

const _Big_allocation_threshold = 4096;
const _Big_allocation_alignment = 32;

export namespace msAlloc {
    export const allocate:(bytes:number)=>NativePointer = makefunc.js(
        dllraw.bedrock_server['??$_Allocate@$0BA@U_Default_allocate_traits@std@@$0A@@std@@YAPEAX_K@Z'],
        NativePointer, null, uint64_as_float_t);
    export function deallocate(ptr:StaticPointer, bytes:number):void {
        if (bytes >= _Big_allocation_threshold) {
            ptr = ptr.getPointer(-8);
        }
        capi.free(ptr);
    }
}
