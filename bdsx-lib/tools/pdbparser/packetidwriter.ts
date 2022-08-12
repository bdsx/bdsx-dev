import * as fs from 'fs';
import { bedrock_server_exe } from "../../core";
import { dll } from "../../dll";
import { makefunc } from "../../makefunc";
import { int32_t } from "../../nativetype";
import { getPacketIds } from './packetidreader';
import { PdbCache } from "./pdbcache";

const regex = /^public: virtual enum MinecraftPacketIds __cdecl ([a-zA-Z0-9_]+Packet[a-zA-Z0-9_]*)::getId\(void\)const __ptr64$/;
const cache = new PdbCache;
const unorderedIds:[number, string][] = [];
for (const symbol of cache) {
    const matched = regex.exec(symbol.name);
    if (matched === null) continue;
    const packetName = matched[1];
    const packetId = makefunc.js(dll.current.add(symbol.address), int32_t)();
    unorderedIds.push([packetId, packetName]);
}

const packetIds:Record<string, number> = {};

for (const [id, name] of unorderedIds.sort((a,b)=>a[0]-b[0])) {
    packetIds[name] = id;
}

packetIds.md5 = bedrock_server_exe.md5 as any;
fs.writeFileSync(getPacketIds.jsonPath, JSON.stringify(packetIds, null, 4));
