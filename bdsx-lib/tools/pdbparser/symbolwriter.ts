
import * as child_process from 'child_process';
import * as path from 'path';
import * as ProgressBar from "progress";
import { unreachable } from "../../common";
import { remapAndPrintError } from "../../source-map-support";
import { iterateAll } from "../../util";
import { styling } from "../bds-scripting/styling";
import { bedrockServerInfo } from '../lib/bedrockserverinfo';
import { dbw } from "../../dnf/dnfwriter";
import { tsw } from "../lib/tswriter";
import { unique } from "../../unique";
import { ScopeMethod } from "../lib/unusedname";
import { StringLineWriter } from "../writer/linewriter";
import { Identifier, TemplateRedirect, ToTswOptions } from "./identifier";
import { getPacketIds } from './packetidreader';
import { writePacketTs } from './packetwriter';
import { FunctionMerge } from './functionmerge';
import { reduceTemplateTypes } from "./reducetemplate";
import { DecoSymbol, PdbId } from "./symbolparser";
import { PdbIdSet, PdbMemberList } from "./symbolsorter";
import { TemplateInfo } from "./templateinfo";
import { TsFile } from "./tsimport";
import { tswNames } from "./tswnames";
import { DefaultWrapper, ImportItem, ImportWrapper, RefWrapper, ResItem, TypeWrapper, WrappedItem } from "./tswrapperutil";

const installedBdsVersion = bedrockServerInfo.getInstalledVersion();

const outDir = path.join(__dirname, '../..');
const COMMENT_SYMBOL = false;
const LAMBDA_REGEXP = /^<(lambda_[a-z0-9]*)>$/;

const primitiveTypes = new Set<string>();
primitiveTypes.add('int32_t');
primitiveTypes.add('uint32_t');
primitiveTypes.add('int16_t');
primitiveTypes.add('uint16_t');
primitiveTypes.add('int8_t');
primitiveTypes.add('uint8_t');
primitiveTypes.add('float32_t');
primitiveTypes.add('float64_t');
primitiveTypes.add('CxxString');

const specialNameRemap = new Map<string, string>();
specialNameRemap.set("`vector deleting destructor'", '__vector_deleting_destructor');
specialNameRemap.set("`scalar deleting destructor'", '__scalar_deleting_destructor');
specialNameRemap.set("`vbase destructor'", '__vbase_destructor');
specialNameRemap.set('any', 'any_');
specialNameRemap.set('make', 'make_');
specialNameRemap.set('string', 'string_');
specialNameRemap.set('function', 'function_');
specialNameRemap.set('add', 'add_');
specialNameRemap.set('null', '_null');
specialNameRemap.set('finally', 'finally_');
specialNameRemap.set('yield', 'yield_');
specialNameRemap.set('construct', 'construct_');
specialNameRemap.set("`vftable'", 'vftable');
specialNameRemap.set("`vbtable'", 'vbtable');
specialNameRemap.set('operator new', 'operator_new');
specialNameRemap.set('operator new[]', 'operator_new_array');
specialNameRemap.set('operator delete', 'operator_delete');
specialNameRemap.set('operator delete[]', 'operator_delete_array');
specialNameRemap.set('operator=', 'operator_mov');
specialNameRemap.set('operator+', 'operator_add');
specialNameRemap.set('operator-', 'operator_sub');
specialNameRemap.set('operator*', 'operator_mul');
specialNameRemap.set('operator/', 'operator_div');
specialNameRemap.set('operator%', 'operator_mod');
specialNameRemap.set('operator+=', 'operator_add_mov');
specialNameRemap.set('operator-=', 'operator_sub_mov');
specialNameRemap.set('operator*=', 'operator_mul_mov');
specialNameRemap.set('operator/=', 'operator_div_mov');
specialNameRemap.set('operator%=', 'operator_mod_mov');
specialNameRemap.set('operator==', 'operator_e');
specialNameRemap.set('operator!=', 'operator_ne');
specialNameRemap.set('operator>', 'operator_gt');
specialNameRemap.set('operator<', 'operator_lt');
specialNameRemap.set('operator>=', 'operator_gte');
specialNameRemap.set('operator<=', 'operator_lte');
specialNameRemap.set('operator>>', 'operator_shr');
specialNameRemap.set('operator<<', 'operator_shl');
specialNameRemap.set('operator&', 'operator_and');
specialNameRemap.set('operator|', 'operator_or');
specialNameRemap.set('operator^', 'operator_xor');
specialNameRemap.set('operator()', 'operator_call');
specialNameRemap.set('operator[]', 'operator_index');
specialNameRemap.set('operator++', 'operator_inc');
specialNameRemap.set('operator--', 'operator_dec');
specialNameRemap.set('operator->', 'operator_der');
specialNameRemap.set('getString', 'getString_');
specialNameRemap.set('getBoolean', 'getBoolean_');
specialNameRemap.set('fill', 'fill_');

class IgnoreThis {
    constructor(public message:string) {
    }

    commentTo(block:tsw.Block|tsw.Class, info:unknown):void {
        block.comment(`ignored: ${info}`);
        block.comment(`  ${this.message}`);
    }
}

const adjustorRegExp = /^(.+)`adjustor{([0-9]+)}'$/;
const idremap:Record<string, string> = {'{':'','}':'',',':'_','<':'_','>':'_'};
const recursiveCheck = new Set<Identifier>();

PdbId.filter = (item:Identifier):boolean=>{
    if (item.filted != null) return item.filted;
    item = item.decay();
    if ((item.data instanceof PdbId.FunctionBase ||
        item.data instanceof PdbId.TemplateFunctionBase ||
        item.data instanceof PdbId.Function ||
        item.data instanceof PdbId.ClassLike ||
        item.data instanceof PdbId.TemplateClassBase) &&
        item.parent === PdbId.std &&
        item.name.startsWith('_') &&
        !item.name.startsWith('_Ref_count_obj2')) {
        return item.filted = false;
    }
    if (item.hasArrayTemplateParam()) {
        return item.filted = false;
    }
    if (item.is(PdbId.Function) && item.data.functionBase.templateBase !== null && item.data.hasArrayParam()) {
        return item.filted = false;
    }
    if (item.name === "`anonymous namespace'") return item.filted = false;
    if (item.name.startsWith('<unnamed-type-')) return item.filted = false;
    if (item.data instanceof PdbId.KeyType) return item.filted = false;
    for (const comp of item.components()) {
        if (!PdbId.filter(comp)) {
            return item.filted = false;
        }
    }
    return item.filted = true;
};

function getFirstIterableItem<T>(item:Iterable<T>):T|undefined {
    for (const v of item) {
        return v;
    }
    return undefined;
}

function isPrimitiveType(item:ResItem, raw:Identifier):boolean {
    if (raw.is(PdbId.Enum)) return true;
    if (!(item.type instanceof tsw.TypeName)) return false;
    if (!primitiveTypes.has(item.type.name)) return false;
    if (!(item.value instanceof tsw.Name)) return false;
    if (!primitiveTypes.has(item.value.name)) return false;
    return true;
}

class Definer {
    public item:Identifier;

    constructor(name:string|PdbId<PdbId.Data>) {
        this.item = name instanceof PdbId ? name : PdbId.parse(name);
    }

    paramName(name:string):this {
        this.item.paramVarName = name;
        return this;
    }

    js(jsType:[string, TsFile]|((item:Identifier)=>ResItem)|ImportItem|ResItem|null, opts:{
        jsTypeNullable?:boolean,
        jsTypeOnly?:tsw.Type,
        exportOriginal?:boolean,
    } = {}):this {
        if (jsType instanceof Array) {
            const [name, host] = jsType;
            this.item.jsType = new ImportItem(minecraft, host, name);
        } else {
            this.item.jsType = jsType;
        }
        this.item.jsTypeOnly = opts.jsTypeOnly;
        this.item.dontExport = !opts.exportOriginal;
        this.item.filted = true;
        if (opts.jsTypeNullable != null) this.item.jsTypeNullable = opts.jsTypeNullable;
        return this;
    }

    templateRedirect(
        templateRedirect:(scope:BlockScope, item:PdbId<PdbId.TemplateBase>, templates:Identifier[], opts:ToTswOptions)=>ResItem,
        opts:{
        exportOriginal?:boolean,
    } = {}):this {
        if (this.item.templateBase === null) {
            throw Error(`templateRedirect but is not template`);
        }
        const params = this.item.templateParameters;
        if (params === null) {
            throw Error(`templateRedirect but no templateParameters`);
        }

        this.item = this.item.templateBase;
        this.item.filted = true;
        if (this.item.templateRedirects == null) this.item.templateRedirects = [];
        this.item.templateRedirects.push({
            templates: params,
            redirect: templateRedirect
        });
        if (!opts.exportOriginal) this.item.dontExport = true;
        return this;
    }
}

namespace imports {
    export const nativetype = new TsFile('../nativetype');
    export const cxxvector = new TsFile('../cxxvector');
    export const complextype = new TsFile('../complextype');
    export const dnf = new TsFile('../dnf');
    export const nativeclass = new TsFile('../nativeclass');
    export const dll = new TsFile('../dll');
    export const core = new TsFile('../core');
    export const common = new TsFile('../common');
    export const pointer = new TsFile('../pointer');
    export const sharedpointer = new TsFile('../sharedpointer');
    export const jsonvalue = new TsFile('../jsonvalue');
}

class FunctionMaker {
    public opts:dbw.FuncOptions|null = null;
    public returnType:ResItem;
    public parameters:ResItem[];
    public parameterNames:tsw.Name[];
    private paramDeclares:tsw.DefineItem[]|null = null;

    constructor(
        public readonly scope:BlockScope,
        public readonly isStatic:boolean,
        returnType:Identifier,
        parameters:Identifier[],
        public readonly classType:ResItem|null) {
        if (!isStatic && classType != null) {
            if (this.opts === null) this.opts = {};
            this.opts.this = classType.value;
        }
        this.returnType = scope.convertReturnType(returnType, this.opts, true);
        this.parameters = scope.convertParameters(parameters, true);
        this.parameterNames = makeParamNamesByTypes(parameters);
    }

    private _getParamDeclares():tsw.DefineItem[] {
        if (this.paramDeclares !== null) return this.paramDeclares;

        const parameters = this.parameters.map(v=>v.type);
        const names = this.parameterNames.slice();
        // if (this.classType != null) {
        //     if (this.classType.type instanceof tsw.TemplateType) {
        //         if (this.isStatic) {
        //             parameters.unshift(NativeClassType.wrap(this.scope, this.classType).type);
        //         } else {
        //             parameters.unshift(this.classType.type);
        //         }
        //         names.unshift(tsw.Name.this);
        //     }
        // }
        return this.paramDeclares = makeParameterDecls(parameters, names);
    }

    makeType():ResItem {
        return ResItem.make(
            dbw.FunctionType.make(
                this.returnType.value,
                this.opts,
                this.parameters.map(id=>id.value)),
            unique.make(tsw.FunctionType, this.returnType.type, this._getParamDeclares())
        );
    }

    make(overload:Identifier):dbw.FunctionOverload {
        const value = dbw.FunctionOverload.make(overload);
        value.rva = overload.address;
        value.type = dbw.FunctionType.make(this.returnType.value, this.opts, this.parameters.map(pair=>pair.value));
        value.templateParams = this.scope.convertOwnTemplateTypeVars(overload);
        return value;
    }
}

class ParsedFunction {
    value:dbw.FunctionOverload;
    classType:ResItem|null;

    constructor(scope:BlockScope, name:tsw.Property, field:PdbIdSet<PdbId.Function>, overload:Identifier, merge:FunctionMerge) {
        if (!overload.is(PdbId.Function)) throw Error(`is not function(${overload})`);
        if (overload.data.returnType === null) throw Error(`Unresolved return type (${overload})`);
        if (overload.parent === null) throw Error(`is function but no parent`);

        this.classType = scope.convertClassTypeOfParent(overload, true);
        const func = new FunctionMaker(
            scope,
            field.isStatic,
            overload.data.returnType, overload.data.functionParameters, this.classType);

        this.value = func.make(overload);
        let thisType:tsw.Type|null = null;

        if (func.classType != null) {
            thisType = func.classType.type;
            if (func.isStatic) {
                thisType = new tsw.TemplateType(NativeClassType.importType(ScopeMethod.empty), [thisType]);
            }
        }


        const paramTypes = func.parameters.map(item=>item.type);

        merge.add(
            func.returnType.type,
            thisType,
            paramTypes,
            func.parameterNames,
            func.isStatic,
        );

        if (overload.templateBase !== null) {
            const tinfo = TemplateInfo.from(overload);
            const tparameters = tinfo.getOwnParametersOnly();
            if (tparameters.length !== 0) {
                const names = scope.makeTemplateNames(tparameters.length);
                const types = scope.makeTemplateParamTypes(tparameters);
                const funcType = func.makeType();
                merge.add(
                    funcType.type,
                    thisType,
                    types,
                    names,
                    func.isStatic,
                );
            }
        }
    }
}

class TsCode {
    public readonly doc = new tsw.Block;
    public readonly imports:tsw.ImportList;
    public readonly defs = new tsw.VariableDef('const', []);

    constructor(public readonly base:MinecraftTsFile) {
        this.imports = base.imports;
        this.doc.write(this.defs);
    }

    getIdName(item:Identifier):string {
        if (item.typeDefFrom !== null) {
            return getIdName(item.typeDefFrom);
        }
        if (item.templateBase !== null) {
            return getIdName(item.templateBase)+'_'+item.templateParameters!.map(id=>getIdName(id)).join('_');
        }
        if (item.data instanceof PdbId.Decorated) {
            return getIdName(item.data.base);
        }
        if (item.data instanceof PdbId.MemberPointerType) {
            return getIdName(item.data.memberPointerBase)+'_m';
        }
        if (item.data instanceof PdbId.MemberFunctionType) {
            return getIdName(item.data.memberPointerBase)+'_fn';
        }
        const nameobj = getIdNameOnly(item);
        if (!(nameobj instanceof tsw.NameProperty)) throw Error(`is not name(${item})`);
        let name = nameobj.name.replace(/[{},<>]/g, v=>idremap[v]);
        if (name.startsWith('-')) {
            name = 'minus_'+name.substr(1);
        }
        if (item.parent !== null && item.parent !== PdbId.global) {
            name = getIdName(item.parent) + '_' + name;
        }
        return name;
    }

    defineType(item:Identifier, type:tsw.Type):tsw.BlockItem {
        const name = getIdNameOnly(item);
        return new tsw.Export(new tsw.TypeDef(name.toName().type, type));
    }

    getClassDeclaration(name:tsw.Property, type:tsw.Type|null, isReadonly:boolean, isStatic:boolean):tsw.ClassItem {
        return new tsw.ClassField(null, isStatic, isReadonly, name, type);
    }
}

function typeNameToValueName(type:tsw.Type):tsw.Value {
    if (type instanceof tsw.TypeMember) {
        return unique.make(tsw.Member, typeNameToValueName(type.item), type.property);
    }
    if (type instanceof tsw.TypeName) {
        return unique.make(tsw.Name, type.name);
    }
    throw Error(`converting failed ${type}`);
}

function propertyToKey(name:tsw.Property):string {
    if (name instanceof tsw.NameProperty) {
        return name.name;
    } else if (name instanceof tsw.BracketProperty) {
        if (minecraft.isDtor(name)) {
            return '#dtor'; // NativeType.dtor
        } else if (minecraft.isCtor(name)) {
            return '#ctor'; // NativeType.ctor
        }
    }
    throw Error(`Unexpected property ${name}`);
}
ResItem.propertyToKey = propertyToKey;

class DefineScope {
    constructor(
        public readonly scope:BlockScope,
        public readonly block:tsw.Block|tsw.Class,
        public readonly isClassScope:boolean,
        public readonly container:dbw.Container,
    ) {
    }

    private _writeFunctionMember(field:PdbIdSet<PdbId.Function>):void {
        try {
            const overloads = field.overloads;
            if (overloads.length === 0) {
                throw Error(`empty overloads`);
            }
            if (!this.isClassScope && field.isStatic) {
                throw Error(`${overloads[0]}: is static but not in the class`);
            }
            const name = getIdNameOnly(field.base);
            if (!this.isClassScope && !(name instanceof tsw.NameProperty)) {
                throw Error(`insideOfClass=false but name=${name}`);
            }

            const merge = new FunctionMerge;

            for (const overload of overloads) {
                try {
                    if (COMMENT_SYMBOL) this.block.comment(overload.symbolIndex+': '+overload.source);
                    if (overload.data.returnType === null) throw Error(`Unresolved return type (${overload})`);
                    const func = new ParsedFunction(this.scope, name, field, overload, merge);

                    const cls = func.classType && func.classType.value;
                    const isMethod = func.classType !== null && !field.isStatic;
                    if (isMethod) {
                        if (cls === null) {
                            throw Error(`${overload} is static, but no class`);
                        }
                    }
                    const container = isMethod ? cls!.getPropertyContainer() : cls !== null ? cls.getContainer() : this.container;
                    const overloads = dbw.Function.make(container, field.base.name);
                    overloads.overloads.push(func.value);
                } catch (err) {
                    if (!(err instanceof IgnoreThis)) {
                        PdbId.printOnProgress(`> Writing ${overload} (symbolIndex=${overload.symbolIndex})`);
                        throw err;
                    }
                    this.block.comment(`ignored: ${overload}`);
                    this.block.comment(`  ${err.message}`);
                }
            }

            merge.reduce();
            for (const fn of merge.entries()) {
                this.block.addFunctionDecl(name, fn.params, fn.returnType, fn.isStatic, fn.templates);
            }

        } catch (err) {
            if ((err instanceof IgnoreThis)) {
                err.commentTo(this.block, field.base.name);
            } else {
                PdbId.printOnProgress(`> Writing ${field.base} (symbolIndex=${field.base.symbolIndex})`);
                throw err;
            }
        }
    }

    private _writeRedirect(item:Identifier):dbw.Redirect {
        if (!item.is(PdbId.TypeDef)) {
            throw Error(`[symbolwriter.ts] ${item}: is not typedef`);
        }
        if (this.block instanceof tsw.Class) {
            throw Error(`cannot write the redirect inside of the class`);
        }
        const ori = item.data.typeDef;
        const from = ori.typeDefFrom;
        ori.typeDefFrom = null;
        const type = this.scope.convert(ori).type;
        const typeWithoutTemplate = this.scope.convert(ori.removeTemplateParameters(), {noTemplate:true}).type;

        if (COMMENT_SYMBOL) this.block.comment(ori.symbolIndex+': '+ori.source);
        this.block.write(decl.defineType(item, type));
        const typeOfThis = new tsw.TypeOf(typeNameToValueName(typeWithoutTemplate));
        const classType = NativeClassType.importType(this.scope).template(type).and(typeOfThis);
        const name = getIdNameOnly(item);
        const target = this.scope.convert(ori).value;
        if (!(target instanceof dbw.Item)) throw Error(`${item}, is addressed item`);
        this.block.addVariable(name, classType, true, true);
        ori.typeDefFrom = from;
        return dbw.Redirect.make(this.scope.impl_getParent(item), propertyToKey(name), target);
    }

    private _writeVariable(nameProp:tsw.Property, overloads:Identifier[], getType:(v:Identifier)=>(ResItem|null)):void {
        if (overloads.length === 0) return;
        const templateGetters = new Set<string>();

        interface FieldInfo {
            container:dbw.Container;
            overload:Identifier;
            type:ResItem|null;
            tparameters:(Identifier|Identifier[])[];
            tparametersFull:(Identifier|Identifier[])[];
        }

        const infos:FieldInfo[] = [];
        let sameType:ResItem|null|undefined;
        let isSameType = true;

        for (const overload of overloads) {
            if (overload.address === 0) continue;

            try {
                const type = getType(overload);
                if (isSameType) {
                    if (sameType === undefined) {
                        sameType = type;
                    } else {
                        if (sameType !== type) {
                            isSameType = false;
                        }
                    }
                }
                const tinfo = TemplateInfo.from(overload);
                infos.push({
                    container: this.scope.impl_getParent(overload),
                    overload,
                    type,
                    tparameters: tinfo.getOwnParametersOnly(),
                    tparametersFull: tinfo.parameters
                });
            } catch (err) {
                if ((err instanceof IgnoreThis)) {
                    err.commentTo(this.block, overload);
                } else {
                    throw err;
                }
            }
        }
        if (infos.length === 0) return;
        if (isSameType && infos.length !== 1) {
            for (const info of infos) {
                if (info.tparameters.length !== 0) {
                    isSameType = false; // use getter for the template value
                    break;
                }
            }
        }

        let name = propertyToString(nameProp);
        const hasType = this.scope.members.containsInNamespace(name, PdbId.FunctionBase);
        if (isSameType) {
            let type:tsw.Type;
            let isReadOnly = false;

            if (sameType === null) {
                type = StaticPointer.importType(this.scope);
                isReadOnly = true;
                if (hasType) name += '_ptr';
            } else {
                type = sameType!.type;
                if (hasType) name += '_var';
            }

            const nameres = unique.make(tsw.NameProperty, name);
            this.block.addVariable(nameres, type, true, isReadOnly);
            for (const info of infos) {
                try {
                    this.scope.impl_variable(info.container, nameres, info.overload, info.type);
                } catch (err) {
                    if ((err instanceof IgnoreThis)) {
                        err.commentTo(this.block, info.overload);
                    } else {
                        throw err;
                    }
                }
            }
        } else {
            for (const info of infos) {
                try {
                    if (info.tparametersFull.length !== 0) {
                        // add impl
                        let getterName = 'get_'+name;
                        const parent = this.scope.impl_getParent(info.overload);
                        if (info.type === null) {
                            if (hasType) getterName += '_ptr';
                            const getter = dbw.AddressGetter.make(parent, getterName);
                            getter.infos.push([
                                dbw.VariableOverload.make(info.overload, info.overload.address),
                                this.scope.convertOwnTemplateTypeVars(info.overload)
                            ]);
                        } else {
                            if (hasType) getterName += '_var';
                            const getter = dbw.VariableGetter.make(parent, getterName);
                            getter.infos.push([
                                dbw.VariableOverload.make(info.overload, info.overload.address),
                                info.type.value,
                                this.scope.convertOwnTemplateTypeVars(info.overload)
                            ]);
                        }

                        // add decl
                        const args = this.scope.makeTemplateDefineItems(info.tparameters);
                        const key = unique.key(args);
                        if (templateGetters.has(key)) {
                            this.block.comment(`dupplicated: ${info.overload};`);
                        } else {
                            templateGetters.add(key);
                            const res = unique.make(tsw.NameProperty, getterName);
                            this.block.addFunctionDecl(res, args,
                                info.type === null ? StaticPointer.importType(this.scope) : info.type.type,
                                true);
                        }
                    } else {
                        let name2 = name;
                        let type:tsw.Type;
                        let isReadOnly = false;
                        if (info.type === null) {
                            if (hasType) name2 += '_ptr';
                            isReadOnly = true;
                            type = StaticPointer.importType(this.scope);
                        } else {
                            if (hasType) name2 += '_var';
                            type = info.type.type;
                        }
                        const nameres = unique.make(tsw.NameProperty, name2);
                        this.block.addVariable(nameres, type, true, isReadOnly);
                        this.scope.impl_variable(info.container, nameres, info.overload, info.type);
                    }
                } catch (err) {
                    if ((err instanceof IgnoreThis)) {
                        err.commentTo(this.block, info.overload);
                    } else {
                        throw err;
                    }
                }
            }
        }
    }

    private _writeFieldMember(member:PdbIdSet<PdbId.Data>, isStatic:boolean):void {
        try {
            const overloads:Identifier[] = [];
            for (const overload of member.overloads) {
                if (overload.address === 0) {
                    this.block.comment(`ignored: ${member.base}`);
                    this.block.comment(`  address not found - ${overload}`);
                    PdbId.printOnProgress(`[symbolwriter.ts] ${overload}: address not found`);
                    continue;
                }
                overloads.push(overload);
            }
            if (overloads.length === 0) return;

            const name = getIdNameOnly(member.base);
            this._writeVariable(name, member.overloads, overload=>{
                if (!overload.is(PdbId.ReturnAble)) return null;
                if (overload.data.returnType === null) return null;
                return this.scope.convert(overload.data.returnType, {isField: true, absoluteValue: true});
            });
        } catch (err) {
            if ((err instanceof IgnoreThis)) {
                err.commentTo(this.block, member.base);
            } else {
                throw err;
            }
        }
    }

    private _writeFunctionBaseOnly(field:PdbIdSet<PdbId.Data>):void {
        try {
            const name = getIdNameOnly(field.base);
            this._writeVariable(name, field.overloads, ()=>null);
        } catch (err) {
            if ((err instanceof IgnoreThis)) {
                err.commentTo(this.block, field);
            } else {
                throw err;
            }
        }
    }

    private _makeClassScope(member:PdbIdSet<PdbId.Data>):ClassScopeLike {
        if (this.block instanceof tsw.Class) {
            throw Error(`cannot write the class inside of the class`);
        }

        const base:Identifier = member.base;
        const clsname = getIdNameOnly(base);
        if (clsname instanceof tsw.NameProperty) {
            if (clsname.name.startsWith('~')) {
                throw Error(`Unexpected class name ${clsname.name}`);
            }
        }
        const clsnameKey = propertyToKey(clsname);
        const clsnameValue = clsname.toName().value;
        const cls = new tsw.Class(clsnameValue);
        const tinfo = TemplateInfo.from(base);
        if (tinfo.paramTypes.length !== 0) {
            if (COMMENT_SYMBOL) {
                for (const overload of member.overloads) {
                    this.block.comment(overload.symbolIndex+': '+overload.source);
                }
            }
            const classValue = dbw.TemplateClass.make(this.container, clsnameKey, MantleClass.importValue(this.scope));
            const templateDecl = tinfo.makeTemplateDecl(this.scope.nameMaker);
            cls.templates = templateDecl;
            cls.extends = typeNameToValueName(NativeTemplateClass.importType(this.scope));
            this.block.export(cls);

            const clsScope = new ClassScope(this.scope, clsname, clsnameKey, cls, classValue, base);

            try {
                const makeTemplateParams = tinfo.makeWrappedTemplateDecl(this.scope.nameMaker);
                const types = tinfo.paramTypes.map(v=>unique.make(tsw.TypeName, v.name));
                const paramNames = makeParamNamesByLength(types.length);
                const args = makeParameterDecls(types, paramNames);

                const unwrappedType:tsw.TemplateType[] = [];
                if (tinfo.paramTypes.length !== 0) {
                    for (const param of tinfo.paramTypes) {
                        unwrappedType.push(new tsw.TemplateType(UnwrapType.importType(this.scope), [new tsw.TypeName(param.name)]));
                    }
                }
                const returnType = new tsw.TemplateType(NativeClassType.importType(this.scope), [
                    new tsw.TemplateType(clsname.toName().type, unwrappedType)
                ]).and(new tsw.TypeOf(clsnameValue));
                const def = new tsw.MethodDecl(null, true, tswNames.make, args, returnType);
                def.templates = makeTemplateParams;
                clsScope.block.write(def);
            } catch (err) {
                if (err instanceof IgnoreThis) {
                    err.commentTo(this.block, base);
                } else {
                    throw err;
                }
            }
            return clsScope;
        } else {
            if (
                member.is(PdbId.ClassLike) ||
                member.is(PdbId.TemplateClassBase) // template but no template parameters.
            ) {
                const first:Identifier&PdbId<PdbId.ClassLike|PdbId.TemplateClassBase> = member.overloads[0];
                if (member.is(PdbId.Enum)) {
                    if (COMMENT_SYMBOL) this.block.comment(first.symbolIndex+': '+first.source);
                    dbw.StaticObject.make(this.container, clsnameKey);
                    this.block.export(new tsw.Enum(clsnameValue, []));
                    const obj = dbw.StaticObject.make(this.scope.container, clsnameKey);
                    return new UnknownScope(obj, clsname, clsnameKey);
                } else {
                    if (COMMENT_SYMBOL) this.block.comment(first.symbolIndex+': '+first.source);

                    let classValue:dbw.Class;
                    if (first.isMantleClass) {
                        const pair = MantleClass.import(this.scope);
                        classValue = dbw.Class.make(this.container, clsnameKey, pair.value);
                        cls.extends = typeNameToValueName(pair.type);
                    } else {
                        classValue = dbw.Class.make(this.container, clsnameKey, MantleClass.importValue(this.scope));
                        let supercls:tsw.Type|null = null;
                        if (first.is(PdbId.Class)) {
                            const superid = first.superClass;
                            if (superid !== null) {
                                supercls = this.scope.convert(superid).type;
                            }
                        }
                        if (supercls === null) {
                            supercls = NativeClass.importType(this.scope);
                        }
                        cls.extends = typeNameToValueName(supercls);
                    }
                    this.block.export(cls);
                    return new ClassScope(this.scope, clsname, clsnameKey, cls, classValue, base);
                }
            } else {
                const ns = dbw.Namespace.make(this.scope.container, clsnameKey);
                return new UnknownScope(ns, clsname, clsnameKey);
            }
        }
    }

    private _writeClass(member:PdbIdSet<PdbId.Data>):void {
        if (this.block instanceof tsw.Class) {
            throw Error(`cannot write the class inside of the class`);
        }

        const base:Identifier = member.base;

        try {
            const clsScope = this._makeClassScope(member);
            if (base.dontExportContents) {
                return;
            }

            const fields = new PdbMemberList;
            for (const overload of member.overloads) {
                fields.pushAllFields(overload);
            }

            const funcNames = new Set<string>();
            const sortedMember = fields.sortedMember();
            const isClass = clsScope instanceof ClassScope;
            const namespace = new tsw.Namespace(clsScope.name.toName().value);
            const container = clsScope.getContainer();
            const child = new BlockScope(fields, namespace, namespace.block, base, container);
            try {
                if (isClass) {
                    for (const field of fields.sortedStaticMember()) {
                        if (field.isStatic) {
                            funcNames.add(field.base.name);
                        }
                        clsScope.writeMembers(field);
                    }
                    for (const field of sortedMember) {
                        clsScope.writeMembers(field);
                    }
                } else {
                    for (const field of sortedMember) {
                        if (field.isStatic) {
                            funcNames.add(field.base.name);
                        }
                        try {
                            child.defines.writeMembers(field);
                        } catch (err) {
                            if ((err instanceof IgnoreThis)) {
                                err.commentTo(this.block, field.base);
                            } else {
                                PdbId.printOnProgress(`> Writing ${field.base} (symbolIndex=${field.base.symbolIndex})`);
                                throw err;
                            }
                        }
                    }
                }

                for (const field of iterateAll(fields.sortedInNamespace(), fields.sortedFunctionBases())) {
                    try {
                        child.defines.writeMembers(field);
                    } catch (err) {
                        if ((err instanceof IgnoreThis)) {
                            err.commentTo(this.block, base);
                        } else {
                            PdbId.printOnProgress(`> Writing ${field.base} (symbolIndex=${field.base.symbolIndex})`);
                            throw err;
                        }
                    }
                }
            } catch (err) {
                if ((err instanceof IgnoreThis)) {
                    err.commentTo(this.block, base);
                } else {
                    throw err;
                }
            }
            this.scope.append(child);
        } catch (err) {
            if ((err instanceof IgnoreThis)) {
                err.commentTo(this.block, base);
                return;
            }
            throw err;
        }
    }

    writeMembers(field:PdbIdSet<PdbId.Data>):void {
        if (field.is(PdbId.Function)) {
            this._writeFunctionMember(field);
        } else if (field.is(PdbId.TypeDef)) {
            this._writeRedirect(field.base);
        } else if (field.base.hasOverloads()) {
            this._writeFunctionBaseOnly(field);
        } else if (field.is(PdbId.NamespaceLike) || field.is(PdbId.TemplateBase)) {
            if (this.isClassScope) return;
            this._writeClass(field);
        } else {
            this._writeFieldMember(field, true);
        }
    }

}

interface PlainingReturn {
    item:ResItem;
    structureReturn?:boolean;
}

export class BlockScope implements ScopeMethod {
    public readonly defines:DefineScope;

    constructor(
        public readonly members:PdbMemberList,
        public readonly namespace:tsw.Namespace|null,
        public readonly block:tsw.Block,
        public readonly namespaceId:Identifier|null,
        public readonly container:dbw.Container) {
        this.defines = new DefineScope(this, this.block, false, this.container);
    }
    public readonly nameMaker = (item:PdbId<PdbId.Data>):tsw.Type=>this.convert(item).type;

    insideOf(namespace:Identifier):boolean {
        return namespace === this.namespaceId;
    }

    existName(name:string):boolean {
        let ns = this.namespaceId;
        if (ns !== null) {
            while (ns !== null) {
                const item:Identifier|null = ns.getChild(name);
                if (item != null && !item.dontExport) {
                    return true;
                }
                ns = ns.parent!;
            }
        }
        return false;
    }

    append(block:BlockScope):void {
        if (block.namespace === null) {
            throw Error('scope does not have namespace');
        }
        if (block.namespace.block.size() !== 0) {
            this.block.write(new tsw.Export(block.namespace));
        }
    }

    impl_getParent(item:Identifier):dbw.Container {
        if (item.parent === null) {
            throw Error(`${item}: has not parent`);
        }
        if (item.parent === PdbId.global) {
            return dbw.root;
        } else {
            const res = this.convert(item.parent, {absoluteValue: true, noJsType: true}).value;
            return res.getContainer();
        }
    }

    impl_variable(container:dbw.Container, name:tsw.Property, item:Identifier, type:ResItem|null):dbw.Variable {
        if (item.address === 0) throw Error(`address not found(${item})`);
        const nameText = propertyToKey(name);
        const v = dbw.VariableOverload.make(item, item.address);
        return dbw.Variable.make(container, nameText, type && type.value, v);
    }

    makeTemplateNames(n:number):tsw.Name[] {
        const names:tsw.Name[] = [];
        for (let i=0;i<n;i++) {
            const name = unique.make(tsw.Name, 'T'+i);
            names.push(name);
        }
        return names;
    }

    makeTemplateParamTypes(tparameters:(Identifier|Identifier[])[]):tsw.Type[] {
        const types:tsw.Type[] = [];
        const n = tparameters.length;
        for (let i=0;i<n;i++) {
            const type = tparameters[i];
            if (type instanceof Array) {
                types.push(unique.make(tsw.Tuple, type.map(this.nameMaker)));
            } else {
                types.push(this.nameMaker(type.getTypeOfIt()));
            }
        }
        return types;
    }

    makeTemplateDefineItems(tparameters:(Identifier|Identifier[])[]):tsw.VariableDefineItem[] {
        const n = tparameters.length;
        const names = this.makeTemplateNames(n);
        const types = this.makeTemplateParamTypes(tparameters);

        const args:tsw.VariableDefineItem[] = [];
        for (let i=0;i<n;i++) {
            args.push(new tsw.VariableDefineItem(names[i], types[i]));
        }
        return args;
    }

    private _toTswJsTypeRedirect(item:Identifier, opts:ToTswOptions):ResItem {
        if (item.jsType == null) throw Error(`jsType not found (${item})`);
        let out:ResItem;
        if (item.jsType instanceof ResItem) {
            out = item.jsType;
        } else if (item.jsType instanceof ImportItem) {
            out = item.jsType.import(this);
        } else {
            out = item.jsType(item);
        }
        if (item.jsTypeOnly != null) {
            out = unique.callm(out, 'changeType', item.jsTypeOnly);
        }
        if (!opts.noTemplate) {
            out = ResItem.make(out.value, this.wrapAnyTemplate(out.type, item));
        }
        return out;
    }

    private _convertInternal(item:Identifier, opts:ToTswOptions):ResItem {
        if (item.parent === PdbId.global && item.name.startsWith('`')) {
            throw new IgnoreThis(`private symbol (${item})`);
        }
        if (item.is(PdbId.Decorated)) {
            if (item.data.deco === DecoSymbol.const) {
                return Const.wrap(this, this.convert(item.data.base, opts));
            }
            if (item.data.deco !== null && item.data.deco.name === '[0]') {
                throw new IgnoreThis(`incomprehensible syntax(${item})`);
            }
        }
        if (item.is(PdbId.TypeUnion)) {
            const types:tsw.Type[] = [];
            let ignored:IgnoreThis|null = null;
            for (const union of item.data.unionedTypes) {
                try {
                    const type = this.convert(union, opts);
                    types.push(type.type);
                } catch (err) {
                    if (!(err instanceof IgnoreThis)) throw err;
                    ignored = err;
                }
            }
            if (types.length === 0) {
                throw ignored || new IgnoreThis('No types');
            }
            return ResItem.make(
                dbw.nullItem,
                tsw.Type.smartOr(types));
        }
        if (!opts.noJsType && item.jsType != null) {
            if (!item.is(PdbId.TemplateBase) || item.templateRedirects == null) {
                return this._toTswJsTypeRedirect(item, opts);
            }
        }
        if (item.is(PdbId.Decorated)) {
            let isRef = false;
            switch (item.data.deco) {
            case DecoSymbol['&']:
            case DecoSymbol['&&']:
                isRef = true;
                // fall through
            case DecoSymbol['*']: {
                const baseitem = item.data.base;
                if (item.isValue) {
                    if (item.data.deco === DecoSymbol['&']) {
                        if (baseitem.address === 0) {
                            PdbId.printOnProgress(`[symbolwriter.ts] ${item.source}: address not found`);
                            throw new IgnoreThis(`address not found - ${item}`);
                        }
                        const type = this.convert(baseitem.getTypeOfIt()).type;
                        if (baseitem.is(PdbId.Function)) {
                            const overload = dbw.FunctionOverload.make(baseitem);
                            return ResItem.make(
                                overload,
                                type
                            );
                        } else {
                            return ResItem.make(
                                dbw.VariableOverload.make(baseitem, baseitem.address),
                                type
                            );
                        }
                    }
                }
                let out = this.convert(baseitem, {absoluteValue: opts.absoluteValue});
                if (item.isValue) {
                    out = ResItem.make( out.value, this.convert(item.getTypeOfIt()).type);
                }
                if (baseitem.is(PdbId.FunctionType)) {
                    // do nothing
                } else if (baseitem.is(PdbId.MemberPointerType)) {
                    // do nothing
                } else {
                    if (!isRef) {
                        out = ResItem.make( out.value, out.type.or(tsw.BasicType.null));
                    }
                    if (opts.isField) {
                        out = refCall.wrap(this, out);
                    } else {
                        if (isRef) out = Ref.wrap(this, out);
                        else out = Ptr.wrap(this, out);
                    }
                }
                return out;
            }
            default:
                if (item.data.deco.arraySize !== null) {
                    throw Error(`array deco is not allowed`);
                }
                throw Error(`Unexpected deco ${item.data.deco} (${item})`);
            }
        }

        let out:ResItem;
        if (item.templateBase !== null) {
            const base:Identifier = item.templateBase;
            out = this.convert(base, {...opts, noTemplate:true});
        } else if (item.is(PdbId.MemberPointerType)) {
            const base = this.convert(item.data.memberPointerBase, {absoluteValue:opts.absoluteValue});
            const type = this.convert(item.data.type, {absoluteValue:opts.absoluteValue});
            const memberPointer = MemberPointer.import(this);
            return ResItem.make(
                dbw.TemplateType.make(memberPointer.value, [base.value, type.value]),
                unique.make(tsw.TemplateType, memberPointer.type, [base.type, type.type]),
            );
        } else if (item.is(PdbId.FunctionType)) {
            if (item.data.returnType === null) throw Error(`Unresolved return type (${item})`);
            const func = new FunctionMaker(this, false, item.data.returnType, item.data.functionParameters, null);
            return func.makeType();
        } else {
            const prop = getIdNameOnly(item);
            if (item.hasNonGlobalParent()) {
                const insideOfNamespace = this.insideOf(item.parent);
                if (insideOfNamespace && !opts.absoluteValue) {
                    out = ResItem.fromProperty(prop);
                } else {
                    out = this.convert(item.parent, {noTemplate: true, absoluteValue:opts.absoluteValue, noJsType: true});
                    out = out.member(prop);
                }
            } else {
                out = ResItem.fromProperty(prop);
            }
        }

        const tinfo = TemplateInfo.from(item);
        if (tinfo.parameters.length === 0 && item.is(PdbId.Enum)) {
            out = out.changeValue(dbw.TemplateType.make(EnumType.importValue(this), [out.value]));
        }

        if (!opts.noTemplate) {
            if (tinfo.parameters.length !== 0) {
                if (item.is(PdbId.Function)) {
                    if (item.data.returnType === null) throw Error(`Unresolved return type (${item})`);
                    const classType = this.convertClassTypeOfParent(item);
                    const retType = this.convert(item.data.returnType).type;

                    const types = this.convertParameters(item.data.functionParameters, opts.absoluteValue);
                    const tswNames = makeParamNamesByTypes(item.data.functionParameters);
                    const params = makeParameterDecls(types.map(v=>v.type), tswNames, item.isStatic, classType?.type);

                    out = ResItem.make(
                        dbw.FunctionOverload.make(item),
                        unique.make(tsw.FunctionType, retType, params),
                    );
                } else {
                    const base:(Identifier&PdbId<PdbId.TemplateBase>)|null = item.templateBase;
                    if (base !== null && base !== this.namespaceId) {
                        const res = inferTemplate(base, tinfo);
                        if (res !== null) {
                            const [redirect, templates] = res;
                            return redirect.redirect(this, base, templates, {absoluteValue: opts.absoluteValue});
                        }
                    }

                    const params = this.convertTemplateParameters(tinfo.parameters, opts.absoluteValue);
                    out = ResItem.make(
                        dbw.TemplateType.make(out.value, params.map(v=>v.value)),
                        unique.make(tsw.TemplateType, out.type, params.map(v=>v.type)),
                    );
                }
            } else {
                out = ResItem.make(
                    out.value,
                    this.wrapAnyTemplate(out.type, item)
                );
            }
        }
        if (!opts.noJsType && item.jsType != null) {
            out = this._toTswJsTypeRedirect(item, opts);
        } else {
            if (item.isValue) {
                out = out.changeType(this.convert(item.getTypeOfIt()).type);
            }
        }
        return out;
    }
    private _convertRedirect(item:Identifier, opts:ToTswOptions):ResItem {
        const res = this._convertInternal(item, opts);
        if (item.typeDefFrom !== null && !opts.noTemplate) {
            const type = this._convertInternal(item.typeDefFrom, opts);
            return res.changeType(type.type);
        }
        return res;
    }
    private _convertRecursiveCheck(item:Identifier, opts:ToTswOptions):ResItem {
        if (recursiveCheck.has(item)) {
            throw Error(`recursive (${item})`);
        }
        try {
            recursiveCheck.add(item);
            return this._convertRedirect(item, opts);
        } finally {
            recursiveCheck.delete(item);
        }
    }
    convert(item:Identifier, opts:ToTswOptions = {}):ResItem {
        return this._convertRecursiveCheck(item, opts);
    }

    convertClassTypeOfParent(item:Identifier, absoluteValue?:boolean):ResItem|null {
        if (!item.isType && (item.parent!.data instanceof PdbId.ClassLike)) {
            return this.convert(item.parent!, {absoluteValue, noJsType: true});
        } else {
            return null;
        }
    }

    convertReturnType(type:Identifier, opts:dbw.FuncOptions|null, absoluteValue?:boolean):ResItem {
        const returnType = this.convert(type, {absoluteValue});
        return this.plaining(type, returnType, opts);
    }

    convertParameters(items:Identifier[], absoluteValue?:boolean):ResItem[] {
        return items.map(item=>{
            const v = this.convert(item, {absoluteValue});
            return this.plaining(item, v, null);
        });
    }

    convertTemplateParameters(args:(Identifier[]|Identifier)[], absoluteValue?:boolean):ResItem[] {
        return args.map((id):ResItem=>{
            const opts = {absoluteValue};
            let out:ResItem;
            if (id instanceof Array) {
                const params = id.map(id=>this.convert(id, opts));
                out = ResItem.make(
                    unique.make(dbw.TypeList, params.map(id=>id.value)),
                    unique.make(tsw.Tuple, params.map(id=>id.type))
                );
            } else {
                out = this.convert(id, opts);
            }
            return out;
        });
    }

    convertOwnTemplateTypeVars(overload:Identifier):dbw.Item[] {
        const tinfo = TemplateInfo.from(overload);
        const params = tinfo.getOwnParametersOnly();
        return params.map(v=>{
            if (v instanceof Array) return dbw.TypeList.make(v.map(v=>this.convert(v, {absoluteValue: true}).value));
            return this.convert(v, {absoluteValue: true}).value;
        });
    }

    wrapAnyTemplate(type:tsw.Type, item:Identifier):tsw.Type {
        if (type === null) return type;
        if (!item.is(PdbId.TemplateClassBase)) return type;

        const tinfo = TemplateInfo.from(item);
        if (tinfo.paramTypes.length === 0) return type;

        if (item.templateRedirects != null) {
            for (const redirect of item.templateRedirects) {
                const templates = tinfo.paramTypes.map(()=>any_t);
                return redirect.redirect(this, item, templates, {}).type;
            }
        }
        const params = tinfo.paramTypes.map(()=>tsw.BasicType.any);
        return unique.make(tsw.TemplateType, type, params);
    }

    _plaining(raw:Identifier, item:ResItem, useOpts:boolean):PlainingReturn {
        const out:PlainingReturn = {} as any;
        // class std::shared_ptr<class std::vector<class Actor * __ptr64,class std::allocator<class Actor * __ptr64> >
        try {
            if (Const.is(item)) {
                // Const<T> -> T
                item = item.component;
            }

            let pointerRemoved = false;
            if (isPrimitiveType(item, raw)) {
                if (Ref.is(item)) {
                    const inner = item.component;
                    if (Const.is(inner)) {
                        // Ref<Const<T>> -> T.ref()
                        item = refCall.wrap(this, inner.component);
                        pointerRemoved = true;
                    }
                }
            } else {
                if (Ref.is(item)) {
                    // Ref<T> -> T
                    item = item.component;
                    pointerRemoved = true;
                } else if (Ptr.is(item)) {
                    // Ptr<T> -> T
                    item = item.component;
                    pointerRemoved = true;
                }
            }
            if (Const.is(item)) {
                // Const<T> -> T
                item = item.component;
            }
            const PtrToRef = (item:ResItem):(ResItem|null)=> {
                if (useOpts) {
                    item = item.notNull();
                }
                if (Ref.is(item)) {
                    item = item.component;
                } else if (Ptr.is(item)) {
                    item = item.component;
                } else {
                    return null;
                }
                return refCall.wrap(this, plainingInner(item));
            };
            const plainingInner = (item:ResItem):ResItem=> {
                if (useOpts) {
                    item = item.notNull();
                }
                if (WrapperType.is(item)) {
                    const ref = PtrToRef(item.component);
                    if (ref !== null) {
                        item = WrapperType.wrap(this, ref);
                    }
                } else if (CxxVectorToArray.is(item)) {
                    const ref = PtrToRef(item.component);
                    if (ref !== null) {
                        item = CxxVectorToArray.wrap(this, ref);
                    }
                }
                if (item instanceof WrappedItem) {
                    item = item.changeComponent(this, plainingInner(item.component));
                }
                return item;
            };
            item = plainingInner(item);

            if (!pointerRemoved) {
                if (useOpts) {
                    if (WrapperType.is(item)) {
                        item = item.component;
                        out.structureReturn = true;
                    } else if (!raw.isBasicType && !raw.is(PdbId.Enum)) {
                        out.structureReturn = true;
                    }
                }
            }
        } catch (err) {
            PdbId.printOnProgress(`> Planing ${item.type || item.value} (symbolIndex=${raw.symbolIndex})`);
            throw err;
        }
        out.item = item;
        return out;
    }

    plaining(raw:Identifier, item:ResItem, opts:dbw.FuncOptions|null):ResItem {
        const res = unique.callm(this as BlockScope, '_plaining', raw, item, opts !== null);
        if (res.structureReturn) opts!.structureReturn = true;
        return res.item;
    }

}

interface ClassScopeLike {
    name:tsw.Property;
    nameKey:string;
    getContainer():dbw.Container;
}
class ClassScope extends DefineScope implements ClassScopeLike {
    public readonly block:tsw.Class;
    public readonly defines:DefineScope;

    constructor(
        parentScope:BlockScope,
        public readonly name:tsw.Property,
        public readonly nameKey:string,
        clazz:tsw.Class, public readonly classValue:dbw.Item,
        public readonly clazzId:Identifier) {
        super(parentScope, clazz, true, classValue.getContainer());
    }
    getContainer():dbw.Container {
        return this.container;
    }
}

class UnknownScope implements ClassScopeLike {
    private container:dbw.Container|null = null;

    constructor(
        public readonly value:dbw.HasContainer,
        public readonly name:tsw.Property,
        public readonly nameKey:string,
    ) {
    }

    getContainer():dbw.Container {
        if (this.container !== null) return this.container;
        return this.container = this.value.getContainer();
    }
}

export class TsCodeDeclaration extends TsCode {
    public readonly idsMap = new Set<Identifier>();

    constructor() {
        super(minecraft);
    }
}

class MinecraftTsFile extends TsFile {
    private ctorProperty:tsw.BracketProperty|null = null;
    private dtorProperty:tsw.BracketProperty|null = null;
    private defaultCtorDecl:tsw.MethodDecl|null = null;

    defaultConstructorDecl():tsw.MethodDecl {
        if (this.defaultCtorDecl !== null) return this.defaultCtorDecl;
        const method = unique.make(tsw.MethodDecl, null, false, this.getNativeTypeCtor(), [], tsw.BasicType.void);
        return this.defaultCtorDecl = method;
    }

    getNativeTypeCtor():tsw.BracketProperty {
        if (this.ctorProperty != null) return this.ctorProperty;
        return this.ctorProperty = new tsw.BracketProperty(
            typeNameToValueName(NativeType.importType(ScopeMethod.empty).member(tswNames.ctor)));
    }
    getNativeTypeDtor():tsw.BracketProperty {
        if (this.dtorProperty != null) return this.dtorProperty;
        return this.dtorProperty = new tsw.BracketProperty(
            typeNameToValueName(NativeType.importType(ScopeMethod.empty).member(tswNames.dtor)));
    }
    isCtor(ctor:tsw.Property):boolean {
        return this.ctorProperty === ctor;
    }
    isDtor(dtor:tsw.Property):boolean {
        return this.dtorProperty === dtor;
    }

    async save():Promise<void> {
        const head:tsw.BlockItem[] = this.imports.toTsw();
        head.unshift(...[
            `BDS Version: ${installedBdsVersion}`,
            ...StringLineWriter.generateWarningComment('bdsx-dev/pdbparser/symbolwriter.ts')
        ].map(msg=>new tsw.Comment(msg)));

        const outPath = path.join(outDir, this.path);
        const dtsOutPath = outPath+'.d.ts';

        console.log(`[symbolwriter.ts] Writing ${this.path}.d.ts`);
        const dts = decl.doc.cloneToDecl();
        dts.unshift(
            ...head,
            new tsw.ImportType([], './ext.all'),
            new tsw.ImportType([], './enums'),
            new tsw.TypeDef(Ref.type, Ptr.importType(globalScope).template(tswNames.T), [tswNames.T]),
            new tsw.TypeDef(Const.type, tswNames.T, [tswNames.T]),
        );
        dts.save(dtsOutPath);
    }
}

function makeParameterDecls(paramTypes:tsw.Type[], paramNames:tsw.Name[], isStaticMethod?:boolean, classType?:tsw.Type|null):tsw.DefineItem[] {
    const declaration:tsw.DefineItem[] = [];
    for (let i=0;i<paramNames.length;i++) {
        declaration[i] = new tsw.VariableDefineItem(paramNames[i], paramTypes[i]);
    }
    if (classType != null) {
        if (isStaticMethod) {
            classType = new tsw.TemplateType(NativeClassType.importType(ScopeMethod.empty), [classType]);
        }
        declaration.unshift(new tsw.VariableDefineItem(tsw.Name.this, classType));
    }
    return declaration;
}

function makeParamNamesByLength(len:number):tsw.Name[] {
    const tswNames:tsw.Name[] = new Array(len);
    for (let i=0;i<len;i++) {
        tswNames[i] = unique.make(tsw.Name, 'arg'+i);
    }
    return tswNames;
}

function getIdName(item:Identifier):string {
    if (item.typeDefFrom !== null) {
        return getIdName(item.typeDefFrom);
    }
    if (item.templateBase !== null) {
        return getIdName(item.templateBase)+'_'+item.templateParameters!.map(id=>getIdName(id)).join('_');
    }
    if (item.data instanceof PdbId.Decorated) {
        return getIdName(item.data.base);
    }
    if (item.data instanceof PdbId.MemberPointerType) {
        return getIdName(item.data.memberPointerBase)+'_m';
    }
    if (item.data instanceof PdbId.MemberFunctionType) {
        return getIdName(item.data.memberPointerBase)+'_fn';
    }
    const nameobj = getIdNameOnly(item);
    if (!(nameobj instanceof tsw.NameProperty)) throw Error(`is not name(${item})`);
    let name = nameobj.name.replace(/[{},<>]/g, v=>idremap[v]);
    if (name.startsWith('-')) {
        name = 'minus_'+name.substr(1);
    }
    if (item.parent !== null && item.parent !== PdbId.global) {
        name = getIdName(item.parent) + '_' + name;
    }
    return name;
}

function getIdNameOnly(item:Identifier):tsw.Property {
    if (item.templateBase !== null) {
        throw Error(`${item}: getName with template`);
    }
    if (item.is(PdbId.TypeUnion)) {
        throw Error(`${item}: getName with type union`);
    }
    if (item.is(PdbId.Decorated)) {
        throw Error(`getName with deco type(${item})`);
    }
    if (item.is(PdbId.FunctionType) || item.is(PdbId.FunctionTypeBase)) {
        throw Error(`${item.name}: getName with function type`);
    }
    if (item.parent === null) {
        throw Error(`${item.name} has not parent, (type=${item.data.constructor.name})`);
    }
    if (item.is(PdbId.KeyType)) {
        throw new IgnoreThis(`temporal key (${item})`);
    }

    let name = item.removeParameters().name;
    if (item.is(PdbId.Function) || item.is(PdbId.FunctionBase)) {
        if (item.data.isConstructor) {
            return tswNames.constructWith;
        } else if (item.data.isDestructor) {
            return minecraft.getNativeTypeDtor();
        }
    }

    if (item.is(PdbId.VCall)) {
        return unique.make(tsw.NameProperty, '__vcall_'+getIdName(item.data.param));
    }

    const remapped = specialNameRemap.get(name);
    let matched:RegExpMatchArray|null;
    if (remapped != null) {
        name = remapped;
    } else if (name.startsWith('`')) {
        if (item.params !== null) {
            const params = [...item.params];
            if (name.startsWith("`vector deleting destructor'")) {
                name = '__vector_deleting_destructor_'+params.join('_');
            } else if (name.startsWith("`vftable'")) {
                name = 'vftable_for_'+params.map(id=>getIdName(id)).join('_');
            } else if (name.startsWith("`vbtable'")) {
                name = 'vbtable_for_'+params.map(id=>getIdName(id)).join('_');
            } else {
                name = '__'+name.replace(/[`' ()\-,]/g, '');
                // name = '__'+name.replace(/[`' ()-,0-9]/g, '')+'_'+item.adjustors.join('_').replace(/-/g, 'minus_');
            }
        } else {
            name = '__'+name.replace(/[`' ()\-,]/g, '');
        }
    } else if ((matched = name.match(adjustorRegExp)) !== null) {
        name = matched[1]+'_adjustor_'+matched[2];
    } else if (name.startsWith('operator ')) {
        if (item.is(PdbId.FunctionBase) || item.is(PdbId.TemplateFunctionBase)) {
            for (const over of item.data.allOverloads()) {
                if (over.data.returnType === null) throw Error(`Unresolved return type ${over}`);
                name = 'operator_castto_'+getIdName(over.data.returnType);
                break;
            }
        } else {
            throw Error(`failed to get return type(${item})`);
        }
    } else if ((matched = name.match(LAMBDA_REGEXP)) !== null) {
        name = matched[1];
    } else if (name === '<lambda_invoker_cdecl>') {
        name = 'lambda_invoker_cdecl';
    }
    return unique.make(tsw.NameProperty, name);
}

function propertyToString(prop:tsw.Property):string {
    if (prop instanceof tsw.NameProperty) {
        return prop.name;
    } else if (prop === minecraft.getNativeTypeDtor()) {
        return 'dtor';
    } else {
        unreachable();
    }
}

function getVarName(type:Identifier):string {
    let baseid:Identifier = type;
    for (;;) {
        if (baseid.paramVarName != null) return baseid.paramVarName;
        if (baseid.data instanceof PdbId.Decorated) {
            baseid = baseid.data.base;
        } else if (baseid.data instanceof PdbId.Function) {
            if (baseid.data instanceof PdbId.FunctionType) {
                return 'cb';
            } else {
                baseid = baseid.data.functionBase;
            }
        } else if (baseid.templateBase !== null) {
            baseid = baseid.templateBase;
        } else {
            break;
        }
    }
    if (baseid.data instanceof PdbId.MemberPointerType) {
        return getVarName(baseid.data.memberPointerBase)+'_m';
    }
    if (baseid.data instanceof PdbId.FunctionTypeBase) {
        return 'fn';
    }
    if (baseid.data instanceof PdbId.FunctionType) {
        if (baseid.data.returnType === null) throw Error(`returnType unresolved (${baseid})`);
        return getVarName(baseid.data.returnType)+'_fn';
    }
    if (baseid.data instanceof PdbId.MemberFunctionType) {
        return getVarName(baseid.data.memberPointerBase)+'_fn';
    }
    if (baseid.is(PdbId.TypeUnion)) return 'arg';
    if (LAMBDA_REGEXP.test(baseid.name)) {
        return 'lambda';
    }
    let basename = getIdNameOnly(baseid).toName().value.name;
    if (basename.endsWith('_t')) basename = basename.substr(0, basename.length-2);
    basename = styling.toCamelStyle(basename, /[[\] :*]/g, false);
    return basename;
}

function makeParamNamesByTypes(ids:Identifier[]):tsw.Name[] {
    const namemap = new Map<string, {index:number, counter:number}>();
    const tswNames:string[] = new Array(ids.length);
    for (let i=0;i<ids.length;i++) {
        const basename = getVarName(ids[i]);

        let name = basename;
        const info = namemap.get(name);
        if (info == null) {
            namemap.set(name, {index:i, counter:1});
        } else {
            if (info.counter === 1) {
                tswNames[info.index] = basename + '_' + info.counter;
            }
            info.counter++;
            name = basename + '_' + info.counter;
        }
        tswNames[i] = name;
    }
    return tswNames.map(name=>new tsw.Name(name));
}

function inferTemplate(base:Identifier, tinfo:TemplateInfo):[TemplateRedirect, PdbId<PdbId.Data>[]]|null {
    if (base.templateRedirects == null) return null;
    for (const redirect of base.templateRedirects) {
        const templates = tinfo.infer(redirect.templates);
        if (templates !== null) {
            return [redirect, templates];
        }
    }
    return null;
}

function convertAll(scope:BlockScope, ids:Identifier[]):void {
    const out = scope.members;
    for (const item of ids) {
        out.pushField(item);
    }
    if (out.staticMember.size !== 0) {
        const first = getFirstIterableItem(out.staticMember)!;
        throw Error(`global static member: ${first.base}`);
    }
    const total = out.functionBasePtrs.size + out.inNamespace.size + out.member.size;
    const bar = new ProgressBar('[symbolwriter.ts] Converting [:bar] :current/:total', total);
    try {
        for (const field of iterateAll(out.inNamespace, out.functionBasePtrs, out.member)) {
            try {
                scope.defines.writeMembers(field);
            } catch (err) {
                if (err instanceof IgnoreThis) {
                    err.commentTo(scope.block, field.base);
                    continue;
                }
                PdbId.printOnProgress(`> Writing ${field.base} (symbolIndex=${field.base.symbolIndex})`);
                throw err;
            }
            bar.tick();
        }
    } finally {
        bar.terminate();
    }
}

// std.make('string').redirect(std.find('basic_string<char,std::char_traits<char>,std::allocator<char> >'));
PdbId.parse('std::ostream').typeDef(PdbId.parse('std::basic_ostream<char,std::char_traits<char> >'));
PdbId.parse('std::istream').typeDef(PdbId.parse('std::basic_istream<char,std::char_traits<char> >'));
PdbId.parse('std::iostream').typeDef(PdbId.parse('std::basic_iostream<char,std::char_traits<char> >'));
PdbId.parse('std::stringbuf').typeDef(PdbId.parse('std::basic_stringbuf<char,std::char_traits<char>,std::allocator<char> >'));
PdbId.parse('std::istringstream').typeDef(PdbId.parse('std::basic_istringstream<char,std::char_traits<char>,std::allocator<char> >'));
PdbId.parse('std::ostringstream').typeDef(PdbId.parse('std::basic_ostringstream<char,std::char_traits<char>,std::allocator<char> >'));
PdbId.parse('std::stringstream').typeDef(PdbId.parse('std::basic_stringstream<char,std::char_traits<char>,std::allocator<char> >'));
PdbId.parse('RakNet::RakNetRandom').determine(PdbId.Class);
PdbId.parse('enum DimensionId');
new Definer('JsonUtil::JsonSchemaNode').item.filted = false;
new Definer('JsonUtil::JsonParseState').item.filted = false;
new Definer('JsonUtil::JsonSchemaEnumNode').item.filted = false;
new Definer('JsonUtil::JsonSchemaNodeChildSchemaOptions').item.filted = false;
new Definer('JsonUtil::JsonSchemaNode_CanHaveChildren').item.filted = false;
new Definer('JsonUtil::JsonSchemaChildOption').item.filted = false;
new Definer('JsonUtil::JsonSchemaObjectNode').item.filted = false;
new Definer('JsonUtil::JsonSchemaArrayNode').item.filted = false;
new Definer('JsonUtil::JsonSchemaTypedNode').item.filted = false;
new Definer('JsonUtil::JsonSchemaChildOptionBase').item.filted = false;

console.log(`[symbolwriter.ts] Filtering...`);

const ids:Identifier[] = [];
for (const item of PdbId.global.children) {
    if (item.isBasicType) {
        // basic types
    } else if (item.name.startsWith('`')) {
        // private symbols
    } else if (item.data instanceof PdbId.Constant) {
        // numbers
    } else if (item.name.startsWith('{')) {
        // code chunk?
    } else if (item.name.startsWith('__imp_')) {
        // import
    } else if (/^main\$dtor\$[0-9]+$/.test(item.name)) {
        // dtor in main
    } else if (!PdbId.filter(item)) {
        // filtered
    } else {
        ids.push(item);
    }
}
ids.sort((a,b)=>a.name.localeCompare(b.name));
const minecraft = new MinecraftTsFile('./minecraft/index');
const decl = new TsCodeDeclaration;
dbw.create(path.join(outDir, './minecraft/minecraft.dnfdb'));

unique.ignore(minecraft);
unique.ignore(decl);

const NativeType = new ImportItem(minecraft, imports.nativetype, 'NativeType');
const UnwrapType = new ImportWrapper(minecraft, imports.nativetype, 'UnwrapType', true, TypeWrapper);

const NativeTemplateClass = new ImportItem(minecraft, imports.complextype, 'NativeTemplateClass');
const MemberPointer = new ImportItem(minecraft, imports.complextype, 'MemberPointer');

const MantleClass = new ImportItem(minecraft, imports.nativeclass, 'MantleClass');
const NativeClass = new ImportItem(minecraft, imports.nativeclass, 'NativeClass');

const NativeClassType = new ImportWrapper(minecraft, imports.nativeclass, 'NativeClassType', true, TypeWrapper);
const WrapperType = new ImportWrapper(minecraft, imports.pointer, 'Wrapper');
const Ptr = new ImportWrapper(minecraft, imports.pointer, 'Ptr');
const SharedPtr = new ImportWrapper(minecraft, imports.sharedpointer, 'SharedPtr');
const CxxVectorToArray = new ImportWrapper(minecraft, imports.cxxvector, 'CxxVectorToArray', false, class extends DefaultWrapper {
    wrapValue(scope:ScopeMethod, value:dbw.Item):dbw.Item {
        return dbw.TemplateType.make(CxxVector.importValue(scope), [value]);
    }
    wrapType(scope:ScopeMethod, type:tsw.Type):tsw.Type {
        return new tsw.ArrayType(type);
    }
});
const EnumType = new ImportWrapper(minecraft, imports.complextype, 'EnumType');

const Const = new TypeWrapper('Const');
const Ref = new TypeWrapper('Ref');
const refCall = new RefWrapper;
const PointerLike = new ImportWrapper(minecraft, imports.nativetype, 'PointerLike');
const StaticPointer = new ImportItem(minecraft, imports.core, 'StaticPointer');
const CxxVector = new ImportItem(minecraft, imports.cxxvector, 'CxxVector');

// NetworkHandler::_sendInternal - 3rd parameter, CxxString to CxxStringWrapper
const _sendInternal = PdbId.parse('NetworkHandler::_sendInternal');
if (_sendInternal.is(PdbId.FunctionBase)) {
    _sendInternal.data.overloads[0].data.functionParameters[2] = PdbId.parse('CxxStringWrapper');
}
const globalScope = new BlockScope(new PdbMemberList, null, decl.doc, PdbId.global, dbw.root);

const any_t = new Definer('any').js(ResItem.any).paramName('v').item;

(async()=>{
    // definers
    new Definer('std::allocator').item.dontExportContents = true;
    new Definer('std::basic_string<char,std::char_traits<char>,std::allocator<char> >').js(['CxxString', imports.nativetype]).paramName('str').item;
    new Definer('bool').js(['bool_t', imports.nativetype]).paramName('b');
    new Definer('void').js(['void_t', imports.nativetype], {jsTypeOnly: tsw.BasicType.void}).paramName('v');
    new Definer('std::nullptr_t').js(['nullptr_t', imports.nativetype], {jsTypeOnly: tsw.BasicType.null}).paramName('v');
    new Definer('float').js(['float32_t', imports.nativetype]).paramName('f');
    new Definer('double').js(['float64_t', imports.nativetype]).paramName('d');
    new Definer('char').js(['int8_t', imports.nativetype]).paramName('c');
    new Definer('char const *').js(['StringUtf8', imports.nativetype]).paramName('str');
    new Definer('wchar_t const *').js(['StringUtf16', imports.nativetype]).paramName('str');
    new Definer('char *').js(PointerLike).paramName('char_ptr');
    new Definer('wchar_t').js(['uint16_t', imports.nativetype]).paramName('wc');
    new Definer('char signed').js(['int8_t', imports.nativetype]).paramName('sc');
    new Definer('char unsigned').js(['uint8_t', imports.nativetype]).paramName('uc');
    new Definer('short').js(['int16_t', imports.nativetype]).paramName('s');
    new Definer('short unsigned').js(['uint16_t', imports.nativetype]).paramName('us');
    new Definer('int').js(['int32_t', imports.nativetype]).paramName('i');
    new Definer('int unsigned').js(['uint32_t', imports.nativetype]).paramName('u');
    new Definer('long').js(['int32_t', imports.nativetype]).paramName('i');
    new Definer('long unsigned').js(['uint32_t', imports.nativetype]).paramName('u');
    new Definer('__int64').js(['bin64_t', imports.nativetype], {jsTypeNullable: true}).paramName('i');
    new Definer('__int64 unsigned').js(['bin64_t', imports.nativetype], {jsTypeNullable: true}).paramName('u');
    new Definer('void*').js(PointerLike, {jsTypeNullable: true}).paramName('p');
    new Definer('void const*').js(PointerLike, {jsTypeNullable: true}).paramName('p');
    new Definer('typename').js(new ImportItem(minecraft, imports.nativetype, 'Type', true)).paramName('t');
    new Definer(any_t.decorate(DecoSymbol.make('a', '[]'))).js(ResItem.anyArray).paramName('args');
    new Definer('never').js(ResItem.never).paramName('v');
    new Definer('gsl::basic_string_span<char const,-1>').js(['GslStringSpan', imports.nativetype]).paramName('str');
    new Definer('gsl::basic_string_span').item.dontExport = true;
    new Definer(PdbId.make('...')).js(['NativeVarArgs', imports.complextype]).paramName('args');
    new Definer('gsl::not_null<#KEY0>').templateRedirect((scope, item, templates, opts)=>WrapperType.wrap(scope, scope.convert(templates[0], opts))).paramName('v');
    new Definer('std::unique_ptr<#KEY0, std::default_delete<#KEY0>>').templateRedirect((scope, item, templates, opts)=>Ptr.wrap(scope, scope.convert(templates[0], opts)), {exportOriginal: true}).paramName('v');
    new Definer('std::shared_ptr<#KEY0>').templateRedirect((scope, item, templates, opts)=>SharedPtr.wrap(scope, scope.convert(templates[0], opts))).paramName('v');
    new Definer('AutomaticID<Dimension, int>').js(ResItem.fromName('DimensionId')).paramName('dim');
    new Definer('Packet').item.isMantleClass = true;
    new Definer('CxxStringWrapper').js(['CxxStringWrapper', imports.pointer]).paramName('data');
    new Definer('Json::Value').js(['JsonValue', imports.jsonvalue], {exportOriginal: true}).paramName('json');

    dbw.root.member('Json').member('Value').member('CZString');
    new Definer('Json::Value::CZString').js(ResItem.fromName('Json').member('Value').member('CZString'), {exportOriginal: true});

    reduceTemplateTypes();
    new Definer('std::vector<#KEY0>')
    .templateRedirect((scope, item, templates, opts)=>CxxVectorToArray.wrap(scope, scope.convert(templates[0], opts)))
    .paramName('array')
    .js(CxxVector);

    // update packet parent
    const packetIdentifieres:[Identifier, number][] = [];
    const Packet = PdbId.global.getChild('Packet');
    if (Packet === null) throw Error(`Packet class not found`);
    for (const [name, id] of Object.entries(getPacketIds())) {
        const packet = PdbId.global.getChild(name);
        if (packet === null) {
            console.error(`${name} not found, id=${id}`);
        } else {
            packet.superClass = Packet;
            packetIdentifieres.push([packet, id]);
        }
    }

    // convert all
    try {
        convertAll(globalScope, ids);
    } catch (err) {
        PdbId.printOnProgress(`> convertAll`);
        throw err;
    }

    // write packet.ts
    writePacketTs(packetIdentifieres, outDir, new BlockScope(new PdbMemberList, null, new tsw.Block, null, new dbw.RootContainer), decl);

    // write root
    dbw.save();

    // write minecraft d.ts
    try {
        await minecraft.save();
        console.log(`[symbolwriter.ts] done`);
    } finally {
        const wavpath = __dirname+path.sep+'notify.wav';
        child_process.spawnSync('powershell', ['-c', `(New-Object Media.SoundPlayer "${wavpath}").PlaySync()`], {stdio:'inherit'});
    }
})().catch(err=>{
    remapAndPrintError(err);
});
