/**
 * it generates redirecting modules.
 * for `./bdsx` to `bdsx`
 * USUING
 * @internal
 */

import { ConcurrencyQueue } from "../concurrency";
import { fsutil } from "../fsutil";
import path = require('path');

async function generateRedirecter(fromdir:string, todir:string):Promise<void> {
    const taskqueue = new ConcurrencyQueue;
    async function recursive(rpath:string):Promise<void> {
        const toDirPath = todir+rpath;
        await fsutil.mkdir(toDirPath);
        const fromDirPath = fromdir+rpath;
        const files = await fsutil.readdirWithFileTypes(fromDirPath);
        for (const file of files) {
            const filename = file.name;
            if (!filename.endsWith('.js')) continue;
            if (file.isDirectory()) {
                await taskqueue.run(()=>recursive(rpath+'/'+filename));
            } else {
                await taskqueue.run(()=>fsutil.writeFile(toDirPath+'/'+filename, `\r\nrequire('')\r\nmodule.exports=require('./${relativePath}/${rpath}');\r\n`));
            }
        }
    }

    const relativePath = path.relative(fromdir, todir).replace(/\\/g, '/');
    await recursive('');
    await taskqueue.onceEnd();
}

// generateRedirecter('./bdsx/bdsx', './bdsx/bdsx');
