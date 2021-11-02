
let callbacks:((()=>any)[])|null = [];

export function minecraftTsReady(callback:()=>any):void {
    if (callbacks === null) {
        callback();
        return;
    }
    callbacks.push(callback);
}

export namespace minecraftTsReady {
    export function isReady():boolean {
        return callbacks === null;
    }

    /**
     * @internal
     */
    export function resolve():void {
        if (callbacks === null) throw Error('minecraftTsReady is already resolved');
        const cbs = callbacks;
        callbacks = null;

        for (const callback of cbs) {
            callback();
        }
    }
}
