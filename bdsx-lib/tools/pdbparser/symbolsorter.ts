import { AbstractClass } from "../../common";
import { isBaseOf } from "../../util";
import { PdbId } from "./symbolparser";

enum FieldType {
    Member,
    Static,
    InNamespace,
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

export class PdbMember<T extends PdbId.Data> {
    public readonly overloads:PdbId<T>[] = [];
    public isStatic:boolean;

    private type:AbstractClass<PdbId.Data>|null = null;

    constructor(public readonly base:PdbId<PdbId.Data>) {
    }

    is<T extends PdbId.Data>(type:AbstractClass<T>):this is PdbMember<T> {
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

class IdFieldMap implements Iterable<PdbMember<any>> {

    private readonly map = new Map<string, PdbMember<any>>();

    append(list:Iterable<PdbMember<any>>, isStatic:boolean):this {
        for (const item of list) {
            this.get(item.base, isStatic).overloads.push(...item.overloads);
        }
        return this;
    }

    get(base:PdbId<PdbId.Data>, isStatic:boolean):PdbMember<any> {
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
        field = new PdbMember(base);
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

    values():IterableIterator<PdbMember<any>> {
        return this.map.values();
    }

    [Symbol.iterator]():IterableIterator<PdbMember<any>> {
        return this.map.values();
    }
}

export class PdbMemberList {
    public readonly inNamespace = new IdFieldMap;
    public readonly staticMember = new IdFieldMap;
    public readonly member = new IdFieldMap;

    push(base:PdbId<PdbId.Data>, item:PdbId<PdbId.Data>):void {
        this.getMember(base, item).push(item);
    }

    getMember<T extends PdbId.Data>(base:PdbId<PdbId.Data>, item:PdbId<T> = base as any):PdbMember<T> {
        if (base.templateBase !== null) {
            throw Error('base is template');
        }
        switch (getFieldType(item)) {
        case FieldType.Member: return this.member.get(base, false);
        case FieldType.Static: return this.staticMember.get(base, true);
        case FieldType.InNamespace: return this.inNamespace.get(base, false);
        }
    }

    sortedMember():PdbMember<any>[]{
        return [...this.member].sort(nameSort);
    }
    sortedStaticMember():PdbMember<any>[]{
        return [...this.staticMember].sort(nameSort);
    }
    sortedInNamespace():PdbMember<any>[]{
        return [...this.inNamespace].sort(nameSort);
    }
}

function nameSort(a:PdbMember<any>, b:PdbMember<any>):number {
    return a.base.name.localeCompare(b.base.name);
}

