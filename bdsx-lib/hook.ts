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
// eslint-disable-next-line @typescript-eslint/ban-types
type EmptyOpts = {};
const emptyOpts:hook.Options = {};
Object.freeze(emptyOpts);

export function hook<T extends AnyFunction>(nf:T|null):hook.Tool<unknown, T, EmptyOpts>;
export function hook<THIS, NAME extends keyof THIS>(nf:{name:string, prototype:THIS}|null, name:NAME):hook.Tool<THIS, ShouldFunction<THIS[NAME]>, EmptyOpts>;
export function hook(ptr:VoidPointer):hook.PtrTool;

/**
 * @returns returns 'hook.fail' if it failed.
 */
export function hook(nf:{name:string, prototype:any}|AnyFunction|VoidPointer|null, name?:keyof any):hook.Tool<any, AnyFunction, EmptyOpts>|hook.PtrTool {
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
        thisType = nf as any;
        nf = nf.prototype[name] as AnyFunction;
        if (!(nf instanceof Function)) throw Error(`${(nf as any).name}.${String(name)} is not a function`);
    } else {
        name = '[Native Function]';
        if (nf instanceof VoidPointer) {
            return new hook.PtrTool(name, nf);
        }
        thisType = null;
        if (!(nf instanceof Function)) throw Error(`this is not a function`);
    }

    return new hook.Tool<any, AnyFunction, EmptyOpts>(nf as AnyFunction, String(name), thisType, emptyOpts);
}

function nameWithOffset(name:string, offset?:number|null):string {
    if (offset == null) return name;
    return `${name}+0x${offset.toString(16)}`;
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
        callOriginal?:boolean;
    }
    export class PtrTool {
        private _subject?:string;
        protected _offset?:number;

        constructor(public name:string, private readonly ptr:VoidPointer) {
        }

        /**
         * @param offset offset from target
         * @returns
         */
        offset(offset:number):this {
            this._offset = offset;
            return this;
        }

        /**
         * @param subject for printing on error
         * @returns
         */
        subject(subject:string):this {
            this._subject = subject;
            return this;
        }

        getAddress():NativePointer {
            return this.ptr.add(this._offset);
        }

        /**
         * @param ptr target pointer
         * @param originalCode old codes
         * @param ignoreArea pairs of offset, ignores partial bytes.
         */
        private _check(ptr:StaticPointer, originalCode:number[], ignoreArea?:number[]|null):boolean {
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
            const subject = this._subject || this.name;
            console.error(colors.red(`${subject}: ${nameWithOffset(subject, this._offset)}: code does not match`));
            console.error(colors.red(`[${hex(buffer)}] != [${hex(originalCode)}]`));
            console.error(colors.red(`diff: ${JSON.stringify(diff)}`));
            console.error(colors.red(`${subject}: skip`));
            return false;
        }

        /**
         * @param newCode call address
         * @param tempRegister using register to call
         * @param call true - call, false - jump
         * @param originalCode bytes comparing before hooking
         * @param ignoreArea pair offsets to ignore of originalCode
         */
        patch(newCode:VoidPointer, tempRegister:Register, call:boolean, originalCode:number[], ignoreArea?:number[]|null):void {
            const size = originalCode.length;
            const ptr = this.getAddress();
            const unlock = new MemoryUnlocker(ptr, size);
            if (this._check(ptr, originalCode, ignoreArea)) {
                hacktool.patch(ptr, newCode, tempRegister, size, call);
            }
            unlock.done();
        }

        /**
         * @param ptr target pointer
         * @param originalCode bytes comparing
         * @param ignoreArea pairs of offset, ignores partial bytes.
         */
        check(originalCode:number[], ignoreArea?:number[]|null):boolean {
            const ptr = this.getAddress();
            return this._check(ptr, originalCode, ignoreArea);
        }

        /**
         * @param originalCode bytes comparing before hooking
         * @param ignoreArea pair offsets to ignore of originalCode
         */
        writeNop(originalCode:number[], ignoreArea?:number[]|null):void {
            const ptr = this.getAddress();
            const size = originalCode.length;
            const unlock = new MemoryUnlocker(ptr, size);
            if (this._check(ptr, originalCode, ignoreArea)) {
                dll.vcruntime140.memset(ptr, 0x90, size);
            }
            unlock.done();
        }

        write(asm:X64Assembler|Uint8Array, originalCode?:number[]|null, ignoreArea?:number[]|null):void {
            const ptr = this.getAddress();
            const buffer = asm instanceof Uint8Array ? asm : asm.buffer();
            const unlock = new MemoryUnlocker(ptr, buffer.length);
            if (originalCode != null) {
                if (originalCode.length < buffer.length) {
                    console.error(colors.red(`${this._subject || this.name}: ${nameWithOffset(this.name, this._offset)}: writing space is too small`));
                    unlock.done();
                    return;
                }
                if (!this._check(ptr, originalCode, ignoreArea)) {
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
    export interface Tool<THIS, T extends AnyFunction, OPTS extends Options> extends PtrTool {
    }

    type OriginalPtr<OPTS extends Options> = OPTS extends {noOriginal:true} ? null : VoidPointer;
    type OriginalFunc<T extends AnyFunction, OPTS extends Options> = OPTS extends {noOriginal:true} ? null : T;
    type Callback<THIS, T extends AnyFunction, OPTS extends Options> = OPTS extends {callOriginal:true} ? VoidReturnFunc<THIS, T> : NonNullableParameters<THIS, T>;

    export class Tool<THIS, T extends AnyFunction, OPTS extends Options> extends dnf.Tool<THIS> {
        constructor(nf:T, name:string, thisType:Type<THIS>|null, private opts:OPTS) {
            super(nf, name, thisType);
        }

        getAddress():NativePointer {
            let v = this.getInfo()[0];
            if (this._offset != null) v += this._offset;
            return dll.current.add(v);
        }

        options<NOPTS extends Options>(opts:NOPTS):Tool<THIS, T, NOPTS> {
            this.opts = opts as any;
            return this as any;
        }

        types<TYPES extends Type<any>[]>(...types:Type<any>[]):Tool<THIS, UnwrapFunc<T, TYPES>, OPTS> {
            const overload = dnf(this.nf).getByTypes(this.thisType as any, ...types);
            if (overload === null) {
                if (this.thisType !== null) {
                    console.trace(`Failed to hook, overload not found from ${this.thisType.name}.${String(this.name)}`);
                } else {
                    console.trace(`Failed to hook, overload not found`);
                }
                return fail as any;
            }
            this.nf = overload as T;
            return this as any;
        }

        /**
         * @param key target symbol name
         * @param to call address
         */
        raw(to:VoidPointer|((original:OriginalPtr<OPTS>)=>VoidPointer)):OriginalPtr<OPTS> {
            const [rva] = this.getInfo();
            const origin = dll.current.add(rva);
            const key = this.options.name || '[hooked]';

            const REQUIRE_SIZE = 12;
            let original:VoidPointer|null = null;
            if (this.opts.callOriginal) {
                const codes = disasm.process(origin, REQUIRE_SIZE);
                const out = new X64OpcodeTransporter(origin, codes.size);
                const [keepRegister, keepFloatRegister] = this.getRegistersForParameters();
                if (keepRegister != null) {
                    for (const reg of keepRegister) {
                        out.freeregs.add(reg);
                    }
                }
                if (to instanceof Function) to = to(null as OriginalPtr<OPTS>);
                out.saveAndCall(to, keepRegister, keepFloatRegister);
                const label = out.makeLabel(null);
                out.moveCode(codes, key, REQUIRE_SIZE);
                out.end();
                const hooked = out.alloc('hook of '+key);
                if (!this.opts.noOriginal) {
                    original = hooked.add(label.offset);
                }

                const unlock = new MemoryUnlocker(origin, codes.size);
                hacktool.jump(origin, hooked, Register.rax, codes.size);
                unlock.done();
            } else {
                let unlockSize = REQUIRE_SIZE;
                if (!this.opts.noOriginal) {
                    const codes = disasm.process(origin, REQUIRE_SIZE);
                    const out = new X64OpcodeTransporter(origin, codes.size);
                    out.moveCode(codes, key, REQUIRE_SIZE);
                    out.end();
                    original = out.alloc(key+' (moved original)');
                    unlockSize = codes.size;
                }

                const unlock = new MemoryUnlocker(origin, unlockSize);
                if (to instanceof Function) to = to(original as OriginalPtr<OPTS>);
                hacktool.jump(origin, to, Register.rax, unlockSize);
                unlock.done();
            }
            return original as OriginalPtr<OPTS>;
        }

        call(callback:Callback<THIS, T, OPTS>):OriginalFunc<T, OPTS> {
            const [_, paramTypes, returnType, opts] = this.getInfo();

            const original = this.raw(original=>{
                const nopts:MakeFuncOptions<any> = {};
                (nopts as any).__proto__ = opts;
                nopts.onError = original;
                return makefunc.np(callback as any,
                    this.opts.callOriginal ? void_t : returnType,
                    nopts, ...paramTypes);
            });

            if (original === null) return null as any;
            return makefunc.js(original, returnType, opts, ...paramTypes) as any;
        }
    }
    inheritMultiple(Tool, PtrTool);

    class FailedTool extends Tool<any, AnyFunction, any>{
        constructor() {
            super(emptyFunc, '[Native Function]', null, undefined);
        }

        raw():VoidPointer|null {
            return null;
        }

        call(callback:AnyFunction):AnyFunction {
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
