import { Color } from "colors";
import { CANCEL } from "../../common";
import type { NativePointer } from "../../core";
import { Event } from "../../eventtarget";
import { MinecraftPacketIds, NetworkIdentifier, Packet } from "../../minecraft";
import { remapStack } from "../../source-map-support";
import type { EntityCreatedEvent } from "../entity";
import type { BlockDestroyEvent, BlockPlaceEvent, CampfireTryDouseFire, CampfireTryLightFire, FarmlandDecayEvent, PistonMoveEvent } from "./blockevent";
import type { CommandEvent } from "./commandevent";
import type { EntityDieEvent, EntityHeathChangeEvent, EntityHurtEvent, EntitySneakEvent, EntityStartRidingEvent, EntityStopRidingEvent, SplashPotionHitEvent } from "./entityevent";
import type { LevelExplodeEvent, LevelSaveEvent, LevelTickEvent, LevelWeatherChangeEvent } from "./levelevent";
import type { ObjectiveCreateEvent, QueryRegenerateEvent, ScoreAddEvent, ScoreRemoveEvent, ScoreResetEvent, ScoreSetEvent } from "./miscevent";
import type { PlayerAttackEvent, PlayerChatEvent, PlayerCritEvent, PlayerDisconnectEvent, PlayerDropItemEvent, PlayerInventoryChangeEvent, PlayerJoinEvent, PlayerLevelUpEvent, PlayerLoginEvent, PlayerPickupItemEvent, PlayerRespawnEvent, PlayerStartSwimmingEvent, PlayerUseItemEvent } from "./playerevent";

const PACKET_ID_COUNT = 0x100;
const PACKET_EVENT_COUNT = 0x500;

function getNetEventTarget(type:events.PacketEventType, packetId:MinecraftPacketIds):Event<(...args:any[])=>(CANCEL|void)> {
    if ((packetId>>>0) >= PACKET_ID_COUNT) {
        throw Error(`Out of range: packetId < 0x100 (packetId=${packetId})`);
    }
    const id = type*PACKET_ID_COUNT + packetId;
    const target = packetAllTargets[id];
    if (target !== null) return target;
    return packetAllTargets[id] = new Event;
}
const packetAllTargets = new Array<Event<(...args:any[])=>(CANCEL|void)>|null>(PACKET_EVENT_COUNT);
for (let i=0;i<PACKET_EVENT_COUNT;i++) {
    packetAllTargets[i] = null;
}

export namespace events {
    export type RawListener = (ptr:NativePointer, size:number, networkIdentifier:NetworkIdentifier, packetId: number)=>CANCEL|void|Promise<void>;
    export type PacketListener<ID extends MinecraftPacketIds> = (packet: Packet.idMap[ID], networkIdentifier: NetworkIdentifier, packetId: ID) => CANCEL|void|Promise<void>;
    export type BeforeListener<ID extends MinecraftPacketIds> = PacketListener<ID>;
    export type AfterListener<ID extends MinecraftPacketIds> = PacketListener<ID>;
    export type SendListener<ID extends MinecraftPacketIds> = PacketListener<ID>;
    export type SendRawListener = (ptr:NativePointer, size:number, networkIdentifier: NetworkIdentifier, packetId: number) => CANCEL|void|Promise<void>;

    ////////////////////////////////////////////////////////
    // Block events

    /** Cancellable */
    export const blockDestroy:Event<(event: BlockDestroyEvent) => void | CANCEL> = new Event;
    /** Cancellable */
    export const blockPlace:Event<(event: BlockPlaceEvent) => void | CANCEL> = new Event;
    /** Not cancellable */
    export const pistonMove:Event<(event: PistonMoveEvent) => void> = new Event;
    /** Cancellable */
    export const farmlandDecay:Event<(event: FarmlandDecayEvent) => void | CANCEL> = new Event;

    /** Cancellable but requires additional stimulation */
    export const campfireLight:Event<(event: CampfireTryLightFire) => void | CANCEL> = new Event;
    /** Cancellable but requires additional stimulation */
    export const campfireDouse:Event<(event: CampfireTryDouseFire) => void | CANCEL> = new Event;

    ////////////////////////////////////////////////////////
    // Entity events

    /** Cancellable */
    export const entityHurt:Event<(event: EntityHurtEvent) => void | CANCEL> = new Event;
    /** Not cancellable */
    export const entityHealthChange:Event<(event: EntityHeathChangeEvent) => void> = new Event;
    /** Not cancellable */
    export const entityDie:Event<(event: EntityDieEvent) => void> = new Event;
    /** Not cancellable */
    export const entitySneak:Event<(event: EntitySneakEvent) => void> = new Event;
    /** Cancellable */
    export const entityStartRiding:Event<(event: EntityStartRidingEvent) => void | CANCEL> = new Event;
    /** Cancellable but the client is still exiting though it will automatically ride again after rejoin */
    export const entityStopRiding:Event<(event: EntityStopRidingEvent) => void | CANCEL> = new Event;
    /** Not cancellable */
    export const entityCreated:Event<(event: EntityCreatedEvent) => void> = new Event;
    /** Cancellable */
    export const splashPotionHit:Event<(event: SplashPotionHitEvent) => void | CANCEL> = new Event;

    ////////////////////////////////////////////////////////
    // Player events

    /** Cancellable */
    export const playerStartSwimming:Event<(event: PlayerStartSwimmingEvent) => void | CANCEL> = new Event;
    /** Cancellable */
    export const playerAttack:Event<(event: PlayerAttackEvent) => void | CANCEL> = new Event;
    /** Cancellable but only when player is in container screens*/
    export const playerDropItem:Event<(event: PlayerDropItemEvent) => void | CANCEL> = new Event;
    /** Not cancellable */
    export const playerInventoryChange:Event<(event: PlayerInventoryChangeEvent) => void | CANCEL> = new Event;
    /** Not cancellable */
    export const playerRespawn:Event<(event: PlayerRespawnEvent) => void | CANCEL> = new Event;
    /** Cancellable */
    export const playerLevelUp:Event<(event: PlayerLevelUpEvent) => void | CANCEL> = new Event;
    /** Not cancellable */
    export const playerJoin:Event<(event: PlayerJoinEvent) => void> = new Event;
    /** Cancellable */
    export const playerPickupItem:Event<(event: PlayerPickupItemEvent) => void | CANCEL> = new Event;
    /** Not cancellable */
    export const playerCrit:Event<(event: PlayerCritEvent) => void> = new Event;
    /** Not cancellable */
    export const playerUseItem:Event<(event: PlayerUseItemEvent) => void> = new Event;
    /** Not cancellable */
    export const playerLogin:Event<(player:PlayerLoginEvent)=>void> = new Event;
    /** Not cancellable */
    export const playerDisconnect:Event<(player:PlayerDisconnectEvent)=>void> = new Event;
    /** Cancellable */
    export const playerChat:Event<(player:PlayerChatEvent)=>void|CANCEL> = new Event;

    ////////////////////////////////////////////////////////
    // Level events

    /** Cancellable */
    export const levelExplode:Event<(event: LevelExplodeEvent) => void | CANCEL> = new Event;
    /** Not cancellable */
    export const levelTick:Event<(event: LevelTickEvent) => void> = new Event;
    /** Cancellable but you won't be able to stop the server */
    export const levelSave:Event<(event: LevelSaveEvent) => void | CANCEL> = new Event;
    /** Cancellable */
    export const levelWeatherChange:Event<(event: LevelWeatherChangeEvent) => void | CANCEL> = new Event;

    ////////////////////////////////////////////////////////
    // Server events

    /**
     * before launched. after execute the main thread of BDS.
     * BDS will be loaded on the separated thread. this event will be executed concurrently with the BDS loading
     */
    export const serverLoading:Event<()=>void> = new Event;

    /**
     * after BDS launched
     */
    export const serverOpen:Event<()=>void> = new Event;

    /**
     * on tick
     */
    export const serverUpdate:Event<()=>void> = new Event;

    /**
     * before system.shutdown, Minecraft is alive yet
     */
    export const serverStop:Event<()=>void> = new Event;

    /**
     * after BDS closed
     */
    export const serverClose:Event<()=>void> = new Event;

    /**
     * server console outputs
     */
    export const serverLog:Event<(log:string, color:Color)=>CANCEL|void> = new Event;

    ////////////////////////////////////////////////////////
    // Packet events

    export enum PacketEventType {
        Raw,
        Before,
        After,
        Send,
        SendRaw
    }

    export function packetEvent(type:PacketEventType, packetId:MinecraftPacketIds):Event<(...args:any[])=>(CANCEL|void)>|null {
        if ((packetId>>>0) >= PACKET_ID_COUNT) {
            console.error(`Out of range: packetId < 0x100 (type=${PacketEventType[type]}, packetId=${packetId})`);
            return null;
        }
        const id = type*PACKET_ID_COUNT + packetId;
        return packetAllTargets[id];
    }

    /**
     * before 'before' and 'after'
     * earliest event for the packet receiving.
     * It will bring raw packet buffers before parsing
     * It can be canceled the packet if you return 'CANCEL'
     */
    export function packetRaw(id:MinecraftPacketIds):Event<RawListener> {
        return getNetEventTarget(PacketEventType.Raw, id);
    }

    /**
     * after 'raw', before 'after'
     * the event that before processing but after parsed from raw.
     * It can be canceled the packet if you return 'CANCEL'
     */
    export function packetBefore<ID extends MinecraftPacketIds>(id:ID):Event<PacketListener<ID>> {
        return getNetEventTarget(PacketEventType.Before, id);
    }

    /**
     * after 'raw' and 'before'
     * the event that after processing. some fields are assigned after the processing
     */
    export function packetAfter<ID extends MinecraftPacketIds>(id:ID):Event<PacketListener<ID>> {
        return getNetEventTarget(PacketEventType.After, id);
    }

    /**
     * before serializing.
     * it can modify class fields.
     */
    export function packetSend<ID extends MinecraftPacketIds>(id:ID):Event<PacketListener<ID>> {
        return getNetEventTarget(PacketEventType.Send, id);
    }

    /**
     * after serializing. before sending.
     * it can access serialized buffer.
     */
    export function packetSendRaw(id:number):Event<SendRawListener> {
        return getNetEventTarget(PacketEventType.SendRaw, id);
    }

    /**
     * @alias packetBefore(MinecraftPacketIds.Text)
     */
    export const chat = packetBefore(MinecraftPacketIds.Text);

    ////////////////////////////////////////////////////////
    // Misc

    /** Not cancellable */
    export const queryRegenerate:Event<(event: QueryRegenerateEvent) => void> = new Event;
    /** Cancellable */
    export const scoreReset:Event<(event: ScoreResetEvent) => void | CANCEL> = new Event;
    /** Cancellable */
    export const scoreSet:Event<(event: ScoreSetEvent) => void | CANCEL> = new Event;
    /** Cancellable */
    export const scoreAdd:Event<(event: ScoreAddEvent) => void | CANCEL> = new Event;
    /** Cancellable */
    export const scoreRemove:Event<(event: ScoreRemoveEvent) => void | CANCEL> = new Event;
    /** Cancellable */
    export const objectiveCreate:Event<(event: ObjectiveCreateEvent) => void | CANCEL> = new Event;

    /**
     * global error listeners
     * if returns 'CANCEL', then default error printing is disabled
     */
    export const error = Event.errorHandler;

    export function errorFire(err:unknown):void {
        if (err instanceof Error) {
            err.stack = remapStack(err.stack);
        }
        if (events.error.fire(err) !== CANCEL) {
            console.error(err && ((err as any).stack || err));
        }
    }

    /**
     * command console outputs
     */
    export const commandOutput:Event<(log:string)=>CANCEL|void> = new Event;

    /**
     * command input
     * Commands will be canceled if you return a error code.
     * 0 means success for error codes but others are unknown.
     */
    export const command:Event<(command: CommandEvent) => void | number> = new Event;

}
