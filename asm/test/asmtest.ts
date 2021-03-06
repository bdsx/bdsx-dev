
require('../../bdsx/bdsx/source-map-support').install();

import path = require('path');

import { asm } from "../../bdsx/bdsx/assembler";
import '../../bdsx/bdsx/codealloc';
import { chakraUtil } from '../../bdsx/bdsx/core';
import { fsutil } from '../../bdsx/bdsx/fsutil';
import { Tester } from '../../bdsx/bdsx/tester';

Tester.test({
    async asmtest() {
        const filepath = path.join(__dirname, 'asmtest.asm');
        const code = asm().compile(await fsutil.readFile(filepath), null, filepath);
        const codebuf = code.allocs();
        this.assert(codebuf.retvalue != null, 'retvalue not found');
        this.assert(codebuf.retvalue2 != null, 'retvalue not found');
        codebuf.retvalue.setPointer(chakraUtil.asJsValueRef(123));
        codebuf.retvalue2.setPointer(chakraUtil.asJsValueRef(456));
        codebuf.testfn2.setPointer(codebuf.testfn);

        const testfn = chakraUtil.JsCreateFunction(codebuf.test, null);
        const result = testfn();
        this.assert(result === 123, 'unexpected result');
    }
});
