
import { asm } from '../../assembler';
import { uv_async } from '../../core';
import { fsutil } from '../../fsutil';
import { asmToScript } from '../asmwrite';
import path = require('path');

const defines = {
    asyncSize: uv_async.sizeOfTask,
    sizeOfCxxString: 0x20,
};

const bdsxLibPath = path.join(__dirname, '../..');

export async function asmbuild(source:string):Promise<{js:string, dts:string}> {
    const contents = await fsutil.readFile(source);

    const code = asm();
    code.compile(contents, defines, source);
    const parsedPath = path.parse(source);
    return asmToScript(code, path.relative(parsedPath.dir, bdsxLibPath), null, 'bdsx-dev/src/tools/asm/compile.ts');
}
