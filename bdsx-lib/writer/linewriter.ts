
import fs = require('fs');

export abstract class LineWriter {
    private len = 0;
    private _tab = '';
    private tabbed = false;
    public eol = '\r\n';
    public tabSize = 4;

    lineBreakIfLong(sep:string):void {
        if (this.len >= 300) {
            this._write(sep.trimRight());
            this.lineBreak();
        } else {
            this._write(sep);
        }
    }

    lineBreak():void {
        this._write(this.eol);
        this.tabbed = false;
        this.len = 0;
    }

    protected abstract _write(value:string):void;

    write(value:string):void {
        if (!this.tabbed) {
            this.tabbed = true;
            this._write(this._tab);
        }
        this.len += value.length;
        this._write(value);
    }
    writeln(line:string):void {
        this.write(line);
        this.lineBreak();
    }

    *join<T>(params:Iterable<T>, glue:string, linePerComponent?:boolean):IterableIterator<T> {
        const iter = params[Symbol.iterator]();
        let v = iter.next();
        if (linePerComponent) {
            this.lineBreak();
        }
        this.tab();
        if (!v.done) {
            yield v.value;
            while (!(v = iter.next()).done) {
                if (linePerComponent) {
                    this._write(glue.trimRight());
                    this.lineBreak();
                } else {
                    this.lineBreakIfLong(glue);
                }
                yield v.value;
            }
        }
        this.detab();
    }


    tab():void {
        this._tab += ' '.repeat(this.tabSize);
    }
    detab():void {
        this._tab = this._tab.substr(0, this._tab.length-this.tabSize);
    }


    static generateWarningComment(generatorName?:string, instead?:string):string[] {
        const out:string[] = [];
        if (generatorName != null) out.push(`Generated with ${generatorName}.`);
        else out.push(`Generated script.`);
        out.push(`Please DO NOT modify this directly.`);
        if (instead != null) {
            out.push(`If it's needed to update, Modify ${instead} instead`);
        }
        return out;
    }

    generateWarningComment(generatorName?:string, instead?:string):void {
        this.writeln('/**');
        for (const line of LineWriter.generateWarningComment(generatorName, instead)) {
            this.writeln(' * '+line);
        }
        this.writeln(' */');
    }
}

export class StringLineWriter extends LineWriter {
    public result = '';

    protected _write(content:string):void {
        this.result += content;
    }
}

export class FileLineWriter extends LineWriter {
    constructor(public readonly fd:number) {
        super();
    }

    protected _write(value:string):void {
        fs.writeSync(this.fd, value);
    }
}
