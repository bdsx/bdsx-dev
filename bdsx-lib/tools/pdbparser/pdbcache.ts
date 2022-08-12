
import * as path from 'path';
import * as fs from 'fs';
import { bedrockServerInfo } from '../lib/bedrockserverinfo';

const EOF = {};

const BUFFER_SIZE = 1024*16;
export interface SymbolInfo {
    address:number;
    name:string;
}

interface PdbCacheInfo {
    fd:number;
    lastModified:number;
}

function makePdbCache():PdbCacheInfo {
    const buffer = new Int32Array(1);
    const exeStat = bedrockServerInfo.statSync();
    try {
        const cacheStat = fs.statSync(PdbCache.path);
        if (cacheStat.mtimeMs > exeStat.mtimeMs) {
            const fd = fs.openSync(PdbCache.path, 'r');
            fs.readSync(fd, buffer, 0, 4, null);
            if (buffer[0] === PdbCache.VERSION) return {fd, lastModified: cacheStat.mtimeMs};
            fs.closeSync(fd);
        }
    } catch (err) {
    }

    bedrockServerInfo.spawnSync(path.join(__dirname, 'pdbcachewriter.ts'));

    const rfd = fs.openSync(PdbCache.path, 'r');
    fs.readSync(rfd, buffer, 0, 4, null);
    return {fd:rfd, lastModified: exeStat.mtimeMs};
}

export class PdbCache implements Iterable<SymbolInfo> {
    private readonly fd:number;
    private readonly buffer = Buffer.alloc(BUFFER_SIZE);
    private offset = 0;
    private bufsize = 0;
    public readonly total:number;
    public readonly mtime:number;

    public static readonly path = path.join(__dirname, 'pdbcachedata.bin');
    public static readonly VERSION = 3;

    constructor() {
        const res = makePdbCache();
        this.fd = res.fd;
        this.mtime = res.lastModified;
        this.total = this._readInt();
    }

    close():void {
        fs.closeSync(this.fd);
    }

    private _need(need?:number):void {
        const remained = this.bufsize - this.offset;
        if (need != null && remained >= need) return;

        this.buffer.set(this.buffer.subarray(this.offset, this.bufsize));
        const readed = fs.readSync(this.fd, this.buffer, remained, BUFFER_SIZE - remained, null);
        this.bufsize = readed + remained;
        this.offset = 0;
        if (need != null) {
            if (this.bufsize < need) {
                throw EOF;
            }
        } else {
            if (readed <= 0) {
                throw EOF;
            }
        }
    }

    private _readInt():number {
        this._need(4);
        const n = this.buffer.readInt32LE(this.offset);
        this.offset += 4;
        return n;
    }

    private _readString():string {
        let nullend = this.buffer.indexOf(0, this.offset);
        if (nullend === -1 || nullend >= this.bufsize) {
            const lastidx = this.bufsize - this.offset;
            this._need();
            nullend = this.buffer.indexOf(0, lastidx);
            if (nullend === -1|| nullend >= this.bufsize) {
                throw Error(`Null character not found, (bufsize=${this.bufsize})`);
            }
        }

        const str = this.buffer.subarray(this.offset, nullend).toString('utf8');
        this.offset = nullend+1;
        return str;
    }

    *[Symbol.iterator]():IterableIterator<SymbolInfo> {
        try {
            for (;;) {
                const address = this._readInt();
                const name = this._readString();
                yield {address, name};
            }
        } catch (err) {
            if (err !== EOF) throw err;
        }
    }
}
