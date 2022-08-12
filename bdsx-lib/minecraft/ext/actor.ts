
import { StaticPointer, VoidPointer } from "../../core";
import { MobEffectIds } from "../../enums";
import { makefunc } from "../../makefunc";
import { CxxString, NativeType } from "../../nativetype";
import { Actor, ServerPlayer, ItemActor } from "..";
import { minecraftTsReady } from "../ext_ready";

type EntityStringId = EntityId;

declare module ".." {
    interface Actor {
        vftable:VoidPointer;
        identifier:EntityStringId;
        removeEffect(id: MobEffectIds):void;
    }

    namespace Actor {
        function all():IterableIterator<Actor>;
        function registerType(type:{new():Actor, vftable:VoidPointer}):void;
    }
}

Actor.abstract({
    vftable: VoidPointer,
    identifier: [CxxString as NativeType<EntityId>, 0x458], // minecraft:player
});

const actorMap = new Map<string, Actor>();
const typeMap = new Map<string, new()=>Actor>();


Actor.registerType = function(type:{new():Actor, name:string, vftable:VoidPointer}):void {
    if (type.vftable == null) throw Error(`${type.name} does not have vftable`);
    typeMap.set(type.vftable.getAddressBin(), type);
};

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

/** @internal */
export function removeActorReference(actor:Actor):void {
    actorMap.delete(actor.getAddressBin());
}

minecraftTsReady(()=>{
    Actor.registerType(ServerPlayer);
    Actor.registerType(ItemActor);
});
