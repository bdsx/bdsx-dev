import * as fs from 'fs';
import * as path from 'path';
import { bedrockServerInfo } from '../lib/bedrockserverinfo';

export function getPacketIds():Record<string, number> {
    const bedrockStat = bedrockServerInfo.statSync();

    try {
        const stat = fs.statSync(getPacketIds.jsonPath);
        if (stat.mtimeMs >= bedrockStat.mtimeMs) {
            return JSON.parse(fs.readFileSync(getPacketIds.jsonPath, 'utf8'));
        }
    } catch (err) {
        // failed to read
    }

    const exitCode = bedrockServerInfo.spawnSync(path.join(__dirname, 'packetidwriter.ts'));
    if (exitCode !== 0) {
        process.exit(exitCode || -1);
    }
    return JSON.parse(fs.readFileSync(getPacketIds.jsonPath, 'utf8'));
}

export namespace getPacketIds {
    export const jsonPath = path.join(__dirname, 'packetids.json');
}
