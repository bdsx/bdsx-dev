import fs = require('fs');

export class DataFileStream {
    private readonly fd:number;
    private readonly buf = Buffer.allocUnsafe(8);
    private readonly uint8v = new Uint8Array(this.buf.buffer, 0, 1);
    private readonly uint16v = new Uint16Array(this.buf.buffer, 0, 1);
    private readonly int32v = new Int32Array(this.buf.buffer, 0, 1);

    constructor(filepath:string, flags:string|number) {
        this.fd = fs.openSync(filepath, flags);
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
        fs.writeSync(this.fd, this.buf, null, i);
    }
    writeUint8(n:number):void {
        this.uint8v[0] = n;
        fs.writeSync(this.fd, this.buf, null, 1);
    }
    writeUint16(n:number):void {
        this.uint16v[0] = n;
        fs.writeSync(this.fd, this.buf, null, 2);
    }
    writeInt32(n:number):void {
        this.int32v[0] = n;
        fs.writeSync(this.fd, this.buf, null, 4);
    }
    writeBooleans(...booleans:boolean[]):void {
        const n = booleans.length >> 3;
        if (n > 4) throw Error(`boolean count too big`);

        let out = 0;
        let bit = 1;
        for (const b of booleans) {
            if (b) out |= bit;
            bit <<= 1;
        }
        switch (n) {
        case 0: break;
        case 1: this.writeUint8(out); break;
        case 2: this.writeUint16(out); break;
        case 3: case 4: this.writeInt32(out); break;
        }
    }
    writeString(str:string):void {
        const buf = Buffer.from(str+'\0');
        this.writeLeb128(buf.length);
        fs.writeSync(this.fd, buf);
    }
    writeArray<T>(values:T[], writer:(v:T, ds:DataFileStream)=>void):void {
        this.writeLeb128(values.length);
        for (const v of values) {
            writer(v, this);
        }
    }


    readLeb128():number {
        let out = 0;
        let shift = 0;
        for (;;) {
            fs.readSync(this.fd, this.buf, 0, 1, null);
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
        fs.readSync(this.fd, this.buf, 0, 1, null);
        return this.uint8v[0];
    }
    readUint16():number {
        fs.readSync(this.fd, this.buf, 0, 2, null);
        return this.uint16v[0];
    }
    readInt32():number {
        fs.readSync(this.fd, this.buf, 0, 4, null);
        return this.int32v[0];
    }
    readBooleans(n:number):boolean[] {
        let out:number;
        switch (n >> 3) {
        case 0: return [];
        case 1: out = this.readUint8(); break;
        case 2: out = this.readUint16(); break;
        case 3: case 4: out = this.readInt32(); break;
        default: throw Error(`unexpected boolean count ${n}`);
        }

        const arr = new Array(n);
        for (let i=0;i<n;i++) {
            arr[i] = ((1 << i) & out) !== 0;
        }
        return arr;
    }
    readString():string {
        const n = this.readLeb128();
        const buf = Buffer.allocUnsafe(n);
        fs.readSync(this.fd, buf, 0, n, null);
        return buf.toString('utf8');
    }
    readArray<T>(reader:(ds:DataFileStream)=>T):T[] {
        const n = this.readLeb128();
        const array = new Array(n);
        for (let i=0;i<n;i++) {
            array[i] = reader(this);
        }
        return array;
    }
}
