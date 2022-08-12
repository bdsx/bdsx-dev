
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const bundleRunPath = path.join(__dirname, '../bundlerun.js');

export namespace bedrockServerInfo {
    export interface InstallInfo {
        bdsVersion:string;
        bdsxCoreVersion:string;
        files:string[];
    }

    export const filePath = '../bdsx/bedrock_server/bedrock_server.exe';

    export function statSync():fs.Stats {
        return fs.statSync(filePath);
    }

    export function fork(tspath:string):child_process.ChildProcess {
        const process = child_process.fork(bundleRunPath, [tspath], {
            execPath: filePath,
            stdio: 'inherit',
            env: {NODE_OPTIONS: ''}
        });
        function killChildren():void {
            process.kill();
        }
        process.on('SIGINT', killChildren);
        process.on('SIGTERM', killChildren);
        process.on('exit', killChildren);
        return process;
    }

    export function spawnSync(tspath:string):number|null {
        const res = child_process.spawnSync(filePath, [bundleRunPath, tspath], {stdio:'inherit', env:{NODE_OPTIONS: ''}});
        return res.status;
    }

    export function getInstalledVersion():string {
        try {
            const info = JSON.parse(fs.readFileSync(path.dirname(filePath)+path.sep+'installinfo.json', 'utf8'));
            if (info == null) return 'unknown';
            else return info.bdsVersion || 'unknown';
        } catch (err) {
            return 'unknown';
        }
    }
}
