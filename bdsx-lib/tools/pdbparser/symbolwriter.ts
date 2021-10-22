
import { emptyFunc } from "../../common";
import { remapAndPrintError } from "../../source-map-support";
import { arrayEquals } from "../../util";
import { StringLineWriter } from "../../writer/linewriter";
import { styling } from "../bds-scripting/styling";
import { tsw } from "../lib/tswriter";
import { resolveSuper } from "./findsuper";
import { tswItemCacheQueue } from "./itemcache";
import { resolvePacketClasses } from "./packetresolver";
import { reduceTemplateTypes } from "./reducetemplate";
import { DecoSymbol, PdbId } from "./symbolparser";
import { PdbMember, PdbMemberList } from "./symbolsorter";
import { TemplateInfo } from "./templateinfo";
import { TsFile, TsImportItem } from "./tsimport";
import { tswNames } from "./tswnames";
import { wrapperUtil } from "./tswrapperutil";
import path = require('path');
import ProgressBar = require("progress");

let installedBdsVersion = '';
try {
    const json = require('../../../bdsx/bedrock_server/installinfo.json');
    if (json == null) installedBdsVersion = 'unknown';
    else installedBdsVersion = json.bdsVersion || 'unknown';
} catch (err) {
    installedBdsVersion = 'unknown';
}

// resolveSuper(); // pretty inaccurate
resolvePacketClasses();

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
specialNameRemap.set("`vftable'", '__vftable');
specialNameRemap.set("`vbtable'", '__vbtable');
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
}

const adjustorRegExp = /^(.+)`adjustor{([0-9]+)}'$/;
const idremap:Record<string, string> = {'{':'','}':'',',':'_','<':'_','>':'_'};
const recursiveCheck = new Set<Identifier>();

interface TemplateRedirect {
    redirect(item:PdbId<PdbId.TemplateBase>, templates:Identifier[], opts:ToTswOptions):tsw.ItemPair;
    templates:Identifier[];
}

interface Identifier extends PdbId<PdbId.Data> {
    jsType?:((item:Identifier)=>tsw.ItemPair)|tsw.ItemPair|TsImportItem|null;
    jsTypeOnly?:tsw.Type;
    jsTypeNullable?:boolean;
    templateRedirects?:TemplateRedirect[];

    dontExport?:boolean;
    dontExportContents?:boolean;
    paramVarName?:string|null;
    filted?:boolean;
    tswVar?:tsw.Name;

    isMantleClass?:boolean;
}

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

function isPrimitiveType(item:tsw.ItemPair, raw:Identifier):boolean {
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

    js(jsType:[string, TsFile]|((item:Identifier)=>tsw.ItemPair)|TsImportItem|tsw.ItemPair|null, opts:{
        jsTypeNullable?:boolean,
        jsTypeOnly?:tsw.Type,
        exportOriginal?:boolean,
    } = {}):this {
        if (jsType instanceof Array) {
            const [name, host] = jsType;
            this.item.jsType = new wrapperUtil.ImportItem(minecraft, host, name);
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
        templateRedirect:(item:PdbId<PdbId.TemplateBase>, templates:Identifier[], opts:ToTswOptions)=>tsw.ItemPair,
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
    export const nativetype = new TsFile('./nativetype');
    export const cxxvector = new TsFile('./cxxvector');
    export const complextype = new TsFile('./complextype');
    export const dnf = new TsFile('./dnf');
    export const nativeclass = new TsFile('./nativeclass');
    export const dll = new TsFile('./dll');
    export const core = new TsFile('./core');
    export const common = new TsFile('./common');
    export const pointer = new TsFile('./pointer');
    export const sharedpointer = new TsFile('./sharedpointer');
    export const jsonvalue = new TsFile('./jsonvalue');
}

interface ToTswOptions {
    isField?:boolean;
    noTemplate?:boolean;
    noJsType?:boolean;
    absoluteValue?:boolean;
}

class MakeFuncOptions {
    private value:tsw.ObjectDef|null = null;
    private readonly map = new Map<string, number>();

    has(key:string):boolean {
        return this.map.has(key);
    }

    add(prop:tsw.NameProperty, value:tsw.Value):void {
        if (this.value === null) {
            this.value = new tsw.ObjectDef([]);
        }
        const oidx = this.map.get(prop.name);
        if (oidx != null) {
            this.value.fields[oidx] = [prop, value];
        } else {
            const idx = this.value.fields.push([prop, value])-1;
            this.map.set(prop.name, idx);
        }
    }

    get():tsw.Value {
        return this.value || tsw.Constant.null;
    }
}

class FunctionMaker {
    public readonly opts = new MakeFuncOptions;
    public returnType:tsw.ItemPair;
    public parameters:tsw.ItemPair[];
    public parametersWithoutThis:tsw.ItemPair[];
    public parameterNames:tsw.Name[];
    public parametersOffset = 0;
    private paramDeclares:tsw.DefineItem[]|null = null;

    constructor(
        private readonly file:MinecraftTsFile,
        public readonly isStatic:boolean,
        returnType:Identifier,
        parameters:Identifier[],
        public readonly classType:tsw.ItemPair|null) {
        if (!isStatic && classType != null) {
            this.opts.add(tswNames.this, classType.value);
        }
        this.returnType = file.toTswReturn(returnType, this.opts, true);
        this.parametersWithoutThis = this.parameters = file.toTswParameters(parameters, true);
        this.parameterNames = file.makeParamNamesByTypes(parameters);
        if (classType != null) {
            if (classType.type instanceof tsw.TemplateType) {
                this.parametersWithoutThis = this.parameters.slice();
                if (isStatic) {
                    this.parameters.unshift(file.NativeClassType.wrap(classType));
                    this.parametersOffset = 0;
                } else {
                    this.parameters.unshift(classType);
                }
                this.parameterNames.unshift(tsw.Name.this);
            }
        }

    }

    private _getParamDeclares():tsw.DefineItem[] {
        if (this.paramDeclares !== null) return this.paramDeclares;
        return this.paramDeclares = this.file.makeParameterDecls(this.parameters, this.parameterNames);
    }

    makeType():tsw.ItemPair {
        const NativeFunctionType = this.file.NativeFunctionType.import();
        return new tsw.ItemPair(
            NativeFunctionType.value.call(tswNames.make, [
                this.returnType.value,
                this.opts.get(),
                ...this.parametersWithoutThis.map(id=>id.value)
            ]),
            new tsw.FunctionType(this.returnType.type, this._getParamDeclares())
        );
    }

    make(name:tsw.Property, overload:Identifier):MethodPair {
        const out = {} as MethodPair;
        out.declare = new tsw.MethodDecl(null, this.isStatic, name, this._getParamDeclares(), this.returnType.type);
        const paramDefs:tsw.Value[] = [
            new tsw.Constant(overload.address),
            new tsw.ArrayDef(this.parametersWithoutThis.map(pair=>pair.value!)),
            this.returnType.value!,
            this.opts.get()
        ];

        if (overload.templateBase !== null) {
            const templates = overload.templateParameters!.map(t=>this.file.toTsw(t, {absoluteValue: true}).value!);
            paramDefs.push(new tsw.ArrayDef(templates));
        }

        out.variable = this.file.getOverloadVarId(overload);
        out.assign = new tsw.Assign(out.variable.member(tswNames.overloadInfo), new tsw.ArrayDef(paramDefs));
        return out;
    }
}

interface MethodPair {
    declare:tsw.MethodDecl;
    variable:tsw.Name;
    assign:tsw.Assign;
}

class ParsedFunction {
    declare:tsw.MethodDecl;
    templateDeclare:tsw.MethodDecl|null = null;
    variable:tsw.Name;
    assign:tsw.Assign;

    constructor(file:MinecraftTsFile, name:tsw.Property, field:PdbMember<PdbId.Function>, overload:Identifier) {
        if (!overload.is(PdbId.Function)) throw Error(`is not function(${overload})`);
        if (overload.data.returnType === null) throw Error(`Unresolved return type (${overload})`);
        if (overload.parent === null) throw Error(`is function but no parent`);

        const classType = file.getClassType(overload, true);

        const func = new FunctionMaker(
            file, field.isStatic,
            overload.data.returnType, overload.data.functionParameters, classType);

        const method = func.make(name, overload);
        this.declare = method.declare;
        this.variable = method.variable;
        this.assign = method.assign;

        if (overload.templateBase !== null) {
            const typeOfTemplates = overload.templateParameters!.map(v=>v.getTypeOfIt());
            const types = typeOfTemplates.map(item=>file.toTsw(item));
            const tswNames = file.makeParamNamesByTypes(typeOfTemplates);
            const tparams = file.makeParameterDecls(types, tswNames, field.isStatic, classType?.type);
            for (const param of tparams) {
                if (param instanceof tsw.VariableDefineItem) {
                    if (param.name === tsw.Name.this) continue;
                    param.initial = tsw.OPTIONAL;
                }
            }
            const treturnType = new tsw.FunctionType(func.returnType.type!, tparams.slice(classType != null ? 1 : 0));
            this.templateDeclare = new tsw.MethodDecl(null, field.isStatic, name, tparams, treturnType);
        }
    }
}

class TsCode {
    public readonly doc = new tsw.Block;
    public readonly imports:tsw.ImportList;
    public readonly defs = new tsw.VariableDef('const', []);

    constructor(public readonly base:MinecraftTsFile) {
        this.imports = this.base.imports;
        this.doc.write(this.defs);
    }

    getIdName(item:Identifier):string {
        if (item.typeDefFrom !== null) {
            return this.getIdName(item.typeDefFrom);
        }
        if (item.templateBase !== null) {
            return this.getIdName(item.templateBase)+'_'+item.templateParameters!.map(id=>this.getIdName(id)).join('_');
        }
        if (item.data instanceof PdbId.Decorated) {
            return this.getIdName(item.data.base);
        }
        if (item.data instanceof PdbId.MemberPointerType) {
            return this.getIdName(item.data.memberPointerBase)+'_m';
        }
        if (item.data instanceof PdbId.MemberFunctionType) {
            return this.getIdName(item.data.memberPointerBase)+'_fn';
        }
        const nameobj = this.base.getNameOnly(item);
        if (!(nameobj instanceof tsw.NameProperty)) throw Error(`is not name(${item})`);
        let name = nameobj.name.replace(/[{},<>]/g, v=>idremap[v]);
        if (name.startsWith('-')) {
            name = 'minus_'+name.substr(1);
        }
        if (item.parent !== null && item.parent !== PdbId.global) {
            name = this.getIdName(item.parent) + '_' + name;
        }
        return name;
    }

    defineType(item:Identifier, type:tsw.Type):tsw.BlockItem {
        const name = this.base.getNameOnly(item);
        return new tsw.Export(new tsw.TypeDef(name.toName().type, type));
    }

    defineVariable(name:tsw.Property, type:tsw.Type|null, define:'const'|'let', initial?:tsw.Value):tsw.BlockItem {
        const exported = new tsw.Export(new tsw.VariableDef(define, [new tsw.VariableDefineItem(name.toName().value, type, initial)]));
        if (initial == null) exported.writeJS = emptyFunc;
        return exported;
    }

    getClassDeclaration(name:tsw.Property, type:tsw.Type|null, isReadonly:boolean, isStatic:boolean):tsw.ClassItem {
        return new tsw.ClassField(null, isStatic, isReadonly, name, type);
    }

    getName(item:Identifier, opts:{assignee?:boolean, insideOfClass?:boolean, absoluteValue?:boolean} = {}):tsw.ItemPair {
        if (item.templateBase !== null) {
            throw Error(`${item}: getName with template`);
        }
        if (item.parent === null) {
            throw Error(`${item.name} has not parent`);
        }

        let result:tsw.ItemPair|null = null;
        if (item.parent !== PdbId.global) {
            result = this.base.toTsw(item.parent, {absoluteValue: opts.absoluteValue});
            if (opts.insideOfClass && !item.isStatic && !item.isType && item.parent.is(PdbId.ClassLike) &&
                (item.is(PdbId.Function) || item.is(PdbId.FunctionBase) || item.is(PdbId.TemplateFunctionBase))) {
                result = result.changeValue(result.value.member(tsw.NameProperty.prototypeName));
            }
        }

        const prop = this.base.getNameOnly(item);
        if (result !== null) {
            result = new tsw.ItemPair(
                result.value.member(prop),
                result.type.member(prop)
            );
        } else {
            if (opts.assignee) {
                result = new tsw.ItemPair(
                    tsw.Name.exports.member(prop),
                    prop.toName().type
                );
            } else {
                result = prop.toName();
            }
        }
        return result;
    }
}

class TsCodeDeclaration extends TsCode {
    public readonly idsMap = new Set<Identifier>();
    private readonly nameMaker = (item:PdbId<PdbId.Data>):tsw.Type=>this.base.toTsw(item).type;

    public currentNs:Identifier = PdbId.global;
    public currentBlock:tsw.Block = this.doc;
    public currentClass:tsw.Class|null = null;

    constructor(
        public readonly base:MinecraftTsFile,
        private readonly ids:Identifier[]
    ) {
        super(base);
    }

    private _writeRedirect(item:Identifier):void {
        if (!(this.currentBlock instanceof tsw.Block)) {
            throw Error(`${this.currentBlock} is not block`);
        }

        try {
            if (!item.is(PdbId.TypeDef)) {
                PdbId.printOnProgress(`[symbolwriter.ts] ${item}: is not redirecting`);
                return;
            }
            const ori = item.data.typeDef;
            const from = ori.typeDefFrom;
            ori.typeDefFrom = null;
            const type = this.base.toTsw(ori).type;
            const NativeClassType = this.base.NativeClassType.importType();
            if (COMMENT_SYMBOL) this.currentBlock.comment(ori.symbolIndex+': '+ori.source);
            this.currentBlock.write(this.defineType(item, type));
            const typeOfThis = new tsw.TypeOf(this.base.toTsw(ori.removeTemplateParameters()).value);
            const classType = NativeClassType.template(type).and(typeOfThis);
            const name = this.base.getNameOnly(item);
            this.currentBlock.write(this.defineVariable(name, classType, 'const', this.base.toTsw(ori).value));
            ori.typeDefFrom = from;
        } catch (err) {
            if (err instanceof IgnoreThis) {
                this.currentBlock.comment(`ignored: ${item}`);
                this.currentBlock.comment(`  ${err.message}`);
                return;
            }
            throw err;
        }
    }

    private _writeFunctionMember(field:PdbMember<PdbId.Function>, insideOfClass:boolean):void {
        // set default constructor
        if (this.currentClass !== null) {
            for (const overload of field.overloads) {
                if (overload.data.functionParameters.length === 0 && overload.data.functionBase.name === overload.parent!.name) {
                    const NativeType = this.base.NativeType.importValue();
                    const method = new tsw.MethodDef(null, false, new tsw.BracketProperty(NativeType.member(tswNames.ctor)), [], tsw.BasicType.void);
                    method.block.write(new tsw.Return(new tsw.DotCall(tsw.Name.this, tswNames.constructWith, [])));
                    this.currentClass.write(method);
                    break;
                }
            }
        }

        try {
            const impl = this.base.doc.impl;
            const overloads = field.overloads;
            if (overloads.length === 0) {
                throw Error(`empty overloads`);
            }
            if (!insideOfClass && field.isStatic) {
                throw Error(`${overloads[0]}: is static but not in the class`);
            }

            const target = field.base.removeTemplateParameters();
            const name = this.base.getNameOnly(field.base);

            const scope = this.currentClass || this.currentBlock;

            const writedOverloads:tsw.Name[] = [];
            let previousParams:PdbId<PdbId.Data>[]|null = null;
            let previousThis:PdbId<PdbId.Data>|null = null;
            for (const overload of overloads) {
                try {
                    const thisParam = overload.parent!.templateBase !== null ? overload.parent! : null;
                    if (COMMENT_SYMBOL) scope.comment(overload.symbolIndex+': '+overload.source);
                    if (overload.data.returnType === null) throw Error(`Unresolved return type (${overload})`);
                    const func = new ParsedFunction(this.base, name, field, overload);

                    if (previousParams === null || (
                        !arrayEquals(overload.data.functionParameters, previousParams) ||
                        previousThis !== thisParam
                    )) {
                        previousParams = overload.data.functionParameters;
                        previousThis = thisParam;
                        scope.addFunctionDecl(name, func.declare.params.params, func.declare.returnType, field.isStatic);
                    } else {
                        scope.comment(`dupplicated: ${func.declare};`);
                    }
                    const tinfo = TemplateInfo.from(overload);
                    const n = tinfo.parameters.length;
                    if (n !== 0) {
                        const args:tsw.DefineItem[] = [];
                        for (let i=0;i<n;i++) {
                            const name = new tsw.Name('T'+i);
                            const type = tinfo.parameters[i];
                            if (type instanceof Array) {
                                args.push(new tsw.VariableDefineItem(name, new tsw.Tuple(type.map(this.nameMaker))));
                            } else {
                                args.push(new tsw.VariableDefineItem(name, this.nameMaker(type.getTypeOfIt())));
                            }
                        }
                        const funcReturn = new tsw.FunctionType(func.declare.returnType || tsw.BasicType.any, func.declare.params.params);
                        scope.addFunctionDecl(name, args, funcReturn, field.isStatic);
                    }
                    impl.doc.write(func.assign);
                    writedOverloads.push(func.variable);
                } catch (err) {
                    if (!(err instanceof IgnoreThis)) {
                        PdbId.printOnProgress(`> Writing ${overload} (symbolIndex=${overload.symbolIndex})`);
                        throw err;
                    }
                    scope.comment(`ignored: ${overload}`);
                    scope.comment(`  ${err.message}`);
                }
            }

            if (writedOverloads.length !== 0) {
                const funcdef = this.base.getFunctionVarId(target);
                if (this.currentClass !== null) {
                    const clsName = this.currentClass.name;
                    if (field.isStatic) {
                        this.currentBlock.assign(clsName.member(name), funcdef);
                    } else {
                        this.currentBlock.assign(clsName.member(tsw.NameProperty.prototypeName).member(name), funcdef);
                    }
                } else {
                    const exported = this.currentBlock.export(new tsw.VariableDef('const', [
                        new tsw.VariableDefineItem(name.toName().value, null, funcdef)
                    ]));
                    exported.cloneToDecl = ()=>null;
                }
                this.currentBlock.assign(funcdef.member(tswNames.overloads), new tsw.ArrayDef(writedOverloads));
            }

        } catch (err) {
            if ((err instanceof IgnoreThis)) {
                const block = this.currentClass || this.currentBlock;
                block.comment(`ignored: ${field.base.name}`);
                block.comment(`  ${err.message}`);
            } else {
                throw err;
            }
        }
    }

    private _writeFieldMember(member:PdbMember<PdbId.Data>, isStatic:boolean):void {
        try {
            const overloads:Identifier[] = [];
            for (const overload of member.overloads) {
                if (overload.address === 0) {
                    this.currentBlock.comment(`ignored: ${member.base}`);
                    this.currentBlock.comment(`  address not found - ${overload}`);
                    PdbId.printOnProgress(`[symbolwriter.ts] ${overload}: address not found`);
                    continue;
                }
                overloads.push(overload);
            }
            const typeRaw = PdbId.makeUnionedType(overloads.map(item=>{
                if (COMMENT_SYMBOL) this.currentBlock.comment(item.symbolIndex+': '+item.source);
                if (item.is(PdbId.ReturnAble)) {
                    if (item.data.returnType === null) throw Error(`Unresolved return type (${item})`);
                    return item.data.returnType;
                } else {
                    return StaticPointer_raw;
                }
            }), '&');
            let type = this.base.toTsw(typeRaw, {isField: true}).type;

            // unwrap const
            if (type instanceof tsw.TemplateType && type.type === Const.type) {
                type = type.params[0];
            }

            const name = this.base.getNameOnly(member.base);
            if (this.currentClass !== null) {
                this.currentClass.write(this.getClassDeclaration(name, type, false, isStatic));
            } else {
                this.currentBlock.write(this.defineVariable(name, type, 'const'));
            }

            const impl = this.base.doc.impl;

            const namestr = new tsw.Constant(name.toName().value.name);
            let NativeType:tsw.Value|null = null;

            for (const overload of overloads) {
                try {
                    if (COMMENT_SYMBOL) impl.doc.comment(overload.symbolIndex+': '+overload.source);
                    const addrvar = this.base.getAddressVarId(overload);
                    if (overload.is(PdbId.ReturnAble)) {
                        if (overload.parent === null) {
                            throw Error(`${overload}: has not parent`);
                        }


                        let parent:tsw.Value;
                        if (overload.parent === PdbId.global) {
                            parent = tsw.Name.exports;
                        } else {
                            parent = impl.base.toTsw(overload.parent, {absoluteValue: true}).value;
                        }

                        if (NativeType === null) {
                            NativeType = this.base.NativeType.importValue();
                        }
                        if (overload.data.returnType === null) throw Error(`Unresolved return type (${overload})`);
                        const type = impl.base.toTsw(overload.data.returnType, {isField: true, absoluteValue: true}).value;
                        impl.doc.write(NativeType.call(tswNames.definePointedProperty, [
                            parent,
                            namestr,
                            addrvar,
                            type
                        ]));
                    } else {
                        const targetName = impl.getName(overload, {assignee: true, absoluteValue: true}).value;
                        impl.doc.assign(targetName, addrvar);
                    }
                } catch (err) {
                    if ((err instanceof IgnoreThis)) {
                        this.currentBlock.comment(`ignored: ${member.base}`);
                        this.currentBlock.comment(`  ${err.message}`);
                    } else {
                        throw err;
                    }
                }
            }
        } catch (err) {
            if ((err instanceof IgnoreThis)) {
                this.currentBlock.comment(`ignored: ${member.base}`);
                this.currentBlock.comment(`  ${err.message}`);
            } else {
                throw err;
            }
        }
    }

    private _writeClassMember(member:PdbMember<PdbId.Data>):void {
        const base:Identifier = member.base;

        try {
            let opened = false;
            const clsname = this.base.getNameOnly(base);
            if (clsname instanceof tsw.NameProperty) {
                if (clsname.name.startsWith('~')) {
                    throw Error(`Unexpected class name ${clsname.name}`);
                }
            }
            const clsnameValue = clsname.toName().value;
            const cls = new tsw.Class(clsnameValue);
            const tinfo = TemplateInfo.from(base);
            if (tinfo.paramTypes.length !== 0) {
                if (COMMENT_SYMBOL) {
                    for (const overload of member.overloads) {
                        this.currentBlock.comment(overload.symbolIndex+': '+overload.source);
                    }
                }
                const templateDecl = tinfo.makeTemplateDecl(this.nameMaker);
                cls.templates = templateDecl;
                cls.extends = this.base.NativeTemplateClass.importValue();
                this.currentBlock.export(cls);
                this.currentClass = cls;
                this.base.currentClassId = base;
                opened = true;

                try {
                    const makeTemplateParams = tinfo.makeWrappedTemplateDecl(this.nameMaker);
                    const types = tinfo.paramTypes.map(v=>tsw.NamePair.create(v.name));
                    const paramNames = this.base.makeParamNamesByLength(types.length);
                    const args = this.base.makeParameterDecls(types, paramNames);

                    const unwrappedType:tsw.TemplateType[] = [];
                    const NativeClassType = this.base.NativeClassType.importType();
                    if (tinfo.paramTypes.length !== 0) {
                        const UnwrapType = this.base.UnwrapType.importType();
                        for (const param of tinfo.paramTypes) {
                            unwrappedType.push(new tsw.TemplateType(UnwrapType, [new tsw.TypeName(param.name)]));
                        }
                    }
                    const returnType = new tsw.TemplateType(NativeClassType, [
                        new tsw.TemplateType(clsname.toName().type, unwrappedType)
                    ]).and(new tsw.TypeOf(clsnameValue));
                    const def = new tsw.MethodDecl(null, true, tswNames.make, args, returnType);
                    def.templates = makeTemplateParams;
                    this.currentClass.write(def);
                } catch (err) {
                    if (err instanceof IgnoreThis) {
                        this.currentBlock.comment(`ignored: ${base}`);
                        this.currentBlock.comment(`  ${err.message}`);
                    } else {
                        throw err;
                    }
                }
            } else {
                if (
                    member.is(PdbId.ClassLike) ||
                    member.is(PdbId.TemplateClassBase) // template but no template parameters.
                ) {
                    const first:Identifier&PdbId<PdbId.ClassLike|PdbId.TemplateClassBase> = member.overloads[0];
                    if (member.is(PdbId.Enum)) {
                        if (COMMENT_SYMBOL) this.currentBlock.comment(first.symbolIndex+': '+first.source);
                        this.currentBlock.export(new tsw.Enum(clsnameValue, []));
                    } else {
                        if (COMMENT_SYMBOL) this.currentBlock.comment(first.symbolIndex+': '+first.source);
                        if (first.isMantleClass) {
                            const MantleClass = this.base.MantleClass.importValue();
                            cls.extends = MantleClass;
                        } else {
                            let supercls:tsw.Value|null = null;
                            if (first.is(PdbId.Class)) {
                                const superid = resolveSuper.getSuper(first);
                                if (superid !== null) {
                                    supercls = this.base.toTsw(superid).value;
                                }
                            }
                            if (supercls === null) {
                                const NativeClass = this.base.NativeClass.importValue();
                                supercls = NativeClass;
                            }
                            cls.extends = supercls;
                        }
                        this.currentBlock.export(cls);
                        this.currentClass = cls;
                        opened = true;
                    }
                }
            }

            if (base.dontExportContents) {
                this.currentClass = null;
                return;
            }

            const fields = new PdbMemberList;
            for (const overload of member.overloads) {
                this.getAllFields(fields, overload);
            }

            const funcNames = new Set<string>();
            const sortedMember = fields.sortedMember();
            if (opened) {
                for (const field of fields.sortedStaticMember()) {
                    if (field.isStatic) {
                        funcNames.add(field.base.name);
                    }
                    this.writeMembers(field, true);
                }
                for (const field of sortedMember) {
                    this.writeMembers(field, true);
                }
            }

            this.currentClass = null;

            for (const _ of this.enterNamespace(base)) {
                if (!opened) {
                    for (const field of sortedMember) {
                        if (field.isStatic) {
                            funcNames.add(field.base.name);
                        }
                        try {
                            this.writeMembers(field, false);
                        } catch (err) {
                            if ((err instanceof IgnoreThis)) {
                                this.currentBlock.comment(`ignored: ${field.base.name}`);
                                this.currentBlock.comment(`  ${err.message}`);
                            } else {
                                PdbId.printOnProgress(`> Writing ${field.base} (symbolIndex=${field.base.symbolIndex})`);
                                throw err;
                            }
                        }
                    }
                }

                for (const field of fields.sortedInNamespace()) {
                    try {
                        if (funcNames.has(field.base.name)) {
                            this.currentBlock.comment(`ignored: ${field.base.name}`);
                            this.currentBlock.comment('  dupplicated function name');
                            continue;
                        }
                        this.writeMembers(field, false);
                    } catch (err) {
                        if ((err instanceof IgnoreThis)) {
                            this.currentBlock.comment(`ignored: ${field.base.name}`);
                            this.currentBlock.comment(`  ${err.message}`);
                        } else {
                            PdbId.printOnProgress(`> Writing ${field.base} (symbolIndex=${field.base.symbolIndex})`);
                            throw err;
                        }
                    }
                }
            }
        } catch (err) {
            if ((err instanceof IgnoreThis)) {
                this.currentBlock.comment(`ignored: ${base}`);
                this.currentBlock.comment(`  ${err.message}`);
                return;
            }
            throw err;
        }
    }

    private _getField(out:PdbMemberList, item:Identifier):void {
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
                out.push(item, o);
            }
        } else {
            out.push(item, item);
        }
    }

    existName(name:string):boolean {
        const item:Identifier|null = PdbId.global.getChild(name);
        return item != null && !item.dontExport;
    }

    canAccessGlobalName(name:string):boolean {
        let ns = this.currentNs;
        while (ns !== PdbId.global) {
            const item:Identifier|null = ns.getChild(name);
            if (item != null && !item.dontExport) {
                return false;
            }
            ns = ns.parent!;
        }
        const item:Identifier|null = PdbId.global.getChild(name);
        return item == null || !item.dontExport;
    }

    *enterNamespace(item:Identifier):IterableIterator<void> {
        if (!(this.currentBlock instanceof tsw.Block)) throw Error(`${this.currentBlock} is not namespace`);
        const prop = this.base.getNameOnly(item);

        const ns = new tsw.Namespace(prop.toName().value);

        const oldblock = this.currentBlock;
        const oldclass = this.currentClass;
        const oldclassid = this.base.currentClassId;
        const oldns = this.currentNs;
        this.currentBlock = ns.block;
        this.currentClass = null;
        this.base.currentClassId = null;
        this.currentNs = item;
        try {
            yield;
        } catch (err) {
            remapAndPrintError(err);
        }
        this.currentNs = oldns;
        this.base.currentClassId = oldclassid;
        this.currentClass = oldclass;
        this.currentBlock = oldblock;
        if (ns.block.size() !== 0) {
            this.currentBlock.write(new tsw.Export(ns));
        }
    }

    getAllFields(out:PdbMemberList, item:PdbId<PdbId.Data>):void {
        if (item.is(PdbId.TemplateBase)) {
            if (item.data.specialized.length !== 0) {
                for (const specialized of item.data.specialized) {
                    if (!PdbId.filter(specialized)) continue;
                    for (const child of specialized.children.values()) {
                        this._getField(out, child);
                    }
                }
            }
        }
        for (const child of item.children.values()) {
            this._getField(out, child);
        }
    }

    writeMembers(field:PdbMember<PdbId.Data>, insideOfClass:boolean):void {
        if (field.is(PdbId.Function)) {
            this._writeFunctionMember(field, insideOfClass);
        } else if (field.is(PdbId.TypeDef)) {
            this._writeRedirect(field.base);
        } else if (field.is(PdbId.NamespaceLike) || field.is(PdbId.TemplateBase)) {
            if (!insideOfClass) {
                this._writeClassMember(field);
            }
        } else {
            this._writeFieldMember(field, true);
        }
        // throw Error(`${base.source || base}: unexpected identifier`);
    }

    parseAll():void {
        const out = new PdbMemberList;
        for (const item of this.ids) {
            this._getField(out, item);
        }
        if (out.staticMember.size !== 0) {
            const first = getFirstIterableItem(out.staticMember)!;
            throw Error(`global static member: ${first.base}`);
        }
        const total = out.inNamespace.size + out.member.size;
        const bar = new ProgressBar('[symbolwriter.ts] Converting [:bar] :current/:total', total);
        try {
            for (const field of out.inNamespace) {
                try {
                    this.writeMembers(field, false);
                } catch (err) {
                    if (err instanceof IgnoreThis) {
                        this.currentBlock.comment(`ignored: ${field.base.name}`);
                        this.currentBlock.comment(`  ${err.message}`);
                        continue;
                    }
                    PdbId.printOnProgress(`> Writing ${field.base} (symbolIndex=${field.base.symbolIndex})`);
                    throw err;
                }
                bar.tick();
            }
            for (const field of out.member) {
                try {
                    this.writeMembers(field, false);
                } catch (err) {
                    if (err instanceof IgnoreThis) {
                        this.currentBlock.comment(`ignored: ${field.base.name}`);
                        this.currentBlock.comment(`  ${err.message}`);
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
}

class MinecraftDocument {
    public readonly decl:TsCodeDeclaration;
    public readonly impl:TsCode;

    constructor(base:MinecraftTsFile, ids:Identifier[]) {
        this.decl = new TsCodeDeclaration(base, ids);
        this.impl = new TsCode(base);
    }

    makeVariableForDeclarePhase(value:tsw.Value):tsw.Name {
        const tswvar = this.decl.doc.makeTemporalVariableName(this.impl.doc);
        this.decl.doc.addValueName(tswvar, this.decl.defs, value);
        this.decl.defs.vars.defines.push(new tsw.VariableDefineItem(tswvar, null, value));
        return tswvar;
    }

    makeVariableForImplementPhase(value:tsw.Value):tsw.Name {
        const tswvar = this.decl.doc.makeTemporalVariableName(this.impl.doc);
        this.decl.doc.addValueName(tswvar, this.decl.defs, value);
        this.impl.defs.vars.defines.push(new tsw.VariableDefineItem(tswvar, null, value));
        return tswvar;
    }

}

class MinecraftTsFile extends TsFile implements wrapperUtil.TsBase {
    public readonly Bufferable = new TsImportItem(this, imports.common, 'Bufferable');

    public readonly VoidPointer = new TsImportItem(this, imports.core, 'VoidPointer');

    public readonly NativeType = new TsImportItem(this, imports.nativetype, 'NativeType');
    public readonly templateArgs = new TsImportItem(this, imports.nativetype, 'templateArgs');
    public readonly UnwrapType = new TsImportItem(this, imports.nativetype, 'UnwrapType');
    public readonly int32_t = new TsImportItem(this, imports.nativetype, 'int32_t');

    public readonly NativeTemplateClass = new TsImportItem(this, imports.complextype, 'NativeTemplateClass');
    public readonly NativeFunctionType = new TsImportItem(this, imports.complextype, 'NativeFunctionType');
    public readonly MemberPointer = new TsImportItem(this, imports.complextype, 'MemberPointer');

    public readonly MantleClass = new TsImportItem(this, imports.nativeclass, 'MantleClass');
    public readonly NativeClass = new TsImportItem(this, imports.nativeclass, 'NativeClass');

    public readonly dnf = new TsImportItem(this, imports.dnf, 'dnf');
    public readonly dll = new TsImportItem(this, imports.dll, 'dll');

    public readonly NativeClassType = new wrapperUtil.ImportItem(this, imports.nativeclass, 'NativeClassType');
    public readonly Wrapper = new wrapperUtil.ImportItem(this, imports.pointer, 'Wrapper');
    public readonly Ptr = new wrapperUtil.ImportItem(this, imports.pointer, 'Ptr');
    public readonly SharedPtr = new wrapperUtil.ImportItem(this, imports.sharedpointer, 'SharedPtr');
    public readonly CxxVectorToArray = new wrapperUtil.ImportItem(this, imports.cxxvector, 'CxxVectorToArray', class extends wrapperUtil.Wrapper {
        wrapValue(value:tsw.Value):tsw.Value {
            return this.value.call(tswNames.make, [value]);
        }
        wrapType(type:tsw.Type):tsw.Type {
            return new tsw.ArrayType(type);
        }
    });
    public readonly EnumType = new wrapperUtil.ImportItem(this, imports.complextype, 'EnumType');

    private dnfMakeCall:tsw.Call|null = null;
    private dnfOverloadNew:tsw.Call|null = null;
    private dllCurrent:tsw.Value|null = null;
    private ctorProperty:tsw.BracketProperty|null = null;
    public currentClassId:Identifier|null = null;

    public readonly doc:MinecraftDocument;

    constructor(ids:Identifier[]) {
        super('./minecraft');
        this.doc = new MinecraftDocument(this, ids);
    }

    makeVariable(initial:tsw.Value):tsw.Name {
        return this.doc.makeVariableForImplementPhase(initial);
    }

    private _getVarName(type:Identifier):string {
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
            return this._getVarName(baseid.data.memberPointerBase)+'_m';
        }
        if (baseid.data instanceof PdbId.FunctionTypeBase) {
            return 'fn';
        }
        if (baseid.data instanceof PdbId.FunctionType) {
            if (baseid.data.returnType === null) throw Error(`returnType unresolved (${baseid})`);
            return this._getVarName(baseid.data.returnType)+'_fn';
        }
        if (baseid.data instanceof PdbId.MemberFunctionType) {
            return this._getVarName(baseid.data.memberPointerBase)+'_fn';
        }
        if (baseid.is(PdbId.TypeUnion)) return 'arg';
        if (LAMBDA_REGEXP.test(baseid.name)) {
            return 'lambda';
        }
        let basename = this.getNameOnly(baseid).toName().value.name;
        if (basename.endsWith('_t')) basename = basename.substr(0, basename.length-2);
        basename = styling.toCamelStyle(basename, /[[\] :*]/g, false);
        return basename;
    }

    makeParamNamesByTypes(ids:Identifier[]):tsw.Name[] {
        const namemap = new Map<string, {index:number, counter:number}>();
        const tswNames:string[] = new Array(ids.length);
        for (let i=0;i<ids.length;i++) {
            const basename = this._getVarName(ids[i]);

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

    makeParamNamesByLength(len:number):tsw.Name[] {
        const tswNames:tsw.Name[] = new Array(len);
        for (let i=0;i<len;i++) {
            tswNames[i] = new tsw.Name('arg'+i);
        }
        return tswNames;
    }

    insideOf(namespace:Identifier):boolean {
        return namespace === this.doc.decl.currentNs;
    }

    getIdName(item:Identifier):string {
        if (item.typeDefFrom !== null) {
            return this.getIdName(item.typeDefFrom);
        }
        if (item.templateBase !== null) {
            return this.getIdName(item.templateBase)+'_'+item.templateParameters!.map(id=>this.getIdName(id)).join('_');
        }
        if (item.data instanceof PdbId.Decorated) {
            return this.getIdName(item.data.base);
        }
        if (item.data instanceof PdbId.MemberPointerType) {
            return this.getIdName(item.data.memberPointerBase)+'_m';
        }
        if (item.data instanceof PdbId.MemberFunctionType) {
            return this.getIdName(item.data.memberPointerBase)+'_fn';
        }
        const nameobj = this.getNameOnly(item);
        if (!(nameobj instanceof tsw.NameProperty)) throw Error(`is not name(${item})`);
        let name = nameobj.name.replace(/[{},<>]/g, v=>idremap[v]);
        if (name.startsWith('-')) {
            name = 'minus_'+name.substr(1);
        }
        if (item.parent !== null && item.parent !== PdbId.global) {
            name = this.getIdName(item.parent) + '_' + name;
        }
        return name;
    }

    getNameOnly(item:Identifier):tsw.Property {
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
                const NativeType = this.NativeType.importValue();
                return new tsw.BracketProperty(NativeType.member(tswNames.dtor));
            }
        }

        if (item.is(PdbId.VCall)) {
            return new tsw.NameProperty('__vcall_'+this.getIdName(item.data.param));
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
                    name = '__vftable_for_'+params.map(id=>this.getIdName(id)).join('_');
                } else if (name.startsWith("`vbtable'")) {
                    name = '__vbtable_for_'+params.map(id=>this.getIdName(id)).join('_');
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
                    name = 'operator_castto_'+this.getIdName(over.data.returnType);
                    break;
                }
            } else {
                throw Error(`failed to get return type(${item})`);
            }
        } else if (LAMBDA_REGEXP.test(name)) {
            name = RegExp.$1;
        } else if (name === '<lambda_invoker_cdecl>') {
            name = 'lambda_invoker_cdecl';
        }
        return new tsw.NameProperty(name);
    }

    getClassType(item:Identifier, absoluteValue?:boolean):tsw.ItemPair|null {
        if (!item.isType && (item.parent!.data instanceof PdbId.ClassLike)) {
            return this.toTsw(item.parent!, {absoluteValue});
        } else {
            return null;
        }
    }

    makeParameterDecls(paramTypes:tsw.ItemPair[], paramNames:tsw.Name[], isStaticMethod?:boolean, classType?:tsw.Type|null):tsw.DefineItem[] {
        const declaration:tsw.DefineItem[] = [];
        for (let i=0;i<paramNames.length;i++) {
            declaration[i] = new tsw.VariableDefineItem(paramNames[i], paramTypes[i].type);
        }
        if (classType != null) {
            if (isStaticMethod) {
                const NativeClassType = this.NativeClassType.importType();
                classType = new tsw.TemplateType(NativeClassType, [classType]);
            }
            declaration.unshift(new tsw.VariableDefineItem(tsw.Name.this, classType));
        }
        return declaration;
    }

    toTswTemplateParameters(args:(Identifier[]|Identifier)[], absoluteValue?:boolean):tsw.ItemPair[] {
        return args.map((id):tsw.ItemPair=>{
            const opts = {absoluteValue};
            let out:tsw.ItemPair;
            if (id instanceof Array) {
                const params = id.map(id=>this.toTsw(id, opts));
                const templateArgs = this.templateArgs.importValue();
                out = new tsw.ItemPair(
                    new tsw.Call(templateArgs, params.map(id=>id.value)),
                    new tsw.Tuple(params.map(id=>id.type))
                );
            } else {
                out = this.toTsw(id, opts);
            }
            return out;
        });
    }

    toTswReturn(type:Identifier, opts:MakeFuncOptions, absoluteValue?:boolean):tsw.ItemPair {
        const returnType = this.toTsw(type, {absoluteValue});
        return this.plaining(type, returnType, opts);
    }

    toTswParameters(items:Identifier[], absoluteValue?:boolean):tsw.ItemPair[] {
        return items.map(item=>{
            const v = this.toTsw(item, {absoluteValue});
            return this.plaining(item, v, null);
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
                return redirect.redirect(item, templates, {}).type;
            }
        }
        const params = tinfo.paramTypes.map(()=>tsw.BasicType.any);
        return new tsw.TemplateType(type, params);
    }

    private _toTsw(item:Identifier, opts:ToTswOptions):tsw.ItemPair {
        if (item.parent === PdbId.global && item.name.startsWith('`')) {
            throw new IgnoreThis(`private symbol (${item})`);
        }

        if (recursiveCheck.has(item)) {
            throw Error(`recursive (${item})`);
        }

        try {
            recursiveCheck.add(item);

            if (item.typeDefFrom !== null && !opts.noTemplate) {
                return this.toTsw(item.typeDefFrom, opts);
            }
            if (item.is(PdbId.Decorated)) {
                if (item.data.deco === DecoSymbol.const) {
                    return Const.wrap(this.toTsw(item.data.base, opts));
                }
                if (item.data.deco !== null && item.data.deco.name === '[0]') throw new IgnoreThis(`incomprehensible syntax(${item})`);
            }
            if (item.is(PdbId.TypeUnion)) {
                const types:tsw.Type[] = [];
                let ignored:IgnoreThis|null = null;
                for (const union of item.data.unionedTypes) {
                    try {
                        const type = this.toTsw(union, opts);
                        types.push(type.type);
                    } catch (err) {
                        if (!(err instanceof IgnoreThis)) throw err;
                        ignored = err;
                    }
                }
                if (types.length === 0) {
                    throw ignored || new IgnoreThis('No types');
                }
                return {
                    type: new tsw.TypeOr(types)
                } as any;
            }
            if (!opts.noJsType && item.jsType != null) {
                let out:tsw.ItemPair;
                if (item.jsType instanceof tsw.ItemPair) {
                    out = item.jsType;
                } else if (item.jsType instanceof TsImportItem) {
                    out = item.jsType.import();
                } else {
                    out = item.jsType(item);
                }
                if (item.jsTypeOnly != null) {
                    out = out.changeType(item.jsTypeOnly);
                }
                if (!opts.noTemplate) {
                    out = new tsw.ItemPair(out.value, this.wrapAnyTemplate(out.type, item));
                }
                return out;
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
                            if (baseitem.is(PdbId.Function)) {
                                return new tsw.ItemPair(
                                    this.getOverloadVarId(baseitem),
                                    this.toTsw(baseitem.getTypeOfIt()).type
                                );
                            } else {
                                return new tsw.ItemPair(
                                    this.getAddressVarId(baseitem),
                                    this.toTsw(baseitem.getTypeOfIt()).type
                                );
                            }
                        }
                    }
                    let out = this.toTsw(baseitem, {absoluteValue: opts.absoluteValue});
                    if (item.isValue) {
                        out = new tsw.ItemPair(out.value, this.toTsw(item.getTypeOfIt()).type);
                    }
                    if (baseitem.is(PdbId.FunctionType)) {
                        // do nothing
                    } else if (baseitem.is(PdbId.MemberPointerType)) {
                        // do nothing
                    } else {
                        if (!isRef) {
                            out = new tsw.ItemPair(out.value, out.type.or(tsw.BasicType.null));
                        }
                        if (opts.isField) {
                            out = refCall.wrap(out);
                        } else {
                            if (isRef) out = Ref.wrap(out);
                            else out = this.Ptr.wrap(out);
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

            let out:tsw.ItemPair;
            if (item.templateBase !== null) {
                const base:Identifier = item.templateBase;
                out = this.toTsw(base, {...opts, noTemplate:true});
            } else if (item.is(PdbId.MemberPointerType)) {
                const base = this.toTsw(item.data.memberPointerBase, {absoluteValue:opts.absoluteValue});
                const type = this.toTsw(item.data.type, {absoluteValue:opts.absoluteValue});
                const MemberPointer = this.MemberPointer.import();
                return new tsw.ItemPair(
                    MemberPointer.value.call(tswNames.make, [base.value!, type.value!]),
                    new tsw.TemplateType(MemberPointer.type, [base.type!, type.type!]),
                );
            } else if (item.is(PdbId.FunctionType)) {
                if (item.data.returnType === null) throw Error(`Unresolved return type (${item})`);
                const func = new FunctionMaker(this, false, item.data.returnType, item.data.functionParameters, null);
                return func.makeType();
            } else {
                const prop = this.getNameOnly(item);
                if (item.hasNonGlobalParent()) {
                    const insideOfNamespace = this.insideOf(item.parent);
                    if (insideOfNamespace && !opts.absoluteValue) {
                        out = prop.toName();
                    } else {
                        out = this.toTsw(item.parent, {noTemplate: true, absoluteValue:opts.absoluteValue});
                        if (!item.isStatic && !item.isType && item.parent.is(PdbId.ClassLike) &&
                            (item.is(PdbId.Function) || item.is(PdbId.FunctionBase) || item.is(PdbId.TemplateFunctionBase))) {
                            out = out.changeValue(out.value.member(tsw.NameProperty.prototypeName));
                        }
                        out = out.member(prop);
                    }
                } else {
                    out = prop.toName();
                }
            }

            const tinfo = TemplateInfo.from(item);
            if (tinfo.parameters.length === 0 && item.is(PdbId.Enum)) {
                out = out.changeValue(this.EnumType.importValue().call(tswNames.make, [out.value]));
            }

            if (!opts.noTemplate) {
                if (tinfo.parameters.length !== 0) {
                    if (item.is(PdbId.Function)) {
                        if (item.data.returnType === null) throw Error(`Unresolved return type (${item})`);
                        const classType = this.getClassType(item);
                        const retType = this.toTsw(item.data.returnType).type;

                        const types = this.toTswParameters(item.data.functionParameters, opts.absoluteValue);
                        const tswNames = this.makeParamNamesByTypes(item.data.functionParameters);
                        const params = this.makeParameterDecls(types, tswNames, item.isStatic, classType?.type);
                        out = new tsw.ItemPair(
                            this.getOverloadVarId(item),
                            new tsw.FunctionType(retType, params),
                        );
                    } else {
                        const base:(Identifier&PdbId<PdbId.TemplateBase>)|null = item.templateBase;
                        if (base !== null && base !== this.currentClassId) {
                            if (base.templateRedirects != null) {
                                for (const redirect of base.templateRedirects) {
                                    const templates = tinfo.infer(redirect.templates);
                                    if (templates !== null) {
                                        return redirect.redirect(base, templates, {absoluteValue: opts.absoluteValue});
                                    }
                                }
                            }
                        }

                        const params = this.toTswTemplateParameters(tinfo.parameters, opts.absoluteValue);
                        out = new tsw.ItemPair(
                            new tsw.DotCall(out.value, tswNames.make, params.map(v=>v.value!)),
                            new tsw.TemplateType(out.type, params.map(v=>v.type!)),
                        );
                    }
                } else {
                    out = new tsw.ItemPair(
                        out.value,
                        this.wrapAnyTemplate(out.type, item)
                    );
                }
            }
            if (item.isValue) {
                out = out.changeType(this.toTsw(item.getTypeOfIt()).type);
            }
            return out;
        } finally {
            recursiveCheck.delete(item);
        }
    }

    toTsw(item:Identifier, opts:ToTswOptions = {}):tsw.ItemPair {
        const cached = tswItemCacheQueue.get(item);
        if (cached != null) return cached;
        // tswItemCacheQueue.set();
        return this._toTsw(item, opts);
    }

    plaining(raw:Identifier, item:tsw.ItemPair, opts:MakeFuncOptions|null):tsw.ItemPair {

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
                        item = refCall.wrap(inner.component);
                        pointerRemoved = true;
                    }
                }
            } else {
                if (Ref.is(item)) {
                    // Ref<T> -> T
                    item = item.component;
                    pointerRemoved = true;
                } else if (this.Ptr.is(item)) {
                    // Ptr<T> -> T
                    item = item.component;
                    pointerRemoved = true;
                }
            }
            if (Const.is(item)) {
                // Const<T> -> T
                item = item.component;
            }
            const PtrToRef = (item:tsw.ItemPair):(tsw.ItemPair|null)=> {
                if (opts !== null) {
                    item = item.notNull();
                }
                if (Ref.is(item)) {
                    item = item.component;
                } else if (this.Ptr.is(item)) {
                    item = item.component;
                } else {
                    return null;
                }
                return refCall.wrap(plainingInner(item));
            };
            const plainingInner = (item:tsw.ItemPair):tsw.ItemPair=> {
                if (opts !== null) {
                    item = item.notNull();
                }
                if (this.Wrapper.is(item)) {
                    const ref = PtrToRef(item.component);
                    if (ref !== null) item = this.Wrapper.wrap(ref);
                } else if (this.CxxVectorToArray.is(item)) {
                    const ref = PtrToRef(item.component);
                    if (ref !== null) {
                        item = this.CxxVectorToArray.wrap(ref);
                    }
                }
                if (item instanceof wrapperUtil.WrappedItem) {
                    item = item.changeComponent(plainingInner(item.component));
                }
                return item;
            };
            item = plainingInner(item);

            if (!pointerRemoved) {
                if (opts !== null) {
                    if (this.Wrapper.is(item)) {
                        item = item.component;
                        opts.add(tswNames.structureReturn, tsw.Constant.true);
                    } else if (!raw.isBasicType && !raw.is(PdbId.Enum)) {
                        opts.add(tswNames.structureReturn, tsw.Constant.true);
                    }
                }
            }
        } catch (err) {
            PdbId.printOnProgress(`> Planing ${item.type || item.value} (symbolIndex=${raw.symbolIndex})`);
            throw err;
        }
        return item;
    }

    getOverloadVarId(item:Identifier):tsw.Name {
        if (item.tswVar != null) return item.tswVar;
        if (!item.is(PdbId.Function)) {
            throw Error(`is not function (${item})`);
        }
        const value = this.callDnfMakeOverload();
        return item.tswVar = this.doc.makeVariableForDeclarePhase(value);
    }

    getFunctionVarId(item:Identifier):tsw.Name {
        if (item.tswVar != null) return item.tswVar;
        if (!item.is(PdbId.TemplateFunctionBase) && !item.is(PdbId.FunctionBase)) {
            throw Error(`is not function base (${item})`);
        }
        const value = this.callDnfMake();
        return item.tswVar = this.doc.makeVariableForDeclarePhase(value);
    }

    getAddressVarId(item:Identifier):tsw.Name {
        if (item.tswVar != null) return item.tswVar;
        const value = this.importDllCurrent().call(tswNames.add, [tsw.constVal(item.address)]);
        return item.tswVar = this.doc.makeVariableForDeclarePhase(value);
    }

    callDnfMake():tsw.Call {
        if (this.dnfMakeCall !== null) return this.dnfMakeCall;

        const dnf = this.dnf.importValue();
        const dnfMake = new tsw.Name('$F');
        const assign = new tsw.VariableDef('const', [
            new tsw.VariableDefineItem(dnfMake, null, dnf.member(tswNames.make))
        ]);
        this.doc.decl.doc.unshift(assign);

        return this.dnfMakeCall = dnfMake.call([]);
    }

    callDnfMakeOverload():tsw.Call {
        if (this.dnfOverloadNew !== null) return this.dnfOverloadNew;
        const dnf = this.dnf.importValue();
        const dnfMakeOverload = new tsw.Name('$O');
        const assign = new tsw.VariableDef('const', [new tsw.VariableDefineItem(dnfMakeOverload, null, dnf.member('makeOverload'))]);
        this.doc.decl.doc.unshift(assign);
        return this.dnfOverloadNew = dnfMakeOverload.call([]);
    }

    importDllCurrent():tsw.Value {
        if (this.dllCurrent != null) return this.dllCurrent;
        const dll = this.dll.importValue();
        const dllCurrent = new tsw.Name('$C');
        const assign = new tsw.VariableDef('const', [new tsw.VariableDefineItem(dllCurrent, null, dll.member('current'))]);
        this.doc.decl.doc.unshift(assign);
        return this.dllCurrent = dllCurrent;
    }

    getNativeTypeCtor():tsw.BracketProperty {
        if (this.ctorProperty != null) return this.ctorProperty;
        const NativeType = this.NativeType.importValue();
        return this.ctorProperty = new tsw.BracketProperty(NativeType.member(tswNames.ctor));
    }

    existName(name:string):boolean {
        return super.existName(name) || this.doc.decl.existName(name);
    }

    canAccessGlobalName(name:string):boolean {
        return super.canAccessGlobalName(name) || this.doc.decl.canAccessGlobalName(name);
    }

    parseAll():void {
        try {
            this.doc.decl.parseAll();
        } catch (err) {
            PdbId.printOnProgress(`> Parsing ${this.path}`);
            throw err;
        }
    }

    async save():Promise<void> {
        const head:tsw.BlockItem[] = this.imports.toTsw();
        head.unshift(...[
            `BDS Version: ${installedBdsVersion}`,
            ...StringLineWriter.generateWarningComment('bdsx-dev/pdbparser/symbolwriter.ts')
        ].map(msg=>new tsw.Comment(msg)));

        const minecraftTsReady = new tsw.Name('minecraftTsReady');
        const outPath = path.join(outDir, this.path);
        const dtsOutPath = outPath+'.d.ts';
        const jsOutPath = outPath+'.js';

        console.log(`[symbolwriter.ts] Writing ${this.path}.d.ts`);
        const decl = this.doc.decl.doc.cloneToDecl();
        decl.unshift(
            ...head,
            new tsw.ImportType([], './minecraft_impl'),
            new tsw.TypeDef(Ref.type, minecraft.Ptr.importType().template(tswNames.T), [tswNames.T]),
            new tsw.TypeDef(Const.type, tswNames.T, [tswNames.T]),
        );
        decl.save(dtsOutPath);

        console.log(`[symbolwriter.ts] Writing ${this.path}.js`);
        const impl = this.doc.impl;
        impl.doc.unshift(new tsw.ImportOnly('./minecraft_impl'));
        impl.doc.unshiftBlock(this.doc.decl.doc);
        impl.doc.unshift(...head);
        impl.doc.write(
            new tsw.Import([[minecraftTsReady.toProperty(), minecraftTsReady]], './minecraft_impl/ready'),
            minecraftTsReady.call('resolve', [])
        );

        impl.doc.cloneToJS().save(jsOutPath);
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
const packets:Identifier[] = [];
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
        const packetId = resolvePacketClasses.getId(item);
        if (packetId == null) {
            ids.push(item);
        } else {
            packets.push(item);
        }
    }
}
ids.sort((a,b)=>a.name.localeCompare(b.name));
packets.sort((a,b)=>resolvePacketClasses.getId(a)!-resolvePacketClasses.getId(b)!);
const minecraft = new MinecraftTsFile(ids.concat(packets));
minecraft.callDnfMake();
minecraft.callDnfMakeOverload();
const Const = new wrapperUtil.TypeWrapper('Const');
const Ref = new wrapperUtil.TypeWrapper('Ref');
const refCall = new wrapperUtil.RefWrapper('ref');
const PointerLike = new wrapperUtil.ImportItem(minecraft, imports.nativetype, 'PointerLike');
const StaticPointer = new TsImportItem(minecraft, imports.core, 'StaticPointer');

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
new Definer('typename').js(['Type', imports.nativetype]).paramName('t');
const any_t = new Definer('any').js(tsw.ItemPair.any).paramName('v').item;
const anyArray = new tsw.ArrayType(tsw.BasicType.any);
new Definer(any_t.decorate(DecoSymbol.make('a', '[]'))).js(new tsw.ItemPair(tsw.Constant.null, anyArray)).paramName('args');
new Definer('never').js(tsw.ItemPair.never).paramName('v');
new Definer('gsl::basic_string_span<char const,-1>').js(['GslStringSpan', imports.nativetype]).paramName('str');
new Definer(PdbId.make('...')).js(['NativeVarArgs', imports.complextype]).paramName('...args');
new Definer('gsl::not_null<#KEY0>').templateRedirect((item, templates, opts)=>minecraft.Wrapper.wrap(minecraft.toTsw(templates[0], opts))).paramName('v');
new Definer('std::unique_ptr<#KEY0, std::default_delete<#KEY0>>').templateRedirect((item, templates, opts)=>minecraft.Ptr.wrap(minecraft.toTsw(templates[0], opts)), {exportOriginal: true}).paramName('v');
new Definer('std::shared_ptr<#KEY0>').templateRedirect((item, templates, opts)=>minecraft.SharedPtr.wrap(minecraft.toTsw(templates[0], opts))).paramName('v');
new Definer('AutomaticID<Dimension, int>').js(tsw.NamePair.create('DimensionId')).paramName('dim');
new Definer('Packet').item.isMantleClass = true;
new Definer('CxxStringWrapper').js(['CxxStringWrapper', imports.pointer]).paramName('data');
new Definer('Json::Value').js(['JsonValue', imports.jsonvalue], {exportOriginal: true}).paramName('json');
new Definer('Json::Value::CZString').js(tsw.NamePair.create('Json').member('Value').member('CZString'), {exportOriginal: true});
const StaticPointer_raw = new Definer('StaticPointer').js(StaticPointer).paramName('data').item;

// NetworkHandler::_sendInternal - 3rd parameter, CxxString to CxxStringWrapper
const _sendInternal = PdbId.parse('NetworkHandler::_sendInternal');
if (_sendInternal.is(PdbId.FunctionBase)) {
    _sendInternal.data.overloads[0].data.functionParameters[2] = PdbId.parse('CxxStringWrapper');
}

reduceTemplateTypes();
new Definer('std::vector<#KEY0>').templateRedirect((item, templates, opts)=>minecraft.CxxVectorToArray.wrap(minecraft.toTsw(templates[0], opts))).paramName('array');

minecraft.parseAll();

// set packet Ids
const packetClasses:[tsw.NumberProperty, tsw.Value][] = [];
const packetTypes:tsw.ClassField[] = [];
for (const packet of resolvePacketClasses.list.sort((a,b)=>a.packetId!-b.packetId!)) {
    const cls = minecraft.doc.decl.doc.getValue(packet.name);
    if (cls == null) {
        console.error(`[symbolwriter.ts] Packet not found: ${packet.name}`);
        continue;
    }
    if (!(cls instanceof tsw.Class)) {
        console.error(`[symbolwriter.ts] Packet is not class: ${packet.name}`);
        continue;
    }
    const packetId = new tsw.Constant(packet.packetId!);
    cls.unshift(new tsw.ClassField(null, true, true, tswNames.ID, new tsw.TypeName(packet.packetId+''), packetId));
    const packetIdProp = new tsw.NumberProperty(packet.packetId!);
    packetClasses.push([packetIdProp, cls.name]);
    packetTypes.push(new tsw.ClassField(null, false, false, packetIdProp, new tsw.TypeOf(cls.name)));
}
const packetClass = minecraft.doc.decl.doc.getValue('Packet') as tsw.Class;
packetClass.unshift(new tsw.ClassField(null, true, true, tswNames.idMap, new tsw.ObjectType(packetTypes)));
minecraft.doc.impl.doc.assign(packetClass.name.member(tswNames.idMap), new tsw.ObjectDef(packetClasses));

(async()=>{
    await minecraft.save();
    console.log(`[symbolwriter.ts] done`);
})().catch(remapAndPrintError);
