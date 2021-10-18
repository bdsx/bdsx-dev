import { Actor } from "../bds/actor";
import { Block, BlockSource } from "../bds/block";
import { BlockPos } from "../bds/blockpos";
import { Player } from "../bds/player";
import { events } from "../event";
import { bdsx } from "../v3";
import enums = require('../enums');

interface IBlockDestroyEvent {
    player: Player;
    blockPos: BlockPos;
}
/** @deprecated */
export class BlockDestroyEvent implements IBlockDestroyEvent {
    constructor(
        public player: Player,
        public blockPos: BlockPos,
    ) {
    }
}

events.blockDestroy.pipe(bdsx.events.blockDestroy, function(ev){
    const event = new BlockDestroyEvent(ev.player.getRawEntity()!.as(Player), ev.blockPos);
    return this.fire(event);
});

interface IBlockPlaceEvent {
    player: Player,
    block: Block,
    blockSource: BlockSource,
    blockPos: BlockPos;
}
/** @deprecated */
export class BlockPlaceEvent implements IBlockPlaceEvent {
    constructor(
        public player: Player,
        public block: Block,
        public blockSource: BlockSource,
        public blockPos: BlockPos,
    ) {
    }
}

events.blockPlace.pipe(bdsx.events.blockPlace, function(ev){
    const event = new BlockPlaceEvent(
        Actor.fromNewActor(ev.player.getRawEntity()!) as Player,
        ev.block.getRawBlock().as(Block),
        ev.getRawBlockSource().as(BlockSource),
        ev.blockPos);
    return this.fire(event);
});

/** @deprecated */
export const PistonAction = enums.PistonAction;
/** @deprecated */
export type PistonAction = enums.PistonAction;

interface IPistonMoveEvent {
    blockPos: BlockPos;
    blockSource: BlockSource;
    readonly action: PistonAction;
}
/** @deprecated */
export class PistonMoveEvent implements IPistonMoveEvent {
    constructor(
        public blockPos: BlockPos,
        public blockSource: BlockSource,
        public action: PistonAction,
    ) {
    }
}

events.pistonMove.pipe(bdsx.events.pistonMove, function(ev){
    const event = new PistonMoveEvent(ev.blockPos, ev.getRawBlockSource().as(BlockSource), ev.action);
    return this.fire(event);
});

interface IFarmlandDecayEvent {
    block: Block;
    blockPos: BlockPos;
    blockSource: BlockSource;
    culprit: Actor;
}
export class FarmlandDecayEvent implements IFarmlandDecayEvent {
    constructor(
        public block: Block,
        public blockPos: BlockPos,
        public blockSource: BlockSource,
        public culprit: Actor,
    ) {
    }
}

events.farmlandDecay.pipe(bdsx.events.farmlandDecay, function(ev){
    const event = new FarmlandDecayEvent(ev.block.getRawBlock().as(Block), ev.blockPos, ev.getRawBlockSource().as(BlockSource), Actor.fromNewActor(ev.culprit.getRawEntity()!));
    return this.fire(event);
});

interface ICampfireTryLightFire {
    blockSource: BlockSource;
    blockPos: BlockPos;
}

export class CampfireTryLightFire implements ICampfireTryLightFire {
    constructor(
        public blockPos: BlockPos,
        public blockSource: BlockSource
    ) {
    }
}

events.campfireLight.pipe(bdsx.events.campfireLight, function(ev){
    const event = new CampfireTryLightFire(ev.blockPos, ev.getRawBlockSource().as(BlockSource));
    return this.fire(event);
});

interface ICampfireTryDouseFire {
    blockSource: BlockSource;
    blockPos: BlockPos;
}
export class CampfireTryDouseFire implements ICampfireTryDouseFire {
    constructor(
        public blockPos: BlockPos,
        public blockSource: BlockSource
    ) {
    }
}

events.campfireDouse.pipe(bdsx.events.campfireDouse, function(ev){
    const event = new CampfireTryDouseFire(ev.blockPos, ev.getRawBlockSource().as(BlockSource));
    return this.fire(event);
});
