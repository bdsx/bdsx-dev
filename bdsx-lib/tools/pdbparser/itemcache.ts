import { PdbId } from "./symbolparser";
import { tsw } from "../lib/tswriter";

interface Identifier extends PdbId<PdbId.Data> {
    cacheItem?:tsw.ItemPair|null;
}

export namespace tswItemCacheQueue {
    export const queue:[Identifier, tsw.ItemPair][][] = [];
    export const saved:Identifier[] = [];

    export function get(raw:Identifier):tsw.ItemPair|null|undefined {
        return raw.cacheItem;
    }

    export function set(raw:Identifier, data:tsw.ItemPair):void {
        raw.cacheItem = data;
        saved.push(raw);
    }

    export function save():void {
        const save:[Identifier, tsw.ItemPair][] = [];
        for (const item of saved) {
            save.push([item, item.cacheItem!]);
            item.cacheItem = null;
        }
        queue.push(save);
    }

    export function restore():void {
        const saved = queue.pop();
        if (saved == null) throw Error('no more data');
        for (const [item, cacheItem] of saved) {
            item.cacheItem = cacheItem;
        }
    }
}
