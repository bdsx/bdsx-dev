import asmcode = require("../asm/asmcode");
import { StaticPointer, VoidPointer } from "../core";
import { MobEffectIds } from "../enums";
import { hook } from "../hook";
import { makefunc } from "../makefunc";
import { Actor, ItemActor, Level, ServerPlayer } from "../minecraft";
import { CxxString, NativeType, void_t } from "../nativetype";
import { minecraftTsReady } from "./ready";

type EntityStringId = EntityId;

declare module "../minecraft" {
    interface Actor {
        vftable:VoidPointer;
        identifier:EntityStringId;
        removeEffect(id: MobEffectIds):void;
    }

    namespace Actor {
        function all():IterableIterator<Actor>;
        function registerType(type:{new():Actor, __vftable:VoidPointer}):void;
    }
}

Actor.abstract({
    vftable: VoidPointer,
    identifier: [CxxString as NativeType<EntityId>, 0x458], // minecraft:player
});

const actorMap = new Map<string, Actor>();
const typeMap = new Map<string, new()=>Actor>();


Actor.registerType = function(type:{new():Actor, __vftable:VoidPointer}):void {
    typeMap.set(type.__vftable.getAddressBin(), type);
};

Actor.registerType(ServerPlayer);
Actor.registerType(ItemActor);

function _singletoning(ptr:StaticPointer|null):Actor|null {
    if (ptr === null) return null;
    const binptr = ptr.getAddressBin();
    let actor = actorMap.get(binptr);
    if (actor == null) {
        const vftable = ptr.getBin64();
        actor = ptr.as(typeMap.get(vftable) || Actor);
        actorMap.set(vftable, actor);
    }
    return actor;
}

Actor.all = function():IterableIterator<Actor> {
    return actorMap.values();
};

Actor[NativeType.getter] = function(ptr:StaticPointer, offset?:number):Actor {
    return _singletoning(ptr.add(offset, offset! >> 31))!;
};
Actor[makefunc.getFromParam] = function(stackptr:StaticPointer, offset?:number):Actor|null {
    return _singletoning(stackptr.getNullablePointer(offset));
};

function _removeActor(actor:Actor):void {
    actorMap.delete(actor.getAddressBin());
}

minecraftTsReady.promise.then(()=>{
    const Level$removeEntityReferences = hook(Level, 'removeEntityReferences').call(function(actor, b){
        _removeActor(actor);
        return Level$removeEntityReferences.call(this, actor, b);
    });

    asmcode.removeActor = makefunc.np(_removeActor, void_t, null, Actor);
    hook(Actor, NativeType.dtor).raw(asmcode.actorDestructorHook, {callOriginal: true});
});
