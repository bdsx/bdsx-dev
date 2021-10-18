
import { CommandCheatFlag, CommandUsageFlag } from "../bds/command";
import { bin } from "../bin";
import { capi } from "../capi";
import { StaticPointer } from "../core";
import { DimensionId } from "../enums";
import { JsonValue } from "../jsonvalue";
import { makefunc } from "../makefunc";
import { mcglobal } from "../mcglobal";
import { Actor, BlockPos, Command, CommandContext, CommandFlag, CommandOrigin, CommandOutput, CommandParameterData, CommandPermissionLevel, CommandRawText, CommandRegistry, CommandVersion, Dimension, MCRESULT, RelativeFloat as RelativeFloatType, ServerCommandOrigin, ServerLevel, std, Vec3, WildcardCommandSelector } from "../minecraft";
import { nativeClass, NativeClassType, nativeField } from "../nativeclass";
import { bool_t, CxxString, int32_t, NativeType, Type, void_t } from "../nativetype";
import { SharedPtr } from "../sharedpointer";
import { Entity } from "./entity";
import { events } from "./events";

const commandVersion = CommandVersion.CurrentVersion;
const commandContextRefCounterVftable = std._Ref_count_obj2.make(CommandContext).__vftable;
const CommandContextSharedPtr = SharedPtr.make(CommandContext);

function createServerCommandOrigin(name:CxxString, level:ServerLevel, permissionLevel:number, dimension:DimensionId):CommandOrigin {
    const origin = capi.malloc(ServerCommandOrigin[NativeType.size]).as(ServerCommandOrigin);
    origin.constructWith(name, level, permissionLevel, dimension);
    return origin;
}
function createCommandContext(command:CxxString, origin:CommandOrigin):SharedPtr<CommandContext> {
    const sharedptr = new CommandContextSharedPtr(true);
    sharedptr.create(commandContextRefCounterVftable);
    sharedptr.p!.constructWith(command, origin, commandVersion);
    return sharedptr;
}

@nativeClass()
class CustomCommand extends Command {
    @nativeField(Command.VFTable)
    self_vftable:Command.VFTable;

    [NativeType.ctor]():void {
        this.self_vftable.destructor = customCommandDtor;
        this.self_vftable.execute = null;
        this.vftable = this.self_vftable;
    }

    execute(origin:CommandOrigin, output:CommandOutput):void {
        // empty
    }
}
const customCommandDtor = makefunc.np(function(){
    this[NativeType.dtor]();
}, void_t, {this:CustomCommand}, int32_t);

function registerOverloadClass(name:string, commandClass:new()=>Command, params:CommandParameterData[]):void {
    const cls = commandClass as NativeClassType<Command>;
    const size = cls[NativeType.size];
    if (!size) throw Error(`${cls.name}: size is not defined`);
    const allocator = makefunc.np((returnval:StaticPointer)=>{
        const ptr = capi.malloc(size);
        const cmd = ptr.as(cls);
        cmd.construct();

        returnval.setPointer(cmd);
        return returnval;
    }, StaticPointer, null, StaticPointer);

    const sig = mcglobal.commandRegistry.findCommand(name);
    if (sig === null) throw Error(`${name}: command not found`);

    const overload = CommandRegistry.Overload.construct();
    overload.commandVersion = bin.make64(1, 0x7fffffff);
    overload.allocator = allocator;
    overload.parameters.setFromArray(params);
    overload.commandVersionOffset = -1;
    sig.overloads.push(overload);
    mcglobal.commandRegistry.registerOverloadInternal(sig, sig.overloads.back()!);
    overload.destruct();
}


interface ParamInfo {
    type: command.Param<unknown>;
    name: string;
    optkey?: string;
}

class ParamsBuilder {
    public readonly fields:Record<string, Type<any>> = Object.create(null);
    public readonly paramInfos:ParamInfo[] = [];

}

export namespace command {
    export abstract class Param<T> {
        optional():Param<T|undefined> {
            return new OptionalParam(this);
        }

        /** @internal */
        abstract convert(out:Record<string, unknown>, native:Record<string, any>, info:ParamInfo, origin:CommandOrigin):void;
        /** @internal */
        abstract build(name:string, target:ParamsBuilder):ParamInfo;
    }

    abstract class ParamBase<F, T> extends Param<T> {
        constructor(protected readonly baseType:Type<F>) {
            super();
        }
        build(name:string, target:ParamsBuilder):ParamInfo {
            if (name in target.fields) throw Error(`${name}: field name duplicated`);

            target.fields[name] = this.baseType;
            const out:ParamInfo = { name } as ParamInfo;
            target.paramInfos.push(out);
            return out;
        }
    }

    class ParamDirect<T> extends ParamBase<T, T> {
        convert(out:Record<string, unknown>, native:Record<string, unknown>, info:ParamInfo, origin:CommandOrigin):void {
            const name = info.name;
            out[name] = native[name] as T;
        }
    }

    class ParamConverter<F, T> extends ParamBase<F, T> {
        constructor(
            baseType:Type<F>,
            private readonly converter:(value:F, origin:CommandOrigin)=>T) {
            super(baseType);
        }
        convert(out:Record<string, unknown>, native:Record<string, unknown>, info:ParamInfo, origin:CommandOrigin):void {
            const name = info.name;
            out[name] = this.converter(native[name] as F, origin);
        }
    }

    abstract class ExtendedParam<T> extends Param<T> {
        constructor(public readonly base:Param<T>) {
            super();
        }

        optional():Param<T> {
            return this;
        }
    }

    class OptionalParam<T> extends ExtendedParam<T|undefined> {
        build(name:string, target:ParamsBuilder):ParamInfo {
            const info = this.base.build(name, target);
            const optkey = name+'__set';
            if (optkey in target.fields) throw Error(`${optkey}: field name duplicated`);
            target.fields[optkey] = bool_t;
            info.optkey = optkey;
            return info;
        }
        convert(out:Record<string, unknown>, native:Record<string, unknown>, info:ParamInfo, origin:CommandOrigin):void {
            const optkey = info.optkey;
            if (optkey == null || native[optkey]) {
                this.base.convert(out, native, info, origin);
            }
        }
    }

    export class Origin {
        private _pos:Vec3|null = null;
        private _blockPos:BlockPos|null = null;
        private _entity:Entity|null = null;

        constructor(
            private readonly origin:CommandOrigin) {
        }

        /**
         * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
         */
        getRawOrigin():CommandOrigin {
            return this.origin;
        }

        get isServerOrigin():boolean {
            return this.origin.isServerCommandOrigin();
        }

        get isScriptOrigin():boolean {
            return this.origin.isScriptCommandOrigin();
        }

        get entity():Entity|null {
            if (this._entity !== null) return this._entity;
            const actor = this.origin.getEntity();
            if (actor === null) return null;
            return Entity.fromRaw(actor);
        }

        get position():Vec3 {
            if (this._pos !== null) return this._pos;
            return this._pos = this.origin.getWorldPosition();
        }
        get blockPosition():BlockPos {
            if (this._blockPos !== null) return this._blockPos;
            return this._blockPos = this.origin.getBlockPosition();
        }
    }

    export const Boolean:Param<boolean> = new ParamDirect(bool_t);
    export const Integer:Param<number> = new ParamDirect(int32_t);
    export const String:Param<string> = new ParamDirect(CxxString);
    export const RawText:Param<string> = new ParamConverter(CommandRawText, value=>value.getText());
    export const RelativeFloat:Param<RelativeFloatType> = new ParamDirect(RelativeFloatType);
    export const EntityWildcard:Param<Entity[]> = new ParamConverter(WildcardCommandSelector.make(Actor), (selector, origin)=>selector.newResults(origin));
    export const Json:Param<any> = new ParamDirect(JsonValue);

    export class Factory {
        constructor(
            public readonly name:string) {
        }

        overload<PARAMS extends Record<string, Param<any>>>(
            callback:(params:{[key in keyof PARAMS]:PARAMS[key] extends Param<infer T> ? T : never}, origin:CommandOrigin, output:CommandOutput)=>void,
            parameters:PARAMS):this {

            const builder = new ParamsBuilder;
            const paramInfos = builder.paramInfos;

            class CustomCommandImpl extends CustomCommand {
                [NativeType.ctor]():void {
                    this.self_vftable.execute = customCommandExecute;
                }
                execute(origin:CommandOrigin, output:CommandOutput):void {
                    try {
                        const out:Record<string, any> = {};
                        for (const info of paramInfos) {
                            info.type.convert(out, this, info, origin);
                        }
                        callback(out as any, origin, output);
                    } catch (err) {
                        events.errorFire(err);
                    }
                }
            }

            (parameters as any).__proto__ = null;
            for (const name in parameters) {
                const type:Param<unknown> = parameters[name];
                type.build(name, builder);
            }

            const params:CommandParameterData[] = [];
            CustomCommandImpl.define(builder.fields);
            for (const {name, optkey} of builder.paramInfos) {
                if (optkey != null) params.push(CustomCommandImpl.optional(name as any, optkey as any));
                else params.push(CustomCommandImpl.mandatory(name as any, null));
            }

            const customCommandExecute = makefunc.np(function(this:CustomCommandImpl, origin:CommandOrigin, output:CommandOutput){
                this.execute(origin, output);
            }, void_t, {this:CustomCommandImpl}, CommandOrigin, CommandOutput);

            registerOverloadClass(this.name, CustomCommandImpl, params);

            for (const param of params) {
                param.destruct();
            }
            return this;
        }

        alias(alias:string):this {
            mcglobal.commandRegistry.registerAlias(this.name, alias);
            return this;
        }
    }

    export function register(name:string, description:string, perm:CommandPermissionLevel = CommandPermissionLevel.Normal):Factory {
        const registry = mcglobal.commandRegistry;
        const cmd = registry.findCommand(name);
        if (cmd !== null) throw Error(`${name}: command already registered`);

        registry.registerCommand(name, description, perm,
            CommandFlag.create(CommandCheatFlag.NotCheat),
            CommandFlag.create(CommandUsageFlag._Unknown));
        return new Factory(name);
    }

    /**
     * it does the same thing with bedrockServer.executeCommandOnConsole
     * but call the internal function directly
     */
    export function execute(command:string, dimension:Dimension|null = null):MCRESULT {
        const origin = createServerCommandOrigin('Server',
            mcglobal.level, // I'm not sure it's always ServerLevel
            4,
            dimension as any);

        const ctx = createCommandContext(command, origin);
        const res = mcglobal.commands.executeCommand(ctx, true);

        ctx.destruct();
        origin.destruct();

        return res;
    }

    /**
     * resend the command list packet to clients
     */
    export function update():void {
        const serialized = mcglobal.commandRegistry.serializeAvailableCommands();
        for (const player of mcglobal.level.players) {
            player.sendNetworkPacket(serialized);
        }
    }
}
