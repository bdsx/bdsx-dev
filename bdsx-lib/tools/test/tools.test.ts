
import * as fs from 'fs';
import * as path from 'path';
import { asm } from '../../assembler';
import { emptyFunc } from '../../common';
import { chakraUtil } from '../../core';
import { DNFDB } from '../../dnf_db';
import { fsutil } from '../../fsutil';
import { Tester } from '../../tester';
import { dbw } from '../../dnf/dnfwriter';

Tester.test({
    dbfdb(){
        const dbFilepath = path.join(__dirname, 'dnf_db.test.dnfdb');
        dbw.create(dbFilepath);
        try {
            const cls = dbw.Class.make(dbw.root, 'cls', null);
            const func = dbw.Function.make(cls.getPropertyContainer(), 'func');
            const overload = dbw.FunctionOverload.make('a');
            overload.rva = 1000;
            func.overloads.push(overload);

            for (let i=0;i<100;i++) {
                const ns = dbw.Namespace.make(dbw.root, 'ns'+i);
                const func = dbw.Function.make(ns.getContainer(), 'func'+i);
                const overload = dbw.FunctionOverload.make('a'+i);
                overload.rva = 1000+i;
                func.overloads.push(overload);
            }

            dbw.save();

            const dnfdb = new DNFDB(dbFilepath, emptyFunc);
            const root = dnfdb.readNamespace();
            for (let i=0;i<100;i++) {
                const func = root['ns'+i]['func'+i];
                this.assert(func != null, 'ns1.func'+i);
            }
            this.assert(root.cls.prototype.func != null, 'cls.func');
        } finally {
            fs.unlinkSync(dbFilepath);
        }
    },
    async asm() {
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
