import { events } from ".";
import { CANCEL } from "../../common";
import { PistonAction } from "../../enums";
import { hook } from "../../hook";
import { Actor, Block as BlockRaw, BlockPos, BlockSource, CampfireBlock, FarmBlock, GameMode, PistonBlockActor, SurvivalMode } from "../../minecraft";
import { bool_t, float32_t, void_t } from "../../nativetype";
import { _tickCallback } from "../../util";
import { Block } from "../block";
import { Entity } from "../entity";
import { Player } from "../player";
import { PlayerEvent } from "./playerevent";


export class BlockDestroyEvent extends PlayerEvent {
    constructor(
        player: Player,
        public blockPos: BlockPos,
    ) {
        super(player);
    }
}

export class BlockEvent {
    constructor(
        public blockPos: BlockPos,
        private blockSource: BlockSource) {
    }

    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    getRawBlockSource():BlockSource {
        return this.blockSource;
    }
}

export class BlockPlaceEvent extends BlockEvent {
    constructor(
        public player: Player,
        blockPos: BlockPos,

        private rawBlock: BlockRaw,
        blockSource: BlockSource,
    ) {
        super(blockPos, blockSource);
    }

    get block():Block {
        const block = new Block(this.rawBlock);
        Object.defineProperty(this, 'block', {value:block});
        return block;
    }
}

events.blockDestroy.setInstaller(()=>{
    function onBlockDestroy(this:SurvivalMode, blockPos:BlockPos, facing:number):boolean {
        const user = Player.fromRaw(this.actor);
        if (user === null) {
            return _onBlockDestroy.call(this, blockPos, facing);
        }
        const event = new BlockDestroyEvent(user, blockPos);
        if (events.blockDestroy.fire(event) === CANCEL) {
            _tickCallback();
            return false;
        }
        this.actor = event.player.getRawEntity()!;
        _tickCallback();
        return _onBlockDestroy.call(this, event.blockPos, facing);
    }
    function onBlockDestroyCreative(this:GameMode, blockPos:BlockPos, facing:number):boolean {
        const user = Player.fromRaw(this.actor);
        if (user === null) {
            return _onBlockDestroyCreative.call(this, blockPos, facing);
        }
        const event = new BlockDestroyEvent(user, blockPos);
        if (events.blockDestroy.fire(event) === CANCEL) {
            _tickCallback();
            return false;
        }
        this.actor = event.player.getRawEntity()!;
        _tickCallback();
        return _onBlockDestroyCreative.call(this, event.blockPos, facing);
    }

    const _onBlockDestroy = hook(SurvivalMode, 'destroyBlock').call(onBlockDestroy);
    const _onBlockDestroyCreative = hook(GameMode, '_creativeDestroyBlock').call(onBlockDestroyCreative);
});

events.blockPlace.setInstaller(()=>{
    function onBlockPlace(this:BlockSource, block:BlockRaw, blockPos:BlockPos, facing:number, actor:Actor, ignoreEntities:boolean):boolean {
        const user = Player.fromRaw(actor);
        if (user === null) {
            return _onBlockPlace.call(this, block, blockPos, facing, actor, ignoreEntities);
        }
        const event = new BlockPlaceEvent(user, blockPos, block, this);
        if (events.blockPlace.fire(event) === CANCEL) {
            _tickCallback();
            return false;
        }
        _tickCallback();
        return _onBlockPlace.call(this, event.block, event.blockPos, facing, event.player.getRawEntity(), ignoreEntities);
    }
    const _onBlockPlace = hook(BlockSource, 'mayPlace').call(onBlockPlace);
});

export class PistonMoveEvent extends BlockEvent {
    constructor(
        blockPos: BlockPos,
        public readonly action: PistonAction,

        blockSource: BlockSource,
    ) {
        super(blockPos, blockSource);
    }
}

events.pistonMove.setInstaller(()=>{
    function onPistonMove(this:PistonBlockActor, blockSource:BlockSource):void_t {
        const event = new PistonMoveEvent(
            BlockPos.create(this.getInt32(0x2C), this.getUint32(0x30), this.getInt32(0x34)),
            this.getInt8(0xE0),
            blockSource);
        events.pistonMove.fire(event);
        _tickCallback();
        return _onPistonMove.call(this, event.getRawBlockSource());
    }
    const _onPistonMove = hook(PistonBlockActor, '_spawnMovingBlocks').call(onPistonMove);
});

export class FarmlandDecayEvent extends BlockEvent {
    constructor(
        blockPos: BlockPos,
        public culprit: Entity,

        private rawBlock: BlockRaw,
        blockSource: BlockSource,
    ) {
        super(blockPos, blockSource);
    }

    get block():Block {
        const block = new Block(this.rawBlock);
        Object.defineProperty(this, 'block', {value:block});
        return block;
    }
}

events.farmlandDecay.setInstaller(()=>{
    function onFarmlandDecay(this: FarmBlock, blockSource: BlockSource, blockPos: BlockPos, culprit: Actor, fallDistance: float32_t):void_t {
        const entity = Entity.fromRaw(culprit);
        if (entity == null) {
            return _onFarmlandDecay.call(this, blockSource, blockPos, culprit, fallDistance);
        }
        const event = new FarmlandDecayEvent(blockPos, entity, this, blockSource);
        const canceled = events.farmlandDecay.fire(event) === CANCEL;
        _tickCallback();
        if (!canceled) {
            return _onFarmlandDecay.call(this, blockSource, event.blockPos, event.culprit, fallDistance);
        }
    }
    const _onFarmlandDecay = hook(FarmBlock, 'transformOnFall').call(onFarmlandDecay);
});

export class CampfireTryLightFire extends BlockEvent {
}

events.campfireLight.setInstaller(()=>{
    function onCampfireTryLightFire(blockSource:BlockSource, blockPos:BlockPos):bool_t {
        const event = new CampfireTryLightFire(blockPos, blockSource);
        const canceled = events.campfireLight.fire(event) === CANCEL;
        _tickCallback();
        if (canceled) return false;
        else return _CampfireTryLightFire(blockSource, event.blockPos);
    }

    const _CampfireTryLightFire = hook(CampfireBlock.tryLightFire).call(onCampfireTryLightFire);
});

export class CampfireTryDouseFire extends BlockEvent {
}

events.campfireDouse.setInstaller(()=>{
    function onCampfireTryDouseFire(blockSource:BlockSource, blockPos:BlockPos, b:bool_t):bool_t {
        const event = new CampfireTryDouseFire(blockPos, blockSource);
        const canceled = events.campfireDouse.fire(event) === CANCEL;
        _tickCallback();
        if (canceled) return false;
        else return _CampfireTryDouseFire(event.getRawBlockSource(), event.blockPos, b);
    }

    const _CampfireTryDouseFire = hook(CampfireBlock.tryDouseFire).call(onCampfireTryDouseFire);
});
