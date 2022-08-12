import { AbstractClass, unreachable } from "../../common";
import { isBaseOf } from "../../util";
import { PdbId } from "./symbolparser";

enum FieldType {
    Member,
    Static,
    InNamespace,
    FunctionBase,
}

interface Identifier extends PdbId<any> {
    dontExport?:boolean;
}

function getFieldType(item:PdbId<PdbId.Data>):FieldType {
    if (item.isStatic) {
        return FieldType.Static;
    }
    if (item.data instanceof PdbId.FunctionBase ||
        item.data instanceof PdbId.TemplateFunctionBase ||
        item.data instanceof PdbId.Function) {
        return FieldType.Member;
    }
    return FieldType.InNamespace;
}

export class PdbIdSet<T extends PdbId.Data> {
    public readonly overloads:PdbId<T>[] = [];
    public isStatic:boolean;

    private type:AbstractClass<PdbId.Data>|null = null;

    constructor(public readonly base:PdbId<PdbId.Data>) {
    }

    is<T extends PdbId.Data>(type:AbstractClass<T>):this is PdbIdSet<T> {
        if (this.type === null) {
            return false;
        }
        return isBaseOf(this.type, type);
    }

    push(item:PdbId<T>):void {
        const type = item.data.constructor;
        if (this.type !== null) {
            if (this.type !== type) {
                throw Error(`${item}: Type unmatch ${this.type.name} !== ${type.name}`);
            }
        } else {
            this.type = type;
        }
        this.overloads.push(item);
    }
}

class IdFieldMap implements Iterable<PdbIdSet<any>> {

    private readonly map = new Map<string, PdbIdSet<any>>();

    has(name:string):boolean {
        return this.map.has(name);
    }

    find(name:string):PdbIdSet<any>|undefined {
        return this.map.get(name);
    }

    append(list:Iterable<PdbIdSet<any>>, isStatic:boolean):this {
        for (const item of list) {
            this.get(item.base, isStatic).overloads.push(...item.overloads);
        }
        return this;
    }

    get(base:PdbId<PdbId.Data>, isStatic:boolean):PdbIdSet<any> {
        let nametarget:PdbId<PdbId.Data> = base;
        if (base.is(PdbId.Function)) {
            nametarget = base.data.functionBase;
        }
        if (base.templateBase !== null) {
            nametarget = base.templateBase;
        }

        let name = nametarget.name;
        if (base.is(PdbId.FunctionBase)) {
            if (base.data.isConstructor) {
                name = '#constructor';
                isStatic = false;
            } else if (base.data.isDestructor) {
                name = '#destructor';
                isStatic = false;
            }
        }

        let field = this.map.get(name);
        if (field != null) return field;
        field = new PdbIdSet(base);
        field.isStatic = isStatic;

        this.map.set(name, field);
        return field;
    }

    clear():void {
        this.map.clear();
    }

    get size():number {
        return this.map.size;
    }

    values():IterableIterator<PdbIdSet<any>> {
        return this.map.values();
    }

    [Symbol.iterator]():IterableIterator<PdbIdSet<any>> {
        return this.map.values();
    }
}

export class PdbMemberList {
    public readonly inNamespace = new IdFieldMap;
    public readonly staticMember = new IdFieldMap;
    public readonly member = new IdFieldMap;
    public readonly functionBasePtrs = new IdFieldMap;

    push(base:PdbId<PdbId.Data>, item:PdbId<PdbId.Data>):void {
        this.getSet(base, item).push(item);
    }

    getFunctionBaseSet(base:PdbId<PdbId.HasOverloads>):PdbIdSet<PdbId.Data> {
        return this.functionBasePtrs.get(base, true);
    }

    getSet<T extends PdbId.Data>(base:PdbId<PdbId.Data>, item:PdbId<T> = base as any):PdbIdSet<T> {
        if (base.templateBase !== null) {
            throw Error('base is template');
        }
        switch (getFieldType(item)) {
        case FieldType.Member: return this.member.get(base, false);
        case FieldType.Static: return this.staticMember.get(base, true);
        case FieldType.InNamespace: return this.inNamespace.get(base, false);
        default: unreachable();
        }
    }

    sortedMember():PdbIdSet<any>[]{
        return [...this.member].sort(nameSort);
    }
    sortedStaticMember():PdbIdSet<any>[]{
        return [...this.staticMember].sort(nameSort);
    }
    sortedInNamespace():PdbIdSet<any>[]{
        return [...this.inNamespace].sort(nameSort);
    }
    sortedFunctionBases():PdbIdSet<any>[]{
        return [...this.functionBasePtrs].sort(nameSort);
    }

    containsInNamespace(name:string, type:AbstractClass<PdbId.Data>):boolean {
        let item = this.staticMember.find(name);
        if (item != null && item.base.is(type)) return true;
        item = this.inNamespace.find(name);
        if (item != null && item.base.is(type)) return true;
        item = this.functionBasePtrs.find(name);
        if (item != null && item.base.is(type)) return true;
        return false;
    }


    pushField(item:Identifier):void {
        if (item.parent === null) {
            throw Error(`${item.name}: parent not found`);
        }
        if (item.dontExport) return;
        if (!PdbId.filter(item)) return;
        if (item.is(PdbId.Decorated)) return;
        if (item.is(PdbId.FunctionType)) return;
        if (item.is(PdbId.MemberPointerType)) return;
        if (item.is(PdbId.TemplateFunctionNameBase)) return;
        if (item.templateBase !== null) return; // class or function template
        if (item.is(PdbId.Function)) return;

        if (item.hasOverloads()) {
            for (const o of item.data.allOverloads()) {
                if (!PdbId.filter(o)) continue;
                if (!o.data.functionParameters.every(PdbId.filter)) {
                    continue;
                }
                if (o.parent !== null && !PdbId.filter(o.parent)) {
                    continue;
                }
                if (o.data.returnType !== null && !PdbId.filter(o.data.returnType)) {
                    continue;
                }
                this.push(item, o);
            }

            const baseset = this.getFunctionBaseSet(item);
            if (item.address !== 0) {
                baseset.push(item);
            }
            if (item.is(PdbId.TemplateFunctionBase)) {
                for (const s of item.data.specialized) {
                    if (s.address !== 0) {
                        if (!PdbId.filter(s)) return;
                        baseset.push(s);
                    }
                }
            }
        } else {
            this.push(item, item);
        }
    }

    pushAllFields(item:PdbId<PdbId.Data>):void {
        if (item.is(PdbId.TemplateBase)) {
            if (item.data.specialized.length !== 0) {
                for (const specialized of item.data.specialized) {
                    if (!PdbId.filter(specialized)) continue;
                    for (const child of specialized.children.values()) {
                        this.pushField(child);
                    }
                }
            }
        }
        for (const child of item.children.values()) {
            this.pushField(child);
        }
    }
}

function nameSort(a:PdbIdSet<any>, b:PdbIdSet<any>):number {
    return a.base.name.localeCompare(b.base.name);
}
