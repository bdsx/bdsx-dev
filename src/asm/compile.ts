
import { install, remapAndPrintError } from '../bdsx/bdsx/source-map-support';
install();

import { asm } from '../bdsx/bdsx/assembler';
import { uv_async } from '../bdsx/bdsx/core';
import { ParsingError } from '../bdsx/bdsx/textparser';
import path = require('path');
import fs = require('fs');

const targetDir = path.join(__dirname, '../bdsx/bdsx/asm');

try {
    console.log(`[bdsx-asm] start`);
    const code = asm();
    const asmpath = path.join(__dirname, './asmcode.asm');
    const defines = {
        asyncSize: uv_async.sizeOfTask,
        sizeOfCxxString: 0x20,
    };
    code.compile(fs.readFileSync(asmpath, 'utf8'), defines, asmpath);
    const {js, dts} = code.toScript('..', 'asmcode', 'bdsx-dev/asm/compile.ts');
    fs.writeFileSync(path.join(targetDir, 'asmcode.js'), js);
    fs.writeFileSync(path.join(targetDir, 'asmcode.d.ts'), dts);
    console.log(`[bdsx-asm] done. no errors`);
} catch (err) {
    if (!(err instanceof ParsingError)) {
        remapAndPrintError(err);
    } else {
        console.log(`[bdsx-asm] failed`);
    }
}
