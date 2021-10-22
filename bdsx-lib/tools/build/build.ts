
import { bundle, tscompile } from 'if-tsb';
import { isMainThread, Worker, workerData } from 'worker_threads';
import { fsutil } from '../../fsutil';
import { enumgen } from '../enumgen/enumgen';
import { buildlib } from '../lib/buildlib';
import child_process = require('child_process');
import path = require('path');
import fs = require('fs');
import colors = require('colors');
import ts = require('typescript');

const tasks:Record<string, ()=>(Promise<void>|void)> = {
    async main():Promise<void> {
        await Promise.all([
            tasks.asm(),
            tasks.enums(),
        ]);
        tasks.copy();
        await tasks.v3();
        new Worker(path.join(__dirname, 'build.bundle.js'), {
            workerData: { target: 'tsc' }
        });
    },
    asm():Promise<void> {
        const asmBuildProcess = child_process.fork('./tools/bundlerun.js', ['./tools/build/buildasm.ts'], {
            execPath: '../bdsx/bedrock_server/bedrock_server.exe',
            stdio: 'inherit',
            env: {NODE_OPTIONS: ''}
        });
        const prom = new Promise<void>((resolve, reject)=>{
            asmBuildProcess.once('message', (message)=>{
                if (message === 'firstbuild') {
                    resolve();
                } else {
                    reject(Error(`Invalid response: ${JSON.stringify(message)}`));
                }
            });
        });
        function killChildren():void {
            asmBuildProcess.kill();
        }
        process.on('SIGINT', killChildren);
        process.on('SIGTERM', killChildren);
        process.on('exit', killChildren);
        return prom;
    },
    copy():void {
        buildlib.watchPromise('copy', '.', [
            '**/*.json',
            '**/*.js',
            '**/*.d.ts',
            '!**/*.bundle.js',
            '!.eslintrc.json',
            '!package.json',
            '!package-lock.json',
            '!node_modules/**/*',
            '!v3/**/*',
            '!tools/**/*',
            '!tsconfig.json',
        ], files=>files.dest('../bdsx/bdsx').copyModified());
    },
    enums():Promise<void> {
        const enums_dir = './enums_ini';
        return buildlib.watchPromise('enums_ini build', '.', enums_dir+'/*.ini', async(files)=>{
            const {js, dts} = await enumgen(enums_dir);
            const dtsPath = './minecraft_impl/enums.d.ts';
            const jsPath = './minecraft_impl/enums.js';
            await fsutil.writeFile(dtsPath, dts);
            await fsutil.writeFile(jsPath, js);
        });
    },
    v3():Promise<void> {
        return new Promise<void>(resolve=>{
            const tsconfig = bundle.getTsConfig() || {};
            tsconfig.entry = { './index.ts':'../../bdsx/bdsx/v3/index.js' };
            if (tsconfig.bundlerOptions == null) tsconfig.bundlerOptions = {};
            tsconfig.bundlerOptions!.externals = [
                '../*',
            ];
            tsconfig.compilerOptions!.typeRoots = ['../typings'];
            bundle.watch(['v3'], tsconfig, {
                onFinish: resolve
            });
        });
    },
    async tsc():Promise<void> {
        // bdsx tsc build
        const srcSet = new Set<string>();
        const destSet = new Set<string>();
        const tsconfig = bundle.getTsConfig() || {};
        const parsed = ts.parseJsonConfigFileContent(tsconfig, ts.sys, process.cwd());

        const compilerHost = ts.createIncrementalCompilerHost(parsed.options);
        compilerHost.writeFile = (file, contents)=>{
            if (!destSet.has(fsutil.replaceExt(file, '.ts'))) return;
            fs.writeFileSync(file, contents);
        };

        let program:ts.SemanticDiagnosticsBuilderProgram|undefined;

        buildlib.watch('tsc', '.', [
            '**/*.ts',
            '!**/*.d.ts',
            '!node_modules/**/*',
            '!v3/**/*',
            '!tools/**/*',
            '!externs/**/*',
            '!minecraft.d.ts',
        ], async(files)=>{
            const apathes = files.files.map(file=>file.apath);
            for (const apath of apathes) {
                srcSet.add(apath.replace(/\\/g, '/'));
            }
            for (const file of files.dest(path.resolve('../bdsx/bdsx')).files) {
                destSet.add(file.apath.replace(/\\/g, '/'));
            }

            program = ts.createSemanticDiagnosticsBuilderProgram(apathes, parsed.options, compilerHost, program);
            const res = program.emit();
            tscompile.report(res.diagnostics);
            srcSet.clear();
            destSet.clear();
        });
    }
};

const taskName = (!isMainThread && workerData && workerData.target) || 'main';
const task = tasks[taskName];
if (task != null) task();
else console.error(colors.red(`Undefined task: ${taskName}`));
