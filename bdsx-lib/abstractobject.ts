
/**
 * @param message error message when accessing
 */
export function createAbstractObject(message:string):any {
    function _():never { throw Error(message); }
    return new Proxy({}, {
        get: _,
        set: _,
        ownKeys: _,
        getPrototypeOf: _,
        defineProperty: _,
        isExtensible: _,
        preventExtensions: _,
        setPrototypeOf: _,
        has: _,
        deleteProperty: _,
        getOwnPropertyDescriptor: _,
    });
}

export namespace createAbstractObject {
    export function setAbstractProperty<T>(o:T, p:keyof T):void {
        Object.defineProperty(o, p, {
            get():never {
                throw Error(`'${p as string} is not ready'`);
            },
            set(value:unknown):void {
                Object.defineProperty(o, p, {value});
            },
            configurable: true
        });
    }
    export function setAbstractProperties<T>(o:T, ...properties:(keyof T)[]):void {
        const descmap:PropertyDescriptorMap = {};
        for (const prop of properties) {
            descmap[prop as string] = {
                get():never {
                    throw Error(`'${prop as string} is not ready'`);
                },
                set(value:unknown):void {
                    Object.defineProperty(o, prop, {value});
                },
                configurable: true
            };
        }
        Object.defineProperties(o, descmap);
    }
}
