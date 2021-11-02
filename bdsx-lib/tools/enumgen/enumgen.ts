
import path = require('path');
import { fsutil } from '../../fsutil';
import { StringLineWriter } from '../writer/linewriter';

export async function enumgen(srcDir:string):Promise<{js:string, dts:string}> {
    let comment:string|null = null;
    function writeComment():void {
        if (comment === null) return;
        switch (comment.charAt(0)) {
        case '#':
        case ';':
            dts.writeln(`//${comment.substr(1)}`);
            break;
        default:
            dts.writeln(`/**${comment} */`);
            break;
        }
        comment = null;
    }
    let nsLevel = 0;
    function closeNamespace():void {
        if (nsLevel === 0) return;
        do {
            dts.detab();
            dts.writeln(`}`);
        } while (--nsLevel !== 0);
    }

    const dts = new StringLineWriter;
    const js = new StringLineWriter;

    dts.generateWarningComment('the enum generator', 'bdsx-dev/enums_ini/*.ini');
    js.generateWarningComment('the enum generator', 'bdsx-dev/enums_ini/*.ini');
    js.writeln('const minecraft=require("../minecraft");');
    js.writeln(`let v;`);

    dts.writeln('declare module "../minecraft" {');
    dts.tab();
    const readExp = /^[ \t]*([^\s]*)[ \t]*=[ \t]*([^\s]*)[ \t]*(?:[#;][^\r\n]*)?$/gm;
    const firstIsNumber = /^[0-9]/;
    let nsCheck = '';

    for (const filename of await fsutil.readdir(srcDir)) {
        if (!filename.endsWith('.ini')) continue;
        const nsList = filename.split('.');
        nsList.pop();
        const ns = nsList.join('.');

        const content = await fsutil.readFile(path.join(srcDir, filename));
        readExp.lastIndex = 0;
        const lines = content.split(/\r?\n/g);

        js.writeln(`(minecraft.${ns}=v={}).__proto__=null;`);

        if (nsCheck !== filename) {
            closeNamespace();
            nsCheck = ns;
            nsLevel = nsList.length-1;

            for (let i=0;i<nsLevel;i++) {
                dts.writeln(`namespace ${nsList[i]} {`);
                dts.tab();
            }
        }
        const enumName = nsList[nsLevel];
        dts.writeln(`enum ${enumName} {`);
        dts.tab();

        let next:number|null = 0;
        for (let lineNumber=0;lineNumber<lines.length;lineNumber++) {
            try {
                writeComment();

                let line = lines[lineNumber];
                let idx = line.indexOf(';');
                if (idx !== -1) {
                    comment = line.substr(idx+1);
                    line = line.substr(0, idx);
                }

                let value:string|number|null = null;
                idx = line.indexOf('=');
                if (idx !== -1) {
                    value = line.substr(idx+1).trim();
                    line = line.substr(0, idx).trim();
                } else {
                    line = line.trim();
                    if (line === '') {
                        continue;
                    }
                }

                if (!value) {
                    if (next === null) {
                        throw Error(`needs value`);
                    }
                    dts.writeln(`${line},`);
                    value = next+'';
                    next++;
                } else if (firstIsNumber.test(value)) {
                    dts.writeln(`${line} = ${value},`);
                    value = +value;
                    next = value + 1;
                } else {
                    const v = JSON.parse(value);
                    if (typeof v !== 'number' && v !== 'string') {
                        throw Error(`Unexpected value`);
                    }
                    dts.writeln(`${line}=${value},`);
                    next = typeof value === 'number' ? value : null;
                }
                js.writeln(`v[v[${value}]=${JSON.stringify(line)}]=${value};`);
            } catch (err) {
                console.error(`${filename}:${lineNumber+1} ${err.message}`);
            }
        }
        writeComment();
        dts.detab();
        dts.writeln(`}`);
    }
    closeNamespace();

    dts.detab();
    dts.writeln('}');
    dts.writeln('export {};');
    return {
        dts:dts.result,
        js:js.result,
    };
}
