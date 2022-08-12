import fs = require('fs');
import { TypedArrayBuffer } from '../common';

export class DataFileStream {
    private readonly buf = new Uint8Array(8);
    private readonly uint8v = new Uint8Array(this.buf.buffer, 0, 1);
    private readonly uint16v = new Uint16Array(this.buf.buffer, 0, 1);
    private readonly int32v = new Int32Array(this.buf.buffer, 0, 1);

    private _fp = 0;

    constructor(public readonly fd:number) {
    }

    seek(offset:number):void {
        this._fp = offset;
    }

    tell():number {
        return this._fp;
    }

    close():void {
        fs.closeSync(this.fd);
    }

    writeLeb128(n:number):void {
        let i = 0;
        while (n >= 0x80) {
            this.buf[i++] = n | 0x80;
            n >>>= 7;
        }
        this.buf[i++] = n;
        fs.writeSync(this.fd, this.buf, 0, i, this._fp);
        this._fp += i;
    }
    writeUint8(n:number):void {
        this.uint8v[0] = n;
        fs.writeSync(this.fd, this.buf, 0, 1, this._fp);
        this._fp ++;
    }
    writeUint16(n:number):void {
        this.uint16v[0] = n;
        fs.writeSync(this.fd, this.buf, 0, 2, this._fp);
        this._fp += 2;
    }
    writeInt32(n:number):void {
        this.int32v[0] = n;
        fs.writeSync(this.fd, this.buf, 0, 4, this._fp);
        this._fp += 4;
    }
    writeBooleans(booleans:boolean[]):void {
        let out = 0;
        let shift = 1;
        for (const b of booleans) {
            if (b) out |= shift;
            shift <<= 1;
            if (shift === 0x100) {
                this.writeUint8(out);
                out = 0;
                shift = 1;
            }
        }
        if (shift !== 1) {
            this.writeUint8(out);
        }
    }
    writeString(str:string):void {
        const buf = Buffer.from(str);
        this.writeLeb128(buf.length);
        fs.writeSync(this.fd, buf, null, null, this._fp);
        this._fp += buf.length;
    }
    writeStringRaw(str:string):void {
        const buf = Buffer.from(str);
        fs.writeSync(this.fd, buf, null, null, this._fp);
        this._fp += buf.length;
    }
    writeStringSz(str:string):void {
        const buf = Buffer.from(str+'\0');
        fs.writeSync(this.fd, buf, null, null, this._fp);
        this._fp += buf.length;
    }
    writeArray<T>(values:T[], writer:(v:T, ds:DataFileStream)=>void):void {
        this.writeLeb128(values.length);
        for (const v of values) {
            writer(v, this);
        }
    }
    writeBuffer(buffer:NodeJS.ArrayBufferView):void {
        fs.writeSync(this.fd, buffer, null, null, this._fp);
        this._fp += buffer.byteLength;
    }

    readLeb128():number {
        let out = 0;
        let shift = 0;
        for (;;) {
            fs.readSync(this.fd, this.buf, 0, 1, this._fp);
            this._fp ++;
            const v = this.buf[0];
            if (v & 0x80) {
                out |= (v & 0x7f) << shift;
                shift += 7;
                if (shift > 24) throw Error('Invalid leb128 result');
            } else {
                out |= v << shift;
                return out;
            }
        }
    }
    readUint8():number {
        fs.readSync(this.fd, this.buf, 0, 1, this._fp);
        this._fp ++;
        return this.uint8v[0];
    }
    readUint16():number {
        fs.readSync(this.fd, this.buf, 0, 2, this._fp);
        this._fp += 2;
        return this.uint16v[0];
    }
    readInt32():number {
        fs.readSync(this.fd, this.buf, 0, 4, this._fp);
        this._fp += 4;
        return this.int32v[0];
    }
    readBooleans(n:number):boolean[] {
        const out = new Array(n);
        const bytes = ((n + 7) >> 3);
        let outi = 0;
        for (let i=0;i<bytes;i++) {
            const b = this.readUint8();
            let shift = 1;
            const to = Math.min(n, outi+8);
            while (outi<to) {
                out[outi++] = (b & shift) !== 0;
                shift <<= 1;
            }
        }
        return out;
    }
    readString():string {
        const n = this.readLeb128();
        const buf = Buffer.allocUnsafe(n);
        fs.readSync(this.fd, buf, 0, n, this._fp);
        this._fp += n;
        return buf.toString('utf8');
    }
    checkBuffer(buffer:Uint8Array):boolean {
        const readkey = Buffer.allocUnsafe(buffer.length);
        const n = readkey.length;
        const readSize = fs.readSync(this.fd, readkey, 0, n, this._fp);
        this._fp += n;
        if (readSize !== readkey.length) return false;
        if (!readkey.equals(buffer)) return false;
        return true;
    }
    readArray<T>(reader:(ds:DataFileStream)=>T):T[] {
        const n = this.readLeb128();
        const array = new Array(n);
        for (let i=0;i<n;i++) {
            array[i] = reader(this);
        }
        return array;
    }
    readBuffer(buffer:TypedArrayBuffer, offset:number, size:number):void {
        fs.readSync(this.fd, buffer, offset, size, this._fp);
        this._fp += size;
    }
}
