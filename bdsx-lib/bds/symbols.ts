import { NativePointer, pdb } from "../core";
import { UNDNAME_NAME_ONLY } from "../dbghelp";
import colors = require('colors');

let deprecateWarned = false;
function warn():void {
    if (!deprecateWarned) {
        deprecateWarned = true;
        console.error(colors.yellow("proc/proc2 is deprecated. use items in 'bdsx/minecraft'."));
    }
}

/** @deprecated use using items in 'bdsx/minecraft'*/
export const proc = new Proxy<Record<string|symbol, NativePointer>>({}, {
    get(obj:any, symbol){
        warn();
        if (typeof symbol === 'symbol') return obj[symbol];
        const values = pdb.getList(pdb.coreCachePath, {}, [symbol], false, UNDNAME_NAME_ONLY);
        return values[symbol];
    },
});
/** @deprecated use items in 'bdsx/minecraft'*/
export const proc2 = new Proxy<Record<string|symbol, NativePointer>>({}, {
    get(obj:any, symbol){
        warn();
        if (typeof symbol === 'symbol') return obj[symbol];
        const values = pdb.getList(pdb.coreCachePath, {}, [symbol]);
        return values[symbol];
    },
});
