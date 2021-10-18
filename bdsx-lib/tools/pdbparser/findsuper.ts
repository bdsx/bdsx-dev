import { asm, Register } from "../../assembler";
import { disasm } from "../../disassembler";
import { dll } from "../../dll";
import { PdbId } from "./symbolparser";


class SuperExpecteds {
    private readonly supers = new Set<ClassId>();
    constructor(public readonly cls:ClassId) {
    }
    add(item:ClassId):void {
        if (item === this.cls) return;
        this.supers.add(item);
    }
    get():ClassId|null {
        for (const iter of this.supers.values()) {
            return iter;
        }
        return null;
    }
    set(cls:ClassId):void {
        this.supers.clear();
        this.supers.add(cls);
    }

    empty():boolean {
        return this.supers.size === 0;
    }
}

interface ClassId extends PdbId<PdbId.Class> {
    superExpected?:SuperExpecteds;
}

function getSuperFromFunctions(superList:SuperExpecteds, funcs:PdbId<PdbId.Data>[]):void {
    for (const func of funcs) {
        if (!func.is(PdbId.Function)) continue;
        const supercls = func.parent!;
        if (!supercls.is(PdbId.Class)) continue;
        superList.add(supercls);
    }
}

function getSuperFromConstructor(superList:SuperExpecteds, item:PdbId<PdbId.Function>):void {
    const ptr = dll.current.add(item.address);

    for (;;) {
        const oper = disasm.walk(ptr);
        if (oper === null) return;
        if (oper.code === asm.code.ret) return;
        if (oper.code.name.startsWith('jmp_')) return;
        if (oper.isRegisterModified(Register.rcx)) return;
        if (oper.code !== asm.code.call_c) continue;
        const addr = ptr.add(oper.args[0]).subptr(dll.current);
        const funcs = PdbId.addressMap.get(addr);
        if (funcs == null) {
            console.log(`[RVA]+0x${addr.toString(16)}: function not found`);
            continue;
        }

        for (const func of funcs) {
            if (!func.is(PdbId.Function)) continue;
            if (!func.data.isConstructor) continue;
            const supercls = func.parent!;
            if (!supercls.is(PdbId.Class)) {
                console.error(`${func} - constructor but parent is not a class`);
                continue;
            }
            superList.add(supercls);
        }
        return;
    }
}

export function resolveSuper():void {
    console.log(`[symbolwriter.ts] Resolve extended classes...`);
    for (const item of PdbId.global.loopAll()) {
        if (item.is(PdbId.Function) && item.data.isConstructor && item.address !== 0) {
            const cls = item.parent! as ClassId;
            if (cls.superExpected != null) {
                getSuperFromConstructor(cls.superExpected, item);
            } else {
                const out = new SuperExpecteds(cls);
                getSuperFromConstructor(out, item);
                if (!out.empty()) {
                    cls.determine(PdbId.Class);
                    cls.superExpected = out;
                }
            }
        } else if (item.is(PdbId.Class)) {
            const vftable = item.getChild("`vftable'");
            if (vftable !== null) {
                for (let addr = vftable.address;;addr += 8) {
                    const funcs = PdbId.addressMap.get(addr);
                    if (funcs == null) break;
                    // getSuperFromFunctions();
                }
            }
        }
    }
}

export namespace resolveSuper {
    export function getSuper(cls:ClassId):ClassId|null {
        const superlist = cls.superExpected;
        if (superlist == null) return null;
        return superlist.get();
    }
    export function setSuper(cls:ClassId, supercls:ClassId):void {
        if (cls.superExpected == null) {
            cls.superExpected = new SuperExpecteds(cls);
        }
        cls.superExpected.set(supercls);
    }
}
