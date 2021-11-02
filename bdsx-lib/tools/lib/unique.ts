import { AnyFunction } from "../../common";

const id = Symbol('id');

const replacemap:Record<string, string> = {
    '\\': '\\\\',
    '!': '\\!'
};
(replacemap as any).__proto__ = null;

interface IdContainer {
    [id]?:number;
}

// const ireplacemap:Record<string, string> = {};
// (ireplacemap as any).__proto__ = null;
// for (const key in replacemap) {
//     ireplacemap[replacemap[key]] = key;
// }

const f64 = new Float64Array(1);
const i32 = new Int32Array(f64.buffer);
let idcounter = 0;
const idmap = new Map<string, any>();

export namespace unique {
    /**
     * make a key from values
     */
    export function key(arr:ArrayLike<any>):string {
        let out = '';
        function uniqueKey(arr:ArrayLike<any>):void {
            for (let i=0;i<arr.length;i++) {
                let v = arr[i];
                switch (typeof v) {
                case 'string':
                    out += 's';
                    out += v.replace(/[\\!]/g, v=>replacemap[v]);
                    out += '!';
                    break;
                case 'boolean':
                    out += v ? 'y' : 'n';
                    break;
                case 'number': {
                    let negative = false;
                    if (v < 0) {
                        v = -v;
                        negative = true;
                    }
                    if (Math.round(v) === v && v <= Number.MAX_SAFE_INTEGER) {
                        out += negative ? 'I' : 'i';
                        out += v;
                    } else {
                        out += negative ? 'F' : 'f';
                        f64[0] = v;
                        const low = i32[0];
                        const high = i32[1];
                        out += high >> 20;
                        out += ',';
                        out += (high&0xfffff)*0x100000000 + (low>>>0);
                    }
                    break;
                }
                case 'undefined':
                    out += 'u';
                    break;
                case 'object':
                    if (v === null) {
                        out += 'l';
                        break;
                    }
                    if (v instanceof Array) {
                        out += '[';
                        uniqueKey(v);
                        out += ']';
                        break;
                    }
                    // fall through
                case 'symbol':
                case 'function':
                default: {
                    const cont:IdContainer = v;
                    v = cont[id];
                    if (v == null) {
                        v = cont[id] = ++idcounter;
                    }
                    if (v !== 0) {
                        out += 'o';
                        out += v;
                    }
                    break;
                }
                }
            }
        }
        uniqueKey(arr);
        return out;
    }

    export function ignore(obj:unknown):void {
        (obj as IdContainer)[id] = 0;
    }

    export function allocId(obj:unknown):void {
        if ((obj as IdContainer)[id] != null) return;
        (obj as IdContainer)[id] = ++idcounter;
    }

    /**
     * func(...args)
     * use the same instance if parameters are the same.
     */
    export function call<FN extends AnyFunction>(func:FN, ...args:Parameters<FN>):ReturnType<FN> {
        const keyv = key(arguments);
        let instance = idmap.get(keyv);
        if (instance == null) {
            instance = func(...args);
            instance[id] = ++idcounter;
            idmap.set(keyv, instance);
        }
        return instance;
    }

    /**
     * that.method(...args)
     * use the same instance if parameters are the same.
     */
    export function callm<THIS, KEY extends keyof THIS>(
        that:THIS, method:KEY,
        ...args:Parameters<THIS[KEY] extends AnyFunction ? THIS[KEY] : never>):
        ReturnType<THIS[KEY] extends AnyFunction ? THIS[KEY] : never> {
        const keyv = key(arguments);
        let instance = idmap.get(keyv);
        if (instance == null) {
            instance = (that[method] as any)(...args);
            allocId(instance);
            idmap.set(keyv, instance);
        }
        return instance;
    }

    /**
     * new cls(...args)
     * use the same instance if parameters are the same.
     */
    export function make<CLS extends new(...args:any[])=>any>(cls:CLS, ...args:ConstructorParameters<CLS>):InstanceType<CLS> {
        const keyv = key(arguments);
        let instance = idmap.get(keyv);
        if (instance == null) {
            instance = new cls(...args);
            instance[id] = ++idcounter;
            idmap.set(keyv, instance);
        }
        return instance;
    }
}
