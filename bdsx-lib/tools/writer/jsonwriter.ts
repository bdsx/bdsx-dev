
import * as fs from 'fs';
import { addSlashes } from '../../util';

export function writeJsonToFile(filepath:string, value:unknown):Promise<void> {
    let nextLine = '\n';

    function write(str:string):Promise<void>|void {
        if (!s.write(s)) {
            return new Promise(resolve=>{
                s.once('drain', resolve);
            });
        }
    }

    async function writeStringify(value:unknown):Promise<void> {
        switch (typeof value) {
        case 'bigint': throw TypeError('Do not know how to serialize a BigInt');
        case 'function':
        case 'symbol':
        case 'undefined':
            return write('null');
        case 'number':
        case 'boolean':
            return write(value.toString());
        case 'object':
            if (value === null) {
                return write('null');
            } else {
                if (value instanceof Array) {
                    const n = value.length;
                    if (n === 0) {
                        await write('[]');
                    } else {
                        await write('[');
                        const old = nextLine;
                        nextLine += '  ';
                        await write(nextLine);
                        await writeStringify(value[0]);
                        for (let i=1;i!==n;i++) {
                            await write(',');
                            await write(nextLine);
                            await writeStringify(value[i]);
                        }
                        nextLine = old;
                        await write(nextLine);
                        await write(']');
                    }
                } else {
                    const entries = Object.entries(value);
                    const n = entries.length;
                    if (n === 0) {
                        await write('{}');
                    } else {
                        await write('{');
                        await write(nextLine);
                        let addComma = false;
                        for (const [key, v] of entries) {
                            switch (typeof v) {
                            case 'function':
                            case 'symbol':
                            case 'undefined':
                                continue;
                            }
                            if (addComma) {
                                await write(',');
                            } else {
                                addComma = true;
                            }
                            await write(nextLine);
                            await write('"');
                            await write(addSlashes(key));
                            await write('": ');
                            await writeStringify(v);
                        }
                        await write(nextLine);
                        await write('}');
                    }
                }
            }
            break;
        case 'string':
            await write('"');
            await write(addSlashes(value));
            await write('"');
            break;
        }
    }

    const s = fs.createWriteStream(filepath);
    return new Promise((resolve, reject)=>{
        let finished = false;
        function onError(err:Error):void{
            if (finished) return;
            finished = true;
            s.close();
            reject(err);
        }
        s.once('error', onError);
        writeStringify(value).then(()=>{
            if (finished) return;
            finished = true;
            s.write('\n');
            s.close();
            resolve();
        }, onError);
    });
}
