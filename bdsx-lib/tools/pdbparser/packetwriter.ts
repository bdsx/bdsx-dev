import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { tsw } from "../lib/tswriter";
import { Identifier } from "./identifier";
import type { BlockScope, TsCodeDeclaration } from "./symbolwriter";
import { tswNames } from "./tswnames";
const EOL = os.EOL;

export function writePacketTs(packetIdentifieres:[Identifier, number][], outDir:string, scope:BlockScope, decl:TsCodeDeclaration):void {
    const packetTsImport = new tsw.ImportList;
    const minecrafImport = packetTsImport.from('./minecraft');
    const packets:[tsw.Property, tsw.Value][] = [];
    const packetTypes:tsw.ClassItem[] = [];
    let inicontent = '';

    const packetTs = scope.block;
    packetTs.export(new tsw.VariableDef('const', [new tsw.VariableDefineItem(new tsw.Name('packetMap'), new tsw.ObjectType(packetTypes), new tsw.ObjectDef(packets))]));
    const minecraftPacketIds = minecrafImport.import(scope, 'MinecraftPacketIds');

    for (const [packet, packetId] of packetIdentifieres) {
        const packetName = packet.name;
        const cls = decl.doc.getValue(packetName);
        if (cls == null) {
            console.error(`[symbolwriter.ts] Packet not found: ${packetName}`);
            continue;
        }
        if (!(cls instanceof tsw.Class)) {
            console.error(`[symbolwriter.ts] Packet is not class: ${packetName}`);
            continue;
        }

        const packetNameLastIndex = packetName.lastIndexOf('Packet');
        const packetNameWithoutPacketSuffix = packetNameLastIndex !== -1 ? packetName.substr(0, packetNameLastIndex) + packetName.substr(packetNameLastIndex+6) : packetName;
        const packetIdConstant = new tsw.Constant(packetId);
        cls.unshift(new tsw.ClassField(null, true, true, tswNames.ID, new tsw.TypeName(packetId+''), packetIdConstant));
        const packetIdProp = new tsw.NumberProperty(packetId);
        const packetImported = minecrafImport.import(scope, packetName);
        const idKey = minecraftPacketIds.member(packetNameWithoutPacketSuffix);
        packetTypes.push(new tsw.ClassField(null, false, false, new tsw.BracketProperty(idKey.value), new tsw.TypeOf(packetImported.value)));
        packets.push([packetIdProp, packetImported.value]);
        packetTs.assign(packetImported.value.member(tswNames.ID), packetIdConstant);
        inicontent += packetNameWithoutPacketSuffix;
        inicontent += ' = ';
        inicontent += packetId;
        inicontent += EOL;
    }

    packetTs.unshift(...packetTsImport.toTsw());
    packetTs.cloneToJS().save(path.join(outDir, 'packetmap.js'));
    packetTs.cloneToDecl().save(path.join(outDir, 'packetmap.d.ts'));
    fs.writeFileSync(path.join(outDir, 'minecraft/enums_ini/MinecraftPacketIds.ini'), inicontent);
}
