
import * as colors from 'colors';
import { bundle } from 'if-tsb';
import { isMainThread, workerData } from 'worker_threads';
import { fsutil } from '../../fsutil';
import { generateDirectoryImport } from '../dirimport';
import { enumgen } from '../enumgen/enumgen';
import { bedrockServerInfo } from '../lib/bedrockserverinfo';
import { buildlib } from '../lib/buildlib';

const tasks = {
    async main():Promise<void> {
        await Promise.all([
            tasks.asm(),
            tasks.enums(),
            tasks.minecraft_impl(),
        ]);
        tasks.copy();
        await tasks.v3();
    },
    asm():Promise<void> {
        return new Promise<void>((resolve, reject)=>{
            bedrockServerInfo.fork('./tools/build/buildasm.ts').once('message', (message)=>{
                if (message === 'firstbuild') {
                    resolve();
                } else {
                    reject(Error(`Invalid response: ${JSON.stringify(message)}`));
                }
            });
        });
    },
    copy():Promise<void> {
        return buildlib.watchPromise('copy', '.', [
            '**/*.dnfdb',
            'typings/**/*',
            '!node_modules/**/*',
        ], files=>files.dest('../bdsx/bdsx').copyModified());
    },
    minecraft_impl():Promise<void> {
        return buildlib.watchPromise('dirimport minecraft/ext', '.', './minecraft/ext/**/*.ts', async(files)=>{
            await generateDirectoryImport('./minecraft/ext.all.ts', './minecraft/ext');
        });
    },
    enums():Promise<void> {
        const enums_dir = './minecraft/enums_ini';
        return buildlib.watchPromise('enums_ini build', '.', enums_dir+'/*.ini', async(files)=>{
            const {js, dts} = await enumgen('.', '.', enums_dir);
            const dtsPath = './minecraft/enums.d.ts';
            const jsPath = './minecraft/enums.js';
            await fsutil.writeFile(dtsPath, dts);
            await fsutil.writeFile(jsPath, js);
        });
    },
    v3():Promise<void> {
        return new Promise<void>(resolve=>{
            const tsconfig = bundle.getTsConfig() || {};
            tsconfig.entry = { './v3/index.ts':'../bdsx/bdsx/v3.js' };
            if (tsconfig.bundlerOptions == null) tsconfig.bundlerOptions = {};
            tsconfig.compilerOptions!.typeRoots = ['../typings'];
            tsconfig.compilerOptions!.types = ['node', 'minecraft'];
            bundle.watch(['.'], tsconfig, {
                onFinish: resolve
            });
        });
    },
};

const taskName = (!isMainThread && workerData && workerData.target) || 'main';
const task = tasks[taskName as keyof typeof tasks];
if (task != null) task();
else console.error(colors.red(`Undefined task: ${taskName}`));
