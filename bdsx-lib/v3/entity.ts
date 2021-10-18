import { AttributeId, DimensionId, MobEffectIds } from "../enums";
import { hook } from "../hook";
import { mcglobal } from "../mcglobal";
import { Actor, ActorUniqueID, AttributeInstance, EventResult, MobEffect, MobEffectInstance, RelativeFloat, ScriptServerActorEventListener, TeleportCommand, Vec3 } from "../minecraft";
import { bin64_t } from "../nativetype";
import { _tickCallback } from "../util";
import { events } from "./events";
import colors = require('colors');

const entityKey = Symbol('entity');
const entityMapper = Symbol('entityMapper');

interface OptionalAttributeValues {
    current?:number;
    min?:number;
    max?:number;
    default?:number;
}
interface AttributeValues {
    current:number;
    min:number;
    max:number;
    default:number;
}

const ATTRIBUTE_ID_MIN = AttributeId.ZombieSpawnReinforcementsChange;
const ATTRIBUTE_ID_MAX = AttributeId.JumpStrength;

export class Entity {
    public entity:IEntity|null = null;

    constructor(protected actor:ActorX|null) {
    }

    protected actorMust():Actor {
        if (this.actor === null) throw Error(`${this}'s actor is not ready`);
        return this.actor;
    }

    get name():string {
        if (this.actor === null) return 'unknown';
        return this.actorMust().getNameTag();
    }
    get identifier():string {
        return this.actor!.identifier;
    }
    get dimensionId():DimensionId {
        return this.actorMust().getDimensionId();
    }


    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    getRawEntity():ActorX|null {
        return this.actor;
    }

    // Actor.prototype.isItem = function() {
    //     return this instanceof Item;
    // };

    getPosition():Vec3 {
        return this.actorMust().getPos();
    }

    getUniqueID():ActorUniqueID {
        return this.actorMust().getUniqueID();
    }
    getUniqueIdBin():bin64_t {
        return this.actorMust().getUniqueID().value;
    }

    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    getAttributeInstance(id:AttributeId):AttributeInstance {
        if (id < ATTRIBUTE_ID_MIN || id > ATTRIBUTE_ID_MAX) throw Error(`AttributeId ${id}, Out of range`);
        const instance = this.actorMust().getAttributes().getMutableInstance(id);
        if (instance === null) throw Error(`${this} has not ${AttributeId[id]} attribute`);
        return instance;
    }

    getAttributeValues(id:AttributeId):AttributeValues {
        const attr = this.getAttributeInstance(id);
        return {
            current:attr.currentValue,
            min:attr.minValue,
            max:attr.maxValue,
            default:attr.defaultValue,
        };
    }

    getAttribute(id:AttributeId):number {
        const attr = this.getAttributeInstance(id);
        return attr.currentValue;
    }

    setAttribute(id:AttributeId, value:number|OptionalAttributeValues):boolean {
        const attr = this.getAttributeInstance(id);
        if (typeof value === 'number') {
            attr.currentValue = value;
        } else {
            const {current, min, max, default:defaultv} = value;
            if (current != null) attr.currentValue = current;
            if (min != null) attr.minValue = min;
            if (max != null) attr.maxValue = max;
            if (defaultv != null) attr.defaultValue = defaultv;
        }
        return true;
    }

    teleport(pos:Vec3, dimensionId:DimensionId=DimensionId.Overworld):void {
        const actor = this.actorMust();
        const cmd = TeleportCommand.computeTarget(actor, pos, new Vec3(true), dimensionId, RelativeFloat.create(0, false), RelativeFloat.create(0, false), 0);
        TeleportCommand.applyTarget(actor, cmd);
    }

    addEffect(id:MobEffectIds, duration:number, amplifier:number = 0):void {
        const mob = new MobEffectInstance(true);
        mob.constructWith(id, duration, amplifier);
    }

    hasEffect(id:MobEffectIds):boolean {
        const effect = MobEffect.create(id);
        const retval = this.actorMust().hasEffect(effect);
        effect.destruct();
        return retval;
    }

    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    getEffect(id:MobEffectIds):MobEffectInstance|null {
        const effect = MobEffect.create(id);
        const retval = this.actorMust().getEffect(effect);
        effect.destruct();
        return retval;
    }

    static registerMapper<T extends Actor>(rawClass:new(...args:any[])=>T, mapper:(actor:T)=>(Entity|null)):void {
        rawClass.prototype[entityMapper] = mapper;
    }
    static fromUniqueId(lowBits:string|number, highBits:number):Entity;
    static fromUniqueId(bin:string):Entity;

    static fromUniqueId(lowBitsOrBin:string|number, highBits?:number):Entity|null {
        const id = ActorUniqueID.create(lowBitsOrBin as number, highBits!);
        const actor = mcglobal.level.fetchEntity(id, true);
        if (actor === null) return null;
        return Entity.fromRaw(actor);
    }
    static fromRaw(actor:Actor):Entity|null {
        const actorx:ActorX = actor;
        let entity:Entity|null|undefined = actorx[entityKey];
        if (entity != null) return entity;
        entity = actorx[entityMapper]!();
        if (entity === null) {
            console.error(colors.red(`failed to get the Entity of [${actorx.constructor.name}:${actorx}]`));
            return null;
        }
        return actorx[entityKey] = entity;
    }

    /**
     * from the scripting API entity.
     */
    static fromEntity(entity:IEntity):Entity|null {
        const u = entity.__unique_id__;
        return Entity.fromUniqueId(u["64bit_low"], u["64bit_high"]);
    }

    toString():string {
        if (this.actor !== null) {
            return this.actor.getNameTag();
        } else {
            return `[unknown ${this.constructor.name}]`;
        }
    }
}

Entity.registerMapper(Actor, actor=>new Entity(actor));

interface ActorX extends Actor {
    [entityKey]?:Entity;
    [entityMapper]?():Entity|null;
}

export class EntityCreatedEvent {
    constructor(
        public entity: Entity
    ) {
    }
}

function onEntityCreated(this:ScriptServerActorEventListener, actor:ActorX):EventResult {
    const entity = Entity.fromRaw(actor);
    if (entity === null) {
        return _onEntityCreated.call(this, actor);
    }
    const event = new EntityCreatedEvent(entity);
    events.entityCreated.fire(event);
    _tickCallback();
    return _onEntityCreated.call(this, event.entity.getRawEntity());
}
const _onEntityCreated = hook(ScriptServerActorEventListener, 'onActorCreated').call(onEntityCreated);
