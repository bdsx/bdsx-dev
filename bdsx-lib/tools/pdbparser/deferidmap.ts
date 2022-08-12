
interface PromiseHasResolve<T> extends Promise<T> {
    resolve?:(v:T)=>void;
}

export class DeferIdMap<T> {
    private readonly list:(PromiseHasResolve<T>|null)[] = [];

    get(id:number):Promise<T> {
        let value = this.list[id];
        if (value == null) {
            let resolver:(v:T)=>void;
            value = this.list[id] = new Promise(resolve=>{
                resolver = resolve;
            });
            value.resolve = resolver!;
        }
        return value;
    }

    gets(ids:number[]):Promise<T[]> {
        return Promise.all(ids.map(id=>this.get(id)));
    }

    set(id:number, value:T):void {
        const cb = this.list[id];
        if (cb != null) {
            if (cb.resolve != null) {
                cb.resolve(value);
                delete cb.resolve;
            } else {
                throw Error(`[id=${id}] already has value`);
            }
        } else {
            this.list[id] = Promise.resolve(value);
        }
    }
}
