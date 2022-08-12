import { fsutil } from "../fsutil";
import { StringLineWriter } from "./writer/linewriter";
import path = require('path');

export async function generateDirectoryImport(output:string, dirpath:string):Promise<void> {
    const w = new StringLineWriter;
    let rpath = path.relative(path.dirname(output), dirpath);
    if (!rpath.startsWith('.')) rpath = './'+rpath;
    rpath += '/';

    w.generateWarningComment('dirimport.ts');
    for (const file of await fsutil.readdirWithFileTypes(dirpath)) {
        let filename:string;
        if (file.name.endsWith('.ts')) {
            filename = file.name.substr(0, file.name.length-3);
        } else if (file.isDirectory()) {
            filename = file.name;
        } else {
            continue;
        }
        w.writeln(`import '${rpath}${filename}';`);
    }
    await fsutil.writeFile(output, w.result);
}
