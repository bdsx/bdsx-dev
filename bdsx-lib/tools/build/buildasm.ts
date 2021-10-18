import { asmbuild } from "../asm/asmbuild";
import { buildlib } from "../lib/buildlib";

// *.asm build
let firstBuild = true;
buildlib.watchPromise('*.asm build', '.', '**/*.asm', async(files)=>{
    const dest = await files.dest('../bdsx/bdsx', '.').ext('.js', '.d.ts').modifiedFilter();
    for (const [srcFile, dstFiles] of dest.eachSources()) {
        const {js, dts} = await asmbuild(srcFile.apath);
        await dstFiles.extFilter('.js').write(js);
        await dstFiles.extFilter('.d.ts').write(dts);
    }

    if (!firstBuild) return;
    firstBuild = false;
    process.send!('firstbuild');
});
