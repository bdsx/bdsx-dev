import { X64OpcodeTransporter } from "./asmtrans";
import { Register, X64Assembler } from "./assembler";
import { AnyFunction, emptyFunc, NonNullableParameters } from "./common";
import { NativePointer, StaticPointer, VoidPointer } from "./core";
import { disasm } from "./disassembler";
import { dll } from "./dll";
import { dnf } from "./dnf";
import { hacktool } from "./hacktool";
import { makefunc, MakeFuncOptions } from "./makefunc";
import { Type, UnwrapTypeArrayToArray, void_t } from "./nativetype";
import { MemoryUnlocker } from "./unlocker";
import { hex, inheritMultiple, memdiff, memdiff_contains } from "./util";
import colors = require('colors');

type UnwrapFunc<T, TYPES extends Type<any>[]> = T extends AnyFunction ? (...params:UnwrapTypeArrayToArray<TYPES>)=>ReturnType<T> : never;
type ShouldFunction<T> = T extends AnyFunction ? T : never;

export function hook(nf:VoidPointer):hook.PtrTool;
export function hook<T extends AnyFunction>(nf:T|null):hook.Tool<unknown, T>;
export function hook<T extends AnyFunction, TYPES extends Type<any>[]>(nf:T|null, ...types:TYPES):hook.Tool<unknown, UnwrapFunc<T, TYPES>>;
export function hook<THIS, NAME extends keyof THIS>(nf:{name:string, prototype:THIS}|null, name:NAME, ...types:Type<any>[]):hook.Tool<THIS, ShouldFunction<THIS[NAME]>>;
export function hook<THIS, NAME extends keyof THIS, TYPES extends Type<any>[]>(nf:{name:string, prototype:THIS}|null, name:NAME, ...types:TYPES):hook.Tool<THIS, UnwrapFunc<THIS[NAME], TYPES>>|hook.PtrTool;

/**
 * @returns returns 'hook.fail' if it failed.
 */
export function hook(nf:{name:string, prototype:any}|AnyFunction|VoidPointer|null, name?:keyof any|Type<any>|null, ...types:Type<any>[]):hook.Tool<any, AnyFunction>|hook.PtrTool {
    if (nf === null) {
        console.trace(`Failed to hook, null received`);
        return hook.fail;
    }

    let thisType:Type<any>|null;
    if (name != null) {
        if (nf instanceof VoidPointer) {
            console.trace(`Failed to hook, invalid parameter`, nf);
            return hook.fail;
        }
        if (typeof name !== 'object') {
            thisType = nf as any;
            nf = nf.prototype[name] as AnyFunction;
            if (!(nf instanceof Function)) throw Error(`${(nf as any).name}.${String(name)} is not a function`);
        } else {
            thisType = null;
            types.unshift(name);
            name = '[Native Function]';
            if (!(nf instanceof Function)) throw Error(`this is not a function`);
        }
    } else {
        name = '[Native Function]';
        if (nf instanceof VoidPointer) {
            return new hook.PtrTool(name, nf.add());
        }
        thisType = null;
        if (!(nf instanceof Function)) throw Error(`this is not a function`);
    }

    if (types.length !== 0) {
        console.trace(`Failed to hook, null received`);
        const overload = dnf(nf).getByTypes(nf as any, ...types);
        if (overload === null) {
            if (thisType !== null) {
                console.trace(`Failed to hook, overload not found from ${thisType.name}.${String(name)}`);
            } else {
                console.trace(`Failed to hook, overload not found`);
            }
            return hook.fail;
        }
        nf = overload;
    }

    return new hook.Tool<any, AnyFunction>(nf as AnyFunction, String(name), thisType);
}

function nameWithOffset(name:string, offset?:number|null):string {
    if (offset == null) return name;
    return `${name}+0x${offset.toString(16)}`;
}


/**
 * @param offset offset from target
 * @param ptr target pointer
 * @param originalCode old codes
 * @param subject name of hooking
 * @param ignoreArea pairs of offset, ignores partial bytes.
 */
function check(name:string, offset:number|null|undefined, ptr:StaticPointer, originalCode:number[], subject?:string|null, ignoreArea?:number[]|null):boolean {
    const buffer = ptr.getBuffer(originalCode.length);
    const diff = memdiff(buffer, originalCode);
    if (ignoreArea == null) {
        if (diff.length !== 0) {
            return true;
        }
    } else {
        if (memdiff_contains(ignoreArea, diff)) {
            return true;
        }
    }
    if (subject == null) subject = name;
    console.error(colors.red(`${subject}: ${nameWithOffset(name, offset)}: code does not match`));
    console.error(colors.red(`[${hex(buffer)}] != [${hex(originalCode)}]`));
    console.error(colors.red(`diff: ${JSON.stringify(diff)}`));
    console.error(colors.red(`${subject}: skip`));
    return false;
}

type VoidReturnFunc<THIS, T extends AnyFunction> = T extends (...args:infer PARAMS)=>any ? NonNullableParameters<THIS, (...args:PARAMS)=>void> : never;

export namespace hook {
    export interface Options {
        /**
         * name for error or crash
         */
        name?:string;
        /**
         * do not generate the original function.
         * it will return null instead of the original function
         */
        noOriginal?:boolean;
        /**
         * call the original function at the end of the hooked function.
         * it can receive only 4 parameters.
         */
        callOriginal?:boolean
    }
    export class PtrTool {
        constructor(public readonly name:string, public readonly ptr:NativePointer) {
        }

        getAddress():NativePointer {
            return this.ptr;
        }

        /**
         * @param newCode call address
         * @param tempRegister using register to call
         * @param call true - call, false - jump
         * @param originalCode bytes comparing before hooking
         * @param offset offset from target
         * @param subject for printing on error
         * @param ignoreArea pair offsets to ignore of originalCode
         */
        patch(newCode:VoidPointer, tempRegister:Register, call:boolean, originalCode:number[], offset?:number|null, subject?:string|null, ignoreArea?:number[]|null):void {
            const size = originalCode.length;
            const ptr = this.getAddress();
            const unlock = new MemoryUnlocker(ptr, size);
            if (check(this.name, offset, ptr, originalCode, subject, ignoreArea)) {
                hacktool.patch(ptr, newCode, tempRegister, size, call);
            }
            unlock.done();
        }

        /**
         * @param offset offset from target
         * @param ptr target pointer
         * @param originalCode bytes comparing
         * @param subject for printing on error
         * @param ignoreArea pairs of offset, ignores partial bytes.
         */
        check(originalCode:number[], offset?:number|null, subject?:string|null, ignoreArea?:number[]|null):boolean {
            return check(this.name, offset, this.getAddress(), originalCode, subject, ignoreArea);
        }

        /**
         * @param offset offset from target
         * @param originalCode bytes comparing before hooking
         * @param subject for printing on error
         * @param ignoreArea pair offsets to ignore of originalCode
         */
        writeNop(originalCode:number[], offset?:number|null, subject?:string|null, ignoreArea?:number[]|null):void {
            const ptr = this.getAddress().add(offset);
            const size = originalCode.length;
            const unlock = new MemoryUnlocker(ptr, size);
            if (check(this.name, offset, ptr, originalCode, subject, ignoreArea)) {
                dll.vcruntime140.memset(ptr, 0x90, size);
            }
            unlock.done();
        }

        write(asm:X64Assembler|Uint8Array, offset?:number|null, originalCode?:number[]|null, subject?:string|null, ignoreArea?:number[]|null):void {
            const ptr = this.getAddress().add(offset);
            const buffer = asm instanceof Uint8Array ? asm : asm.buffer();
            const unlock = new MemoryUnlocker(ptr, buffer.length);
            if (originalCode != null) {
                if (subject == null) subject = this.name;
                if (originalCode.length < buffer.length) {
                    console.error(colors.red(`${subject}: ${nameWithOffset(this.name, offset)}: writing space is too small`));
                    unlock.done();
                    return;
                }
                if (!check(this.name, offset, ptr, originalCode, subject, ignoreArea)) {
                    unlock.done();
                    return;
                }
                ptr.writeBuffer(buffer);
                ptr.fill(0x90, originalCode.length - buffer.length); // nop fill
            } else {
                ptr.writeBuffer(buffer);
            }
            unlock.done();
        }
    }
    export interface Tool<THIS, T extends AnyFunction> extends PtrTool {
    }
    export class Tool<THIS, T extends AnyFunction> extends dnf.Tool<THIS> {
        raw(to:VoidPointer|((original:VoidPointer)=>VoidPointer), options?:hook.Options):VoidPointer;
        raw(to:VoidPointer|((original:null)=>VoidPointer), options:hook.Options&{noOriginal:true}):null;

        /**
         * @param key target symbol name
         * @param to call address
         */
        raw(to:VoidPointer|((original:VoidPointer|null)=>VoidPointer), options:hook.Options={}):VoidPointer|null {
            const [rva] = this.getInfo();
            const origin = dll.current.add(rva);
            const key = options.name || '[hooked]';

            const REQUIRE_SIZE = 12;
            let original:VoidPointer|null = null;
            if (options.callOriginal) {
                const codes = disasm.process(origin, REQUIRE_SIZE);
                const out = new X64OpcodeTransporter(origin, codes.size);
                const [keepRegister, keepFloatRegister] = this.getRegistersForParameters();
                if (keepRegister != null) {
                    for (const reg of keepRegister) {
                        out.freeregs.add(reg);
                    }
                }
                if (to instanceof Function) to = to(null);
                out.saveAndCall(to, keepRegister, keepFloatRegister);
                const label = out.makeLabel(null);
                out.moveCode(codes, key, REQUIRE_SIZE);
                out.end();
                const hooked = out.alloc('hook of '+key);
                if (!options.noOriginal) {
                    original = hooked.add(label.offset);
                }

                const unlock = new MemoryUnlocker(origin, codes.size);
                hacktool.jump(origin, hooked, Register.rax, codes.size);
                unlock.done();
            } else {
                let unlockSize = REQUIRE_SIZE;
                if (!options.noOriginal) {
                    const codes = disasm.process(origin, REQUIRE_SIZE);
                    const out = new X64OpcodeTransporter(origin, codes.size);
                    out.moveCode(codes, key, REQUIRE_SIZE);
                    out.end();
                    original = out.alloc(key+' (moved original)');
                    unlockSize = codes.size;
                }

                const unlock = new MemoryUnlocker(origin, unlockSize);
                if (to instanceof Function) to = to(original!);
                hacktool.jump(origin, to, Register.rax, unlockSize);
                unlock.done();
            }
            return original!;
        }

        call(callback:NonNullableParameters<THIS, T>, options?:hook.Options):T;
        call(callback:NonNullableParameters<THIS, T>, options:hook.Options&{noOriginal:true}):null;
        call(callback:VoidReturnFunc<THIS, T>, options:hook.Options&{callOriginal:true}):T;
        call(callback:VoidReturnFunc<THIS, T>, options:hook.Options&{callOriginal:true, noOriginal:true}):null;

        call(callback:NonNullableParameters<THIS, T>|VoidReturnFunc<THIS, T>, options?:hook.Options):T|null {
            const [_, paramTypes, returnType, opts] = dnf.getOverloadInfo(this.nf);

            const original = this.raw(original=>{
                const nopts:MakeFuncOptions<any> = {};
                (nopts as any).__proto__ = opts;
                nopts.onError = original;
                return makefunc.np(callback as any,
                    options?.callOriginal ? void_t : returnType,
                    nopts, ...paramTypes);
            }, options);

            if (original === null) return null;
            return makefunc.js(original, returnType, opts, ...paramTypes) as unknown as T;
        }
    }
    inheritMultiple(Tool, PtrTool);

    class FailedTool extends Tool<any, AnyFunction>{
        constructor() {
            super(emptyFunc, '[Native Function]', null);
        }

        call(callback:NonNullableParameters<any, AnyFunction>, options:hook.Options&{noOriginal:true}):null;
        call():AnyFunction;

        call(callback?:NonNullableParameters<any, AnyFunction>, options?:hook.Options&{noOriginal:true}):AnyFunction|null {
            return emptyFunc;
        }

        patch():void {
            // empty
        }

        check():boolean {
            return false;
        }
    }
    export const fail = new FailedTool;
}
