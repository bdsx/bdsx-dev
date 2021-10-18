import { events } from ".";
import { CANCEL } from "../../common";
import { VoidPointer } from "../../core";
import { hook } from "../../hook";
import { Actor, ActorDamageSource, EventResult, HealthAttributeDelegate, Mob, ProjectileComponent, ScriptServerActorEventListener, SplashPotionEffectSubcomponent } from "../../minecraft";
import { _tickCallback } from "../../util";
import { Entity } from "../entity";

export class EntityEvent {
    entity:Entity;

    private _entity:Entity|null = null;

    constructor(private readonly _actor:Actor) {
    }

    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    getRawEntity():Actor {
        return this._entity !== null ? this._entity.getRawEntity()! : this._actor;
    }

    static defineEntityGetter(target:unknown, entityKey:string, internalEntityKey:string, internalActorKey:string):void {
        Object.defineProperty(target, entityKey, {
            get(this:any):Entity{
                let entity = this[internalEntityKey];
                if (entity !== null) return entity;
                entity = Entity.fromRaw(this[internalActorKey]);
                if (entity === null) throw Error(`failed to get the Entity of ${this[internalActorKey]}`);
                return this[internalEntityKey] = entity;
            },
            set(this:any, entity:Entity):void {
                if (entity.getRawEntity() === null) throw Error(`${entity.name} does not have the entity`);
                this[internalEntityKey] = entity;
            }
        });
    }
}
EntityEvent.defineEntityGetter(EntityEvent.prototype, 'entity', '_entity', '_actor');

export class EntityHurtEvent extends EntityEvent {
    constructor(
        actor: Actor,
        public damage: number,
        public knock: boolean,
        public ignite: boolean,

        private damageSource: ActorDamageSource,
    ) {
        super(actor);
    }

    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    getRawActorDamageSource():ActorDamageSource {
        return this.damageSource;
    }
}

export class EntityHeathChangeEvent extends EntityEvent {
    constructor(
        actor: Actor,
        readonly oldHealth: number,
        readonly newHealth: number,
    ) {
        super(actor);
    }
}

export class EntityDieEvent extends EntityEvent {
    constructor(
        actor: Actor,
        private damageSource: ActorDamageSource,
    ) {
        super(actor);
    }

    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    getRawActorDamageSource():ActorDamageSource {
        return this.damageSource;
    }
}

export class EntityStartRidingEvent extends EntityEvent {
    public ride: Entity;
    private _rideEntity:Entity|null = null;

    constructor(
        actor: Actor,
        private readonly _rideActor: Actor,
    ) {
        super(actor);
    }

    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    getRawRideEntity():Actor {
        return this._rideEntity !== null ? this._rideEntity.getRawEntity()! : this._rideActor;
    }

}
EntityStartRidingEvent.defineEntityGetter(EntityStartRidingEvent.prototype, 'ride', '_rideEntity', '_rideActor');

export class EntityStopRidingEvent extends EntityEvent {
    constructor(
        actor: Actor,
        public exitFromRider: boolean,
        public actorIsBeingDestroyed: boolean,
        public switchingRides: boolean,
    ) {
        super(actor);
    }
}

export class EntitySneakEvent extends EntityEvent {
    constructor(
        actor: Actor,
        public isSneaking: boolean,
    ) {
        super(actor);
    }
}

export class SplashPotionHitEvent extends EntityEvent{
    constructor(
        entity: Actor,
        public potionEffect: number,
    ) {
        super(entity);
    }
}

events.entityHurt.setInstaller(()=>{
    function onEntityHurt(this: Actor, actorDamageSource: ActorDamageSource, damage: number, knock: boolean, ignite: boolean):boolean {
        const event = new EntityHurtEvent(
            this, damage, knock, ignite,
            actorDamageSource);
        const canceled = events.entityHurt.fire(event) === CANCEL;
        _tickCallback();
        if (canceled) {
            return false;
        }
        return _onEntityHurt.call(event.getRawEntity(), event.getRawActorDamageSource(), event.damage, knock, ignite);
    }
    const _onEntityHurt = hook(Actor, 'hurt').call(onEntityHurt);
});

events.entityHealthChange.setInstaller(()=>{
    function onEntityHealthChange(this: HealthAttributeDelegate, oldHealth:number, newHealth:number, attributeBuffInfo:VoidPointer):boolean {
        const event = new EntityHeathChangeEvent(this.actor, oldHealth, newHealth);
        events.entityHealthChange.fire(event);
        this.actor = event.getRawEntity();
        _tickCallback();
        return _onEntityHealthChange.call(this, oldHealth, newHealth, attributeBuffInfo);
    }
    const _onEntityHealthChange = hook(HealthAttributeDelegate, 'change').call(onEntityHealthChange);
});

events.entityDie.setInstaller(()=>{
    function onEntityDie(this:Mob, damageSource:ActorDamageSource):boolean {
        const event = new EntityDieEvent(this, damageSource);
        events.entityDie.fire(event);
        _tickCallback();
        return _onEntityDie.call(event.getRawEntity(), event.getRawActorDamageSource());
    }
    const _onEntityDie = hook(Mob, 'die').call(onEntityDie);
});

events.entityStartRiding.setInstaller(()=>{
    function onEntityStartRiding(this:Actor, ride:Actor):boolean {
        const event = new EntityStartRidingEvent(this, ride);
        const canceled = events.entityStartRiding.fire(event) === CANCEL;
        _tickCallback();
        if (canceled) {
            return false;
        }
        return _onEntityStartRiding.call(event.entity, event.ride);
    }
    const _onEntityStartRiding = hook(Actor, 'startRiding').call(onEntityStartRiding);
});

events.entityStopRiding.setInstaller(()=>{
    function onEntityStopRiding(this:Actor, exitFromRider:boolean, actorIsBeingDestroyed:boolean, switchingRides:boolean):void {
        const event = new EntityStopRidingEvent(this, exitFromRider, actorIsBeingDestroyed, switchingRides);
        const notCanceled = events.entityStopRiding.fire(event) !== CANCEL;
        _tickCallback();
        if (notCanceled) {
            return _onEntityStopRiding.call(event.entity, event.exitFromRider, event.actorIsBeingDestroyed, event.switchingRides);
        }
    }
    const _onEntityStopRiding = hook(Actor, 'stopRiding').call(onEntityStopRiding);
});

events.entitySneak.setInstaller(()=>{
    function onEntitySneak(this:ScriptServerActorEventListener, entity:Actor, isSneaking:boolean):EventResult {
        const event = new EntitySneakEvent(entity, isSneaking);
        events.entitySneak.fire(event);
        _tickCallback();
        return _onEntitySneak.call(this, event.entity, event.isSneaking);
    }
    const _onEntitySneak = hook(ScriptServerActorEventListener, 'onActorSneakChanged').call(onEntitySneak);
});

events.splashPotionHit.setInstaller(()=>{
    function onSplashPotionHit(this: SplashPotionEffectSubcomponent, entity: Actor, projectileComponent: ProjectileComponent):void {
        const event = new SplashPotionHitEvent(entity, this.potionEffect);
        const canceled = events.splashPotionHit.fire(event) === CANCEL;
        _tickCallback();
        if (!canceled) {
            this.potionEffect = event.potionEffect;
            return _onSplashPotionHit.call(this, event.entity, projectileComponent);
        }
    }
    const _onSplashPotionHit = hook(SplashPotionEffectSubcomponent, 'doOnHitEffect').call(onSplashPotionHit);
});
