
/**
 * it defines the getter property.
 * and stores and freezes the value after calling the getter
 */
export function defineConstGetter<T, K extends keyof T>(base:T, key:K, getter:()=>T[K]):void {
    Object.defineProperty(base, key, {
        get(){
            const value = getter();
            Object.defineProperty(base, key, {value});
        },
        configurable: true
    });
}
