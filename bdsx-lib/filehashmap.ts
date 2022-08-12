
import * as fs from 'fs';
import { hashString } from './util';
import { DataFileStream } from './writer/datafilestream';

const buffer = new Uint32Array(1024);

export abstract class FileHashMap extends DataFileStream {
    constructor(
        public readonly fd:number,
        private readonly entrySize:number,
    ) {
        super(fd);
        if ((entrySize / 4 | 0) * 4 !== entrySize) throw TypeError(`Unexpected entry size ${entrySize}. Only multiples of 4 are allowed`);
    }

    private *_readFrom(tableSizeCount:number, startIndex:number):IterableIterator<Uint32Array> {
        let readCount:number;
        let index = startIndex;
        let readTo = tableSizeCount;
        const readAtOnce = buffer.length / this.entrySize | 0;
        const entryIntCount = this.entrySize / 4 | 0;

        const offset = this.tell();

        for (;;) {
            const readFrom = index;
            const countToEnd = readTo - index;
            if (readAtOnce < countToEnd) {
                readCount = readAtOnce;
                index += readCount;
            } else {
                readCount = countToEnd;
                index = 0;
                readTo = startIndex;
            }
            fs.readSync(this.fd, buffer, 0, readCount * this.entrySize, readFrom * this.entrySize + offset);

            const intCount = readCount*entryIntCount;
            for (let offset=0;offset<intCount;) {
                yield buffer.subarray(offset, intCount);
            }
            if (index === startIndex) break;
        }
    }

    abstract getAddress(value:Uint32Array):number;

    search(tableSizeCount:number, key:string):Uint32Array|null {
        const hash = hashString(key);
        const keyUtf8 = Buffer.from(key+'\0', 'utf8');
        for (const entry of this._readFrom(tableSizeCount, hash % tableSizeCount)) {
            if (entry[0] !== hash) continue;
            const nameAddr = this.getAddress(entry);
            if (nameAddr === 0) continue;
            this.seek(nameAddr);
            if (this.checkBuffer(keyUtf8)) {
                return entry;
            }
        }
        return null;
    }
}
