import { OperationSize, X64Assembler } from "../assembler";
import { tsw } from "./lib/tswriter";
import { StringLineWriter } from "./writer/linewriter";

export function asmToScript(asm:X64Assembler, bdsxLibPath:string, exportName?:string|null, generator?:string):{js:string, dts:string} {
    bdsxLibPath = bdsxLibPath.replace(/\\/g, '/');

    const buffer = asm.buffer();
    const labels = asm.labels();
    const defs = asm.defs();
    const rftable = labels['#runtime_function_table'];

    const dts = new StringLineWriter;
    const js = new StringLineWriter;
    dts.generateWarningComment(generator);
    js.generateWarningComment(generator);

    dts.writeln('');

    let imports = 'cgate';
    if (rftable != null) {
        imports += ', runtimeError';
    }
    js.writeln(`const { ${imports} } = require('${bdsxLibPath}/core');`);
    js.writeln(`const { asm } = require('${bdsxLibPath}/assembler');`);
    js.writeln(`require('${bdsxLibPath}/codealloc');`);

    const importList = new tsw.ImportList({
        existName(name){ return name in labels; },
        canAccessGlobalName(name){ return name in labels; },
    });
    const core = importList.from(`${bdsxLibPath}/core`);
    const VoidPointer = core.import('VoidPointer');
    const StaticPointer = core.import('StaticPointer');

    for (const importLine of core.toTsw()) {
        importLine.blockedWriteTo(dts);
        dts.lineBreak();
    }
    const n = buffer.length & ~1;
    js.writeln(`const buffer = cgate.allocExecutableMemory(${buffer.length+asm.getDefAreaSize()}, ${asm.getDefAreaAlign()});`);

    js.result += "buffer.setBin('";
    for (let i=0;i<n;) {
        const low = buffer[i++];
        const high = buffer[i++];

        const hex = ((high << 8) | low).toString(16);
        const count = 4-hex.length;
        js.result += '\\u';
        if (count !== 0) js.result += '0'.repeat(count);
        js.result += hex;
    }
    if (buffer.length !== n) {
        const low = buffer[n];
        const hex = ((0xcc << 8) | low).toString(16);
        const count = 4-hex.length;
        js.result += '\\u';
        if (count !== 0) js.result += '0'.repeat(count);
        js.result += hex;
    }
    js.writeln("');");
    // script.writeln();
    if (exportName != null) {
        dts.writeln(`export namespace ${exportName} {`);
        js.writeln(`exports.${exportName} = {`);
    } else {
        dts.writeln(`declare namespace asmcode {`);
        js.writeln('module.exports = {');
    }
    dts.tab();
    js.tab();

    for (const name in labels) {
        if (asm.exists(name)) continue;
        if (name.startsWith('#')) continue;
        js.writeln(`get ${name}(){`);
        js.writeln(`    return buffer.add(${labels[name]});`);
        js.writeln(`},`);
        dts.writeln(`export const ${name}:${StaticPointer};`);
    }
    for (let name in defs) {
        if (asm.exists(name)) continue;
        if (name.startsWith('#')) continue;
        let addrof:string;
        if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(name)) {
            name = JSON.stringify(name);
            addrof = JSON.stringify('addressof_'+name);
        } else {
            addrof = 'addressof_'+name;
        }

        const [offset, size] = defs[name];
        const off = buffer.length + offset;
        if (size != null) {
            switch (size) {
            case OperationSize.byte:
                js.writeln(`get ${name}(){`);
                js.writeln(`    return buffer.getUint8(${off});`);
                js.writeln(`},`);
                js.writeln(`set ${name}(n):number{`);
                js.writeln(`    buffer.setUint8(n, ${off});`);
                js.writeln(`},`);
                dts.writeln(`export let ${name}:number;`);
                break;
            case OperationSize.word:
                js.writeln(`get ${name}(){`);
                js.writeln(`    return buffer.getUint16(${off});`);
                js.writeln(`},`);
                js.writeln(`set ${name}(n){`);
                js.writeln(`    buffer.setUint16(n, ${off});`);
                js.writeln(`},`);
                dts.writeln(`export let ${name}:number;`);
                break;
            case OperationSize.dword:
                js.writeln(`get ${name}(){`);
                js.writeln(`    return buffer.getInt32(${off});`);
                js.writeln(`},`);
                js.writeln(`set ${name}(n){`);
                js.writeln(`    buffer.setInt32(n, ${off});`);
                js.writeln(`},`);
                dts.writeln(`export let ${name}:number;`);
                break;
            case OperationSize.qword:
                js.writeln(`get ${name}(){`);
                js.writeln(`    return buffer.getPointer(${off});`);
                js.writeln(`},`);
                js.writeln(`set ${name}(n){`);
                js.writeln(`    buffer.setPointer(n, ${off});`);
                js.writeln(`},`);
                dts.writeln(`export let ${name}:${VoidPointer};`);
                break;
            }
        }
        js.writeln(`get ${addrof}(){`);
        js.writeln(`    return buffer.add(${off});`);
        js.writeln(`},`);
        dts.writeln(`export const ${addrof}:${StaticPointer};`);
    }
    js.detab();
    js.writeln('};');
    dts.detab();
    dts.writeln(`}`);
    if (exportName == null) {
        dts.writeln(`export = asmcode;`);
    }

    if (rftable != null) {
        const SIZE_OF_RF = 4 * 3;
        const size = (buffer.length - rftable) / SIZE_OF_RF | 0;
        js.writeln(`runtimeError.addFunctionTable(buffer.add(${rftable}), ${size}, buffer);`);

        for (const key in labels) {
            if (key.startsWith('#')) delete labels[key];
        }
        js.writeln(`asm.setFunctionNames(buffer, ${JSON.stringify(labels)});`);
    }

    return {js: js.result, dts:dts.result};
}
