
import util = require('util');
import { AbstractClass } from './common';

export function memdiff(dst:number[]|Uint8Array, src:number[]|Uint8Array):number[] {
    const size = src.length;
    if (dst.length !== size) throw Error(`size unmatched(dst[${dst.length}] != src[${src.length}])`);

    const diff:number[] = [];
    let needEnd = false;

    for (let i = 0; i !== size; i++) {
        if (src[i] === dst[i]) {
            if (!needEnd) continue;
            diff.push(i);
            needEnd = false;
        } else {
            if (needEnd) continue;
            diff.push(i);
            needEnd = true;
        }
    }
    if (needEnd) diff.push(size);
    return diff;
}
export function memdiff_contains(larger:number[], smaller:number[]):boolean {
    let small_i = 0;
    const smaller_size = smaller.length;
    const larger_size = larger.length;
    if (larger_size === 0) {
        return smaller_size === 0;
    }
    for (let i=0;i<larger_size;) {
        const large_from = larger[i++];
        const large_to = larger[i++];

        for (;;) {
            if (small_i === smaller_size) return true;

            const small_from = smaller[small_i];
            if (small_from < large_from) return false;
            if (small_from > large_to) break;
            if (small_from === large_to) return false;

            const small_to = smaller[small_i+1];
            if (small_to > large_to) return false;
            if (small_to === large_to) {
                small_i += 2;
                break;
            }
            small_i += 2;
        }
    }
    return true;
}
export function memcheck(code:Uint8Array, originalCode:number[], skip?:number[]):number[]|null {
    const diff = memdiff(code, originalCode);
    if (skip != null) {
        if (memdiff_contains(skip, diff)) return null;
    }
    return diff;
}
export function hex(values:number[]|Uint8Array, nextLinePer?:number):string {
    const size = values.length;
    if (size === 0) return '';
    if (nextLinePer == null) nextLinePer = size;

    const out:number[] = [];
    for (let i=0;i<size;) {
        if (i !== 0 && (i % nextLinePer) === 0) out.push(10);

        const v = values[i++];
        const n1 = (v >> 4);
        if (n1 < 10) out.push(n1+0x30);
        else out.push(n1+(0x41-10));
        const n2 = (v & 0x0f);
        if (n2 < 10) out.push(n2+0x30);
        else out.push(n2+(0x41-10));
        out.push(0x20);
    }
    out.pop();

    const LIMIT = 1024; // it's succeeded with 1024*8 but used a less number for safety
    let offset = LIMIT;
    if (out.length <= LIMIT) {
        return String.fromCharCode(...out);
    }

    // split for stack space
    let outstr = '';
    do {
        outstr += String.fromCharCode(...out.slice(offset-1024, offset));
        offset += LIMIT;
    } while (offset < out.length);
    outstr += String.fromCharCode(...out.slice(offset-1024));
    return outstr;
}
export namespace hex {
    export function format(n:number, chrwidth:number):string {
        const str = (n >>> 0).toString(16);
        return '0'.repeat(chrwidth - str.length) + str;
    }
}
export function unhex(hex:string):Uint8Array {
    const hexes = hex.split(/[ \t\r\n]+/g);
    const out = new Uint8Array(hexes.length);
    for (let i=0;i<hexes.length;i++) {
        out[i] = parseInt(hexes[i], 16);
    }
    return out;
}
export const _tickCallback:()=>void = (process as any)._tickCallback;

/**
 * @param lineIndex first line is zero
 */
export function indexOfLine(context:string, lineIndex:number, p:number = 0):number {
    for (;;) {
        if (lineIndex === 0) return p;

        const idx = context.indexOf('\n', p);
        if (idx === -1) return -1;
        p = idx + 1;
        lineIndex --;
    }
}
/**
 * removeLine("a \n b \n c", 1, 2) === "a \n c"
 * @param lineFrom first line is zero
 * @param lineTo first line is one
 */
export function removeLine(context:string, lineFrom:number, lineTo:number):string {
    const idx = indexOfLine(context, lineFrom);
    if (idx === -1) return context;
    const next = indexOfLine(context, lineTo-lineFrom, idx);
    if (next === -1) return context.substr(0, idx-1);
    else return context.substr(0, idx)+context.substr(next);
}
/**
 * @param lineIndex first line is zero
 */
export function getLineAt(context:string, lineIndex:number):string {
    const idx = indexOfLine(context, lineIndex);
    if (idx === -1) return context;

    const next = context.indexOf('\n', idx);
    if (next === -1) return context.substr(idx);
    else return context.substring(idx, next);
}

export function isBaseOf<BASE>(t: unknown, base: AbstractClass<BASE>): t is AbstractClass<BASE> {
    if (typeof t !== 'function') return false;
    if (t === base) return true;
    return t.prototype instanceof base;
}

/**
 * @deprecated use util.inspect
 */
export function anyToString(v:unknown):string {
    return util.inspect(v);
}

export function str2set(str:string):Set<number>{
    const out = new Set<number>();
    for (let i=0;i<str.length;i++) {
        out.add(str.charCodeAt(i));
    }
    return out;
}

export function str2array(str:string):number[]{
    const out = new Array(str.length);
    for (let i=0;i<str.length;i++) {
        out[i] = str.charCodeAt(i);
    }
    return out;
}

export function arrayEquals(arr1:unknown[], arr2:unknown[], count?:number):boolean {
    if (count == null) {
        count = arr1.length;
        if (count !== arr2.length) return false;
    }
    for (let i=0;i<count;i++) {
        if (arr1[i] !== arr2[i]) return false;
    }
    return true;
}

export namespace arrayEquals {
    export function deep(arr1:{equals(other:any):boolean}[], arr2:{equals(other:any):boolean}[]):boolean {
        const count = arr1.length;
        if (count !== arr2.length) return false;
        for (let i=0;i<count;i++) {
            if (!arr1[i].equals(arr2[i])) return false;
        }
        return true;
    }
}

/**
 * check elements are same
 */
export function arraySame(array:unknown[]):boolean {
    if (array.length === 0) return true;
    const first = array[0];
    for (let i=1;i<array.length;i++) {
        if (array[i] !== first) return false;
    }
    return true;
}

export function makeSignature(sig:string):number {
    if (sig.length > 4) throw Error('too long');
    let out = 0;
    for (let i=0;i<4;i++) {
        out += sig.charCodeAt(i) << (i*8);
    }
    return out;
}

export function checkPowOf2(n:number):void {
    let mask = n - 1;
    mask |= (mask >> 16);
    mask |= (mask >> 8);
    mask |= (mask >> 4);
    mask |= (mask >> 2);
    mask |= (mask >> 1);
    mask ++;
    if (mask !== n) throw Error(`${n} is not pow of 2`);
}

export function intToVarString(n:number):string {
    // 0-9 A-Z a-z _ $
    const NUMBER_COUNT = 10;
    const ALPHABET_COUNT = 26;
    const TOTAL = NUMBER_COUNT+ALPHABET_COUNT*2+2;

    const out:number[] = [];
    do {
        let v = n % TOTAL;
        n = n / TOTAL | 0;
        if (v < NUMBER_COUNT) {
            out.push(v + 0x30);
        } else {
            v -= NUMBER_COUNT;
            if (v < ALPHABET_COUNT) {
                out.push(v + 0x41);
            } else {
                v -= ALPHABET_COUNT;
                if (v < ALPHABET_COUNT) {
                    out.push(v + 0x61);
                } else {
                    v -= ALPHABET_COUNT;
                    switch (v) {
                    case 0: out.push(0x24); break; // '$'
                    case 1: out.push(0x5f); break; // '_'
                    }
                }
            }
        }
    } while (n !== 0);

    return String.fromCharCode(...out);
}

export function numberWithFillZero(n:number, width:number, radix?:number):string {
    const text = (n>>>0).toString(radix);
    if (text.length >= width) return text;
    return '0'.repeat(width-text.length)+text;
}

export function filterToIdentifierableString(name:string):string {
    name = name.replace(/[^a-zA-Z_$0-9]/g, '');
    return /^[0-9]/.test(name) ? '_'+name : name;
}

export function printOnProgress(message:string):void {
    process.stdout.cursorTo(0);
    process.stdout.write(message);
    process.stdout.clearLine(1);
    console.log();
}

export type DeferPromise<T> = Promise<T>&{resolve:(value?:T|PromiseLike<T>)=>void, reject:(reason?:any)=>void};
export namespace DeferPromise {
    export function make<T>():DeferPromise<T> {
        let resolve:((value?:T|PromiseLike<T>)=>void)|undefined;
        let reject:((reason?:any)=>void)|undefined;
        const prom = new Promise<T>((resolve_, reject_)=>{
            resolve = resolve_;
            reject = reject_;
        }) as DeferPromise<T>;
        prom.resolve = resolve!;
        prom.reject = reject!;
        return prom;
    }
}
