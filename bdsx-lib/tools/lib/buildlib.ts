
import chokidar = require('chokidar');
import path = require('path');
import fs = require('fs');
import { emptyFunc } from '../../common';
import { ConcurrencyQueue } from '../../concurrency';
import { fsutil } from '../../fsutil';

const WAIT_WATCH = 800;

const runningTasks = new Map<unknown, number>();
const fsTasks = new ConcurrencyQueue;

process.on('unhandledRejection', (err, promise)=>{
    if (err != null) console.error((err as any).stack || (err as any).message);
});

export namespace buildlib {
    export function getRunningTaskCount():number {
        return runningTasks.size;
    }

    export function beginPoint(taskName:string, taskIdentifier?:unknown):void {
        if (taskIdentifier == null) {
            taskIdentifier = taskName;
        }
        if (runningTasks.has(taskIdentifier)) {
            console.log(`buildlib> BEGIN ${taskName} (beginPoint again)`);
        } else {
            console.log(`buildlib> BEGIN ${taskName}`);
            runningTasks.set(taskIdentifier, Date.now());
        }
    }
    export function endPoint(taskName:string, taskIdentifier?:unknown):void {
        if (taskIdentifier == null) {
            taskIdentifier = taskName;
        }
        const from = runningTasks.get(taskIdentifier);
        if (from == null) {
            console.error(`buildlib> END ${taskName} (endPoint only)`);
            return;
        }
        runningTasks.delete(taskIdentifier);
        console.log(`buildlib> END ${taskName} (${Date.now()-from}ms)`);
    }
    export function watch(taskName:string, basedir:string, patterns:string|string[], build:(files:SourceFiles)=>Promise<void>):void {
        basedir = path.resolve(basedir);

        let reserved:Set<string>|null = null;
        let building = false;

        async function runBuild():Promise<void> {
            while (reserved !== null) {
                buildlib.beginPoint(taskName, runBuild);
                try {
                    const pathes = reserved;
                    reserved = null;

                    const files:SourceFile[] = [];
                    for (const filepath of pathes) {
                        files.push(SourceFile.parse(filepath, basedir));
                    }

                    await build(new SourceFiles(files));
                } catch (err) {
                    console.error(`buildlib> FAILED ${taskName}`);
                    console.error(err.stack);
                }
                buildlib.endPoint(taskName, runBuild);
            }
            building = false;
        }

        function onChange(path:string):void {
            if (reserved === null) reserved = new Set;
            reserved.add(path);

            if (!building) {
                building = true;
                setTimeout(runBuild, WAIT_WATCH);
            }
        }

        const watcher = chokidar.watch(patterns);
        watcher.on('add', onChange);
        watcher.on('change', onChange);
    }

    /**
     * resolve a promise after the first build
     */
    export function watchPromise(taskName:string, basedir:string, patterns:string|string[], build:(files:SourceFiles)=>Promise<void>):Promise<void> {
        return new Promise(resolve=>{
            buildlib.watch(taskName, basedir, patterns, pathes=>build(pathes).then(resolve));
        });
    }

    export class File {
        constructor(
            /**
             * base path
             */
            public readonly basedir:string,
            /**
             * absolute path
             */
            public readonly apath:string,
            /**
             * relative path from the base
             */
            public readonly rpath:string,
            /**
             * relative dir path from the base
             */
            public readonly dir:string,
            /**
             * filename only
             */
            public readonly base:string,
            /**
             * filename without extension
             */
            public readonly name:string,

            private _stat:Promise<fs.Stats>|null) {
        }

        stat():Promise<fs.Stats> {
            if (this._stat !== null) return this._stat;
            this._stat = fsutil.stat(this.apath);
            this._stat.catch(emptyFunc);
            return this._stat;
        }
    }

    export class SourceFile extends File {
        dest(toDir:string):WorkingFile {
            return new WorkingFile(
                this,
                toDir,
                path.join(toDir, this.rpath),
                this.rpath,
                this.dir,
                this.base,
                this.name,
                null,
            );
        }
        static parse(filepath:string, basedir:string = '.'):SourceFile {
            if (!path.isAbsolute(basedir)) basedir = path.resolve(basedir);
            let apath:string;
            let rpath:string;
            if (path.isAbsolute(filepath)) {
                apath = filepath;
                rpath = path.relative(basedir, filepath);
            } else {
                apath = path.join(basedir, filepath);
                rpath = filepath;
            }
            const parsed = path.parse(rpath);
            return new SourceFile(basedir, apath, rpath, parsed.dir, parsed.base, parsed.name, null);
        }
    }

    export class WorkingFile extends File {
        constructor(
            public readonly source:SourceFile,
            basedir:string,
            apath:string,
            rpath:string,
            dirname:string,
            basename:string,
            name:string,
            _stat:Promise<fs.Stats>|null) {
            super(basedir, apath, rpath, dirname, basename, name, _stat);
        }

        write(contents:string):Promise<void> {
            return fsutil.writeFile(this.apath, contents);
        }

        ext(newExt:string):WorkingFile {
            const basename = this.name+newExt;
            return new WorkingFile(
                this.source,
                this.basedir,
                path.join(this.basedir, this.dir)+path.sep+basename,
                this.dir+path.sep+basename,
                this.dir,
                basename,
                this.name,
                null,
            );
        }

        rename(mapper:(original:string)=>string):WorkingFile {
            const parsed = path.parse(mapper(this.base));
            const basename = parsed.base;
            return new WorkingFile(
                this.source,
                this.basedir,
                path.join(this.basedir, this.dir)+path.sep+basename,
                this.dir+path.sep+basename,
                this.dir,
                basename,
                parsed.name,
                null,
            );
        }

        async isModified():Promise<boolean> {
            const srcStatProm = this.source.stat();
            const destStatProm = this.stat();

            const srcStat = await srcStatProm;
            try {
                const destStat = await destStatProm;
                return +srcStat.mtime > +destStat.mtime;
            } catch (err) {
                if (err.code === 'ENOENT') return true;
                else throw err;
            }
        }

        async copy():Promise<void> {
            try {
                await fsutil.copyFile(this.source.apath, this.apath);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    throw err;
                }
                const already = await fsutil.mkdirRecursiveFromBack(path.join(this.basedir, this.dir));
                if (already) throw err;
                await fsutil.copyFile(this.source.apath, this.apath);
            }
        }
    }

    export class Files {
        constructor(public readonly files:File[]) {
        }

        async reserve():Promise<void> {
            for (const file of this.files) {
                await fsTasks.run(()=>file.stat().catch(emptyFunc));
            }
        }
    }

    export class WorkingFiles extends Files {
        public readonly files:WorkingFile[];

        constructor(files:WorkingFile[]) {
            super(files);
        }

        ext(...newExts:string[]):WorkingFiles {
            const list:WorkingFile[] = [];
            for (const file of this.files) {
                for (const newExt of newExts) {
                    list.push(file.ext(newExt));
                }
            }
            return new WorkingFiles(list);
        }
        rename(mapper:(original:string)=>string):WorkingFiles {
            const list:WorkingFile[] = [];
            for (const file of this.files) {
                list.push(file.rename(mapper));
            }
            return new WorkingFiles(list);
        }

        extFilter(ext:string):WorkingFiles {
            const list:WorkingFile[] = [];
            for (const file of this.files) {
                if (file.base.endsWith(ext)) list.push(file);
            }
            return new WorkingFiles(list);
        }

        /**
         * @returns  [trueList, falseList]
         */
        splitFilter(filter:(file:WorkingFile)=>boolean):WorkingFiles[] {
            const trueList:WorkingFile[] = [];
            const falseList:WorkingFile[] = [];
            for (const file of this.files) {
                if (filter(file)) {
                    trueList.push(file);
                } else {
                    falseList.push(file);
                }
            }
            return [
                new WorkingFiles(trueList),
                new WorkingFiles(falseList),
            ];
        }

        *eachSources():IterableIterator<[SourceFile, WorkingFiles]> {
            const src = new Map<SourceFile, WorkingFiles>();
            for (const file of this.files) {
                const list = src.get(file.source);
                if (list == null) src.set(file.source, new WorkingFiles([file]));
                else list.files.push(file);
            }
            yield * src.entries();
        }

        async modifiedFilter():Promise<WorkingFiles> {
            this.reserve();

            const list:WorkingFile[] = [];
            for (const file of this.files) {
                if (await file.isModified()) {
                    list.push(file);
                }
            }
            return new WorkingFiles(list);
        }

        async copy():Promise<void> {
            for (const file of this.files) {
                await fsTasks.run(()=>file.copy());
            }
        }

        /**
         * combine of modified and copy
         */
        async copyModified():Promise<void> {
            const list = await this.modifiedFilter();
            list.copy();
        }

        async write(contents:string):Promise<void> {
            for (const file of this.files) {
                await fsTasks.run(()=>file.write(contents));
            }
        }

        /**
         * intersected sources
         */
        intersect(other:WorkingFiles):SourceFiles {
            const map = new Set<SourceFile>();
            for (const file of this.files) {
                map.add(file.source);
            }
            const out:SourceFile[] = [];
            for (const file of other.files) {
                if (map.has(file.source)) out.push(file.source);
            }
            return new SourceFiles(out);
        }

        /**
         * union sources
         */
        union(other:WorkingFiles):SourceFiles {
            const out:SourceFile[] = [];
            const map = new Set<SourceFile>();
            for (const file of this.files) {
                map.add(file.source);
                out.push(file.source);
            }
            for (const file of other.files) {
                if (!map.has(file.source)) out.push(file.source);
            }
            return new SourceFiles(out);
        }
    }

    export class SourceFiles extends Files {
        public readonly files:SourceFile[];
        constructor(files:SourceFile[]) {
            super(files);

            // get stats in advance.
            this.reserve();
        }

        dest(...toDirs:string[]):WorkingFiles {
            const out:WorkingFile[] = [];
            for (const file of this.files) {
                for(const toDir of toDirs) {
                    out.push(file.dest(toDir));
                }
            }
            return new WorkingFiles(out);
        }

        static parse(files:string[], basedir:string = '.'):SourceFiles {
            basedir = path.resolve(basedir);
            return new SourceFiles(files.map(file=>SourceFile.parse(file, basedir)));
        }
    }

}
