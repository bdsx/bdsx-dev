import type { CommandContext } from "./bds/command";
import type { NetworkIdentifier } from "./bds/networkidentifier";
import { MinecraftPacketIds } from "./bds/packetids";
import { CANCEL } from "./common";
import { Event } from "./eventtarget";
import type { BlockDestroyEvent, BlockPlaceEvent, CampfireTryDouseFire, CampfireTryLightFire, FarmlandDecayEvent, PistonMoveEvent } from "./event_impl/blockevent";
import type { EntityCreatedEvent, EntityDieEvent, EntityHeathChangeEvent, EntityHurtEvent, EntitySneakEvent, EntityStartRidingEvent, EntityStartSwimmingEvent, EntityStopRidingEvent, PlayerAttackEvent, PlayerCritEvent, PlayerDropItemEvent, PlayerInventoryChangeEvent, PlayerJoinEvent, PlayerLevelUpEvent, PlayerPickupItemEvent, PlayerRespawnEvent, PlayerUseItemEvent, SplashPotionHitEvent } from "./event_impl/entityevent";
import type { LevelExplodeEvent, LevelSaveEvent, LevelTickEvent, LevelWeatherChangeEvent } from "./event_impl/levelevent";
import type { ObjectiveCreateEvent, QueryRegenerateEvent, ScoreAddEvent, ScoreRemoveEvent, ScoreResetEvent, ScoreSetEvent } from "./event_impl/miscevent";
import type { nethook } from "./nethook";
import { bdsx } from "./v3";

const PACKET_ID_COUNT = 0x100;
const PACKET_EVENT_COUNT = 0x500;

function getNetEventTarget(type:events.PacketEventType, packetId:MinecraftPacketIds):Event<(...args:any[])=>(CANCEL|void)> {
    if ((packetId>>>0) >= PACKET_ID_COUNT) {
        throw Error(`Out of range: packetId < 0x100 (packetId=${packetId})`);
    }
    const id = type*PACKET_ID_COUNT + packetId;
    let target = packetAllTargets[id];
    if (target !== null) return target;
    packetAllTargets[id] = target = new Event;
    return target;
}
const packetAllTargets = new Array<Event<(...args:any[])=>(CANCEL|void)>|null>(PACKET_EVENT_COUNT);
for (let i=0;i<PACKET_EVENT_COUNT;i++) {
    packetAllTargets[i] = null;
}

/** @deprecated use bdsx.events */
export namespace events {

    ////////////////////////////////////////////////////////
    // Block events

    /** @deprecated use bdsx.events */
    export const blockDestroy = new Event<(event: BlockDestroyEvent) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const blockPlace = new Event<(event: BlockPlaceEvent) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const pistonMove = new Event<(event: PistonMoveEvent) => void>();
    /** @deprecated use bdsx.events */
    export const farmlandDecay = new Event<(event: FarmlandDecayEvent) => void | CANCEL>();

    /** @deprecated use bdsx.events */
    export const campfireLight = new Event<(event: CampfireTryLightFire) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const campfireDouse = new Event<(event: CampfireTryDouseFire) => void | CANCEL>();
    ////////////////////////////////////////////////////////
    // Entity events

    /** @deprecated use bdsx.events */
    export const entityHurt = new Event<(event: EntityHurtEvent) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const entityHealthChange = new Event<(event: EntityHeathChangeEvent) => void>();
    /** @deprecated use bdsx.events */
    export const entityDie = new Event<(event: EntityDieEvent) => void>();
    /** @deprecated use bdsx.events */
    export const entitySneak = new Event<(event: EntitySneakEvent) => void>();
    /** @deprecated use bdsx.events */
    export const entityStartSwimming = new Event<(event: EntityStartSwimmingEvent) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const entityStartRiding = new Event<(event: EntityStartRidingEvent) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const entityStopRiding = new Event<(event: EntityStopRidingEvent) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const playerAttack = new Event<(event: PlayerAttackEvent) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const playerDropItem = new Event<(event: PlayerDropItemEvent) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const playerInventoryChange = new Event<(event: PlayerInventoryChangeEvent) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const playerRespawn = new Event<(event: PlayerRespawnEvent) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const playerLevelUp = new Event<(event: PlayerLevelUpEvent) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const entityCreated = new Event<(event: EntityCreatedEvent) => void>();
    /** @deprecated use bdsx.events */
    export const playerJoin = new Event<(event: PlayerJoinEvent) => void>();
    /** @deprecated use bdsx.events */
    export const playerPickupItem = new Event<(event: PlayerPickupItemEvent) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const playerCrit = new Event<(event: PlayerCritEvent) => void>();
    /** @deprecated use bdsx.events */
    export const playerUseItem = new Event<(event: PlayerUseItemEvent) => void>();
    /** @deprecated use bdsx.events */
    export const splashPotionHit = new Event<(event: SplashPotionHitEvent) => void | CANCEL>();

    ////////////////////////////////////////////////////////
    // Level events

    /** @deprecated use bdsx.events */
    export const levelExplode = new Event<(event: LevelExplodeEvent) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const levelTick = new Event<(event: LevelTickEvent) => void>();
    /** Cancellable but you won't be able to stop the server */
    export const levelSave = new Event<(event: LevelSaveEvent) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const levelWeatherChange = new Event<(event: LevelWeatherChangeEvent) => void | CANCEL>();

    ////////////////////////////////////////////////////////
    // Server events

    /**
     * before launched. after execute the main thread of BDS.
     * BDS will be loaded on the separated thread. this event will be executed concurrently with the BDS loading
     */
    export const serverLoading = bdsx.events.serverLoading;

    /**
     * after BDS launched
     * @deprecated use bdsx.events
     */
    export const serverOpen = bdsx.events.serverOpen;

    /**
     * on tick
     * @deprecated use bdsx.events
     */
    export const serverUpdate = bdsx.events.serverUpdate;

    /**
     * before system.shutdown, Minecraft is alive yet
     * @deprecated use bdsx.events
     */
    export const serverStop = bdsx.events.serverStop;

    /**
     * after BDS closed
     * @deprecated use bdsx.events
     */
    export const serverClose = bdsx.events.serverClose;

    /**
     * server console outputs
     */
    export const serverLog = bdsx.events.serverLog;

    ////////////////////////////////////////////////////////
    // Packet events

    /** @deprecated use bdsx.events */
    export enum PacketEventType {
        Raw,
        Before,
        After,
        Send,
        SendRaw
    }

    /** @deprecated use bdsx.events */
    export function packetEvent(type:PacketEventType, packetId:MinecraftPacketIds):Event<(...args:any[])=>(CANCEL|void)>|null {
        if ((packetId>>>0) >= PACKET_ID_COUNT) {
            console.error(`Out of range: packetId < 0x100 (type=${PacketEventType[type]}, packetId=${packetId})`);
            return null;
        }
        const id = type*PACKET_ID_COUNT + packetId;
        return packetAllTargets[id];
    }

    /** @deprecated use bdsx.events */
    export function packetRaw(id:MinecraftPacketIds):Event<nethook.RawListener> {
        return getNetEventTarget(PacketEventType.Raw, id);
    }

    /** @deprecated use bdsx.events */
    export function packetBefore<ID extends MinecraftPacketIds>(id:ID):Event<nethook.PacketListener<ID>> {
        return getNetEventTarget(PacketEventType.Before, id);
    }

    /** @deprecated use bdsx.events */
    export function packetAfter<ID extends MinecraftPacketIds>(id:ID):Event<nethook.PacketListener<ID>> {
        return getNetEventTarget(PacketEventType.After, id);
    }

    /** @deprecated use bdsx.events */
    export function packetSend<ID extends MinecraftPacketIds>(id:ID):Event<nethook.PacketListener<ID>> {
        return getNetEventTarget(PacketEventType.Send, id);
    }

    /** @deprecated use bdsx.events */
    export function packetSendRaw(id:number):Event<nethook.SendRawListener> {
        return getNetEventTarget(PacketEventType.SendRaw, id);
    }

    ////////////////////////////////////////////////////////
    // Misc

    /** @deprecated use bdsx.events */
    export const queryRegenerate = new Event<(event: QueryRegenerateEvent) => void>();
    /** @deprecated use bdsx.events */
    export const scoreReset = new Event<(event: ScoreResetEvent) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const scoreSet = new Event<(event: ScoreSetEvent) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const scoreAdd = new Event<(event: ScoreAddEvent) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const scoreRemove = new Event<(event: ScoreRemoveEvent) => void | CANCEL>();
    /** @deprecated use bdsx.events */
    export const objectiveCreate = new Event<(event: ObjectiveCreateEvent) => void | CANCEL>();

    /** @deprecated use bdsx.events */
    export const error = Event.errorHandler;

    /** @deprecated use bdsx.events */
    export function errorFire(err:unknown):void {
        bdsx.events.errorFire(err);
    }

    /** @deprecated use bdsx.events */
    export const commandOutput = new Event<(log:string)=>CANCEL|void>();

    /** @deprecated use bdsx.events */
    export const command = new Event<(command: string, originName: string, ctx: CommandContext) => void | number>();

    /** @deprecated use bdsx.events */
    export const networkDisconnected = new Event<(ni:NetworkIdentifier)=>void>();

}
