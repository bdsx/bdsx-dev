import { events } from ".";
import { CANCEL } from "../../common";
import { hook } from "../../hook";
import { Actor, BlockSource, Level, Vec3 } from "../../minecraft";
import { bool_t, float32_t, int32_t } from "../../nativetype";
import { _tickCallback } from "../../util";
import { EntityEvent } from "./entityevent";

export class LevelExplodeEvent extends EntityEvent {
    constructor(
        actor: Actor,
        public position: Vec3,
        /** The radius of the explosion in blocks and the amount of damage the explosion deals. */
        public power: number,
        /** If true, blocks in the explosion radius will be set on fire. */
        public causesFire: boolean,
        /** If true, the explosion will destroy blocks in the explosion radius. */
        public breaksBlocks: boolean,
        /** A blocks explosion resistance will be capped at this value when an explosion occurs. */
        public maxResistance: number,
        public allowUnderwater: boolean,

        private level: Level,
        private blockSource: BlockSource,
    ) {
        super(actor);
    }

    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    getRawLevel():Level {
        return this.level;
    }
    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    getRawBlockSource():BlockSource {
        return this.blockSource;
    }
}

export class LevelSaveEvent {
    constructor(
        private level: Level,
    ) {
    }
}

export class LevelTickEvent {
    constructor(
        private level: Level,
    ) {
    }
}

export class LevelWeatherChangeEvent {
    constructor(
        public rainLevel: number,
        public rainTime: number,
        public lightningLevel: number,
        public lightningTime: number,

        private level: Level,
    ) {
    }
}

events.levelExplode.setInstaller(()=>{
    function onLevelExplode(this:Level, blockSource:BlockSource, entity:Actor, position:Vec3, power:float32_t, causesFire:bool_t, breaksBlocks:bool_t, maxResistance:float32_t, allowUnderwater:bool_t):void {
        const event = new LevelExplodeEvent(
            entity, position, power, causesFire, breaksBlocks, maxResistance, allowUnderwater,
            this, blockSource);
        const canceled = events.levelExplode.fire(event) === CANCEL;
        _tickCallback();
        if (!canceled) {
            return _onLevelExplode.call(
                event.entity, event.position, event.power, event.causesFire, event.breaksBlocks, event.maxResistance, event.allowUnderwater,
                this, blockSource);
        }
    }
    const _onLevelExplode = hook(Level, 'explode', BlockSource, Actor, Vec3, float32_t, bool_t, bool_t, float32_t, bool_t).call(onLevelExplode);
});

events.levelSave.setInstaller(()=>{
    function onLevelSave(this:Level):void {
        const event = new LevelSaveEvent(this);
        const canceled = events.levelSave.fire(event) === CANCEL;
        _tickCallback();
        if (!canceled) {
            return _onLevelSave.call(this);
        }
    }
    const _onLevelSave = hook(Level, 'save').call(onLevelSave);
});

events.levelTick.setInstaller(()=>{
    function onLevelTick(this:Level):void {
        const event = new LevelTickEvent(this);
        events.levelTick.fire(event);
        _onLevelTick.call(this);
    }
    const _onLevelTick = hook(Level, 'tick').call(onLevelTick);
});

events.levelWeatherChange.setInstaller(()=>{
    function onLevelWeatherChange(this:Level, rainLevel:float32_t, rainTime:int32_t, lightningLevel:float32_t, lightningTime:int32_t):void {
        const event = new LevelWeatherChangeEvent(
            rainLevel, rainTime, lightningLevel, lightningTime,
            this);
        const canceled = events.levelWeatherChange.fire(event) === CANCEL;
        _tickCallback();
        if (!canceled) {
            return _onLevelWeatherChange.call(
                event.rainLevel, event.rainTime, event.lightningLevel, event.lightningTime,
                this);
        }
    }
    const _onLevelWeatherChange = hook(Level, 'updateWeather').call(onLevelWeatherChange);
});
