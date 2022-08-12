import { CxxVector } from "../cxxvector";
import { mce } from "../mce";
import { MantleClass, nativeClass, NativeClass, nativeField } from "../nativeclass";
import { bin64_t, bool_t, CxxString, CxxStringWith8Bytes, float32_t, int16_t, int32_t, int64_as_float_t, int8_t, NativeType, uint16_t, uint32_t, uint8_t } from "../nativetype";
import { ActorRuntimeID, ActorUniqueID } from "./actor";
import { BlockPos, Vec3 } from "./blockpos";
import { ConnectionRequest } from "./connreq";
import { HashedString } from "./hashedstring";
import { ComplexInventoryTransaction, ContainerId, ContainerType, NetworkItemStackDescriptor } from "./inventory";
import { Packet } from "./packet";
import type { GameType } from "./player";
import { DisplaySlot, ObjectiveSortOrder, ScoreboardId } from "./scoreboard";
import minecraft = require('../minecraft');
import MinecraftPacketIds = minecraft.MinecraftPacketIds;

/** @deprecated */
@nativeClass(null)
export class LoginPacket extends Packet {
    @nativeField(int32_t, 0x30)
	protocol:int32_t;
    /**
     * it can be null if the wrong client version
     */
    @nativeField(ConnectionRequest.ref(), 0x38)
	connreq:ConnectionRequest|null;
}

/** @deprecated */
@nativeClass(null)
export class PlayStatusPacket extends Packet {
    @nativeField(int32_t)
    status:int32_t;
}

/** @deprecated */
@nativeClass(null)
export class ServerToClientHandshakePacket extends Packet {
    @nativeField(CxxString)
    jwt:CxxString;
}

/** @deprecated */
@nativeClass(null)
export class ClientToServerHandshakePacket extends Packet {
    // no data
}

/** @deprecated */
@nativeClass(null)
export class DisconnectPacket extends Packet {
    @nativeField(bool_t)
    skipMessage:bool_t;
    @nativeField(CxxString, 0x38)
    message:CxxString;
}

/** @deprecated */
export const PackType = minecraft.PackType;
/** @deprecated */
export type PackType = minecraft.PackType;

// @nativeClass(0x88)
// export class PackIdVersion extends NativeClass {
//     @nativeField(mce.UUID)
//     uuid:mce.UUID
//     @nativeField(SemVersion, 0x10)
//     version:SemVersion
//     @nativeField(uint8_t)
//     packType:PackType
// }

// @nativeClass(0xA8)
// export class PackInstanceId extends NativeClass {
//     @nativeField(PackIdVersion)
//     packId:PackIdVersion;
//     @nativeField(CxxString)
//     subpackName:CxxString;
// }

// @nativeClass(0x18)
// export class ContentIdentity extends NativeClass {
//     @nativeField(mce.UUID)
//     uuid:mce.UUID
//     @nativeField(bool_t, 0x10)
//     valid:bool_t
// }

// @nativeClass(0xF0)
// export class ResourcePackInfoData extends NativeClass {
//     @nativeField(PackIdVersion)
//     packId:PackIdVersion;
//     @nativeField(bin64_t)
//     packSize:bin64_t;
//     @nativeField(CxxString)
//     contentKey:CxxString;
//     @nativeField(CxxString)
//     subpackName:CxxString;
//     @nativeField(ContentIdentity)
//     contentIdentity:ContentIdentity;
//     @nativeField(bool_t)
//     hasScripts:bool_t;
//     @nativeField(bool_t)
//     hasExceptions:bool_t;
// }

// @nativeClass(null)
// export class ResourcePacksInfoData extends NativeClass {
//     @nativeField(bool_t)
//     texturePackRequired:bool_t;
//     @nativeField(bool_t)
//     hasScripts:bool_t;
//     @nativeField(bool_t)
//     hasExceptions:bool_t;
//     @nativeField(CxxVector.make(ResourcePackInfoData), 0x08)
//     addOnPacks:CxxVector<ResourcePackInfoData>;
//     @nativeField(CxxVector.make(ResourcePackInfoData), 0x20)
//     texturePacks:CxxVector<ResourcePackInfoData>;
// }

/** @deprecated */
@nativeClass(null)
export class ResourcePacksInfoPacket extends Packet {
    // @nativeField(ResourcePacksInfoData)
    // data:ResourcePacksInfoData;
}

/** @deprecated */
@nativeClass(null)
export class ResourcePackStackPacket extends Packet {
    // @nativeField(CxxVector.make(PackInstanceId))
    // addOnPacks:CxxVector<PackInstanceId>;
    // @nativeField(CxxVector.make(PackInstanceId))
    // texturePacks:CxxVector<PackInstanceId>;
    // @nativeField(BaseGameVersion)
    // baseGameVersion:BaseGameVersion;
    // @nativeField(bool_t)
    // texturePackRequired:bool_t;
    // @nativeField(bool_t)
    // experimental:bool_t;
}

/** @deprecated Use ResourcePackStackPacket, follow the real class name */
export const ResourcePackStacksPacket = ResourcePackStackPacket;
/** @deprecated use ResourcePackStackPacket, follow the real class name */
export type ResourcePackStacksPacket = ResourcePackStackPacket;

/** @deprecated */
export const ResourcePackResponse = minecraft.ResourcePackResponse;
/** @deprecated */
export type ResourcePackResponse = minecraft.ResourcePackResponse;

/** @deprecated */
@nativeClass(null)
export class ResourcePackClientResponsePacket extends Packet {
    // @nativeField(uint8_t, 0x40)
    // response: ResourcePackResponse;
}

/** @deprecated */
@nativeClass(null)
export class TextPacket extends Packet {
    @nativeField(uint8_t)
    type:uint8_t;
    @nativeField(CxxString)
    name:CxxString;
    @nativeField(CxxString)
    message:CxxString;
    @nativeField(CxxVector.make(CxxString))
    params:CxxVector<CxxString>;
    @nativeField(bool_t, 0x90)
    needsTranslation:bool_t;
    @nativeField(CxxString, 0x98)
    xboxUserId:CxxString;
    @nativeField(CxxString)
    platformChatId:CxxString;
}
/** @deprecated */
export namespace TextPacket {
    /** @deprecated */
    export const Types = minecraft.TextPacket.Types;
    /** @deprecated */
    export type Types = minecraft.TextPacket.Types;
}

/** @deprecated */
@nativeClass(null)
export class SetTimePacket extends Packet {
    @nativeField(int32_t)
    time:int32_t;
}

/** @deprecated */
@nativeClass(null)
export class LevelSettings extends MantleClass {
    @nativeField(int32_t)
    seed:int32_t;
}

/** @deprecated */
@nativeClass(null)
export class StartGamePacket extends Packet {
    @nativeField(LevelSettings)
    settings:LevelSettings;
}
/** @deprecated */
@nativeClass(null)
export class AddPlayerPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class AddActorPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class RemoveActorPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class AddItemActorPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class TakeItemActorPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class MoveActorAbsolutePacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class MovePlayerPacket extends Packet {
    @nativeField(ActorRuntimeID)
    actorId: ActorRuntimeID;
    @nativeField(Vec3)
    pos: Vec3;
    @nativeField(float32_t)
    pitch: float32_t;
    @nativeField(float32_t)
    yaw: float32_t;
    @nativeField(float32_t)
    headYaw: float32_t;
    @nativeField(uint8_t)
    mode: uint8_t;
    @nativeField(bool_t)
    onGround: bool_t;
    @nativeField(ActorRuntimeID)
    ridingActorId: ActorRuntimeID;
    @nativeField(int32_t)
    teleportCause: int32_t;
    @nativeField(int32_t)
    teleportItem: int32_t;
    @nativeField(bin64_t)
    tick: bin64_t;
}
/** @deprecated */
export namespace MovePlayerPacket {
    export const Modes = minecraft.MovePlayerPacket.Modes;
    export type Modes = minecraft.MovePlayerPacket.Modes;
}

/** @deprecated */
@nativeClass(null)
export class RiderJumpPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class UpdateBlockPacket extends Packet {
    @nativeField(BlockPos)
    blockPos: BlockPos;
    @nativeField(uint32_t)
    blockRuntimeId: uint32_t;
    @nativeField(uint8_t)
    flags: uint8_t;
    @nativeField(uint32_t)
    dataLayerId: uint32_t;
}
export namespace UpdateBlockPacket {
    /** @deprecated */
    export const Flags = minecraft.UpdateBlockPacket.Flags;
    /** @deprecated */
    export type Flags = minecraft.UpdateBlockPacket.Flags;
    /** @deprecated */
    export const DataLayerIds = minecraft.UpdateBlockPacket.DataLayerIds;
    /** @deprecated */
    export type DataLayerIds = minecraft.UpdateBlockPacket.DataLayerIds;
}

/** @deprecated */
@nativeClass(null)
export class AddPaintingPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class TickSyncPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class LevelSoundEventPacketV1 extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class LevelEventPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class BlockEventPacket extends Packet {
    @nativeField(BlockPos)
    pos:BlockPos;
    @nativeField(int32_t)
    type:int32_t;
    @nativeField(int32_t)
    data:int32_t;
}

/** @deprecated */
@nativeClass(null)
export class ActorEventPacket extends Packet {
    @nativeField(ActorRuntimeID)
    actorId: ActorRuntimeID;
    @nativeField(uint8_t)
    event: uint8_t;
    @nativeField(int32_t)
    data: int32_t;
}
/** @deprecated */
export namespace ActorEventPacket {
    /** @deprecated */
    export const Events = minecraft.ActorEventPacket.Events;
    /** @deprecated */
    export type Events = minecraft.ActorEventPacket.Events;
}

/** @deprecated */
@nativeClass(null)
export class MobEffectPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(0x40)
export class AttributeData extends NativeClass {
    @nativeField(float32_t)
    current:number;
    @nativeField(float32_t)
    min:number;
    @nativeField(float32_t)
    max:number;
    @nativeField(float32_t)
    default:number;
    @nativeField(HashedString)
    name:HashedString;

    [NativeType.ctor]():void {
        this.min = 0;
        this.max = 0;
        this.current = 0;
        this.default = 0;
    }
}

/** @deprecated */
@nativeClass(null)
export class UpdateAttributesPacket extends Packet {
    @nativeField(ActorRuntimeID)
    actorId:ActorRuntimeID;
    @nativeField(CxxVector.make<AttributeData>(AttributeData))
    attributes:CxxVector<AttributeData>;
}

/** @deprecated */
@nativeClass(null)
export class InventoryTransactionPacket extends Packet {
    @nativeField(uint32_t)
    legacyRequestId: uint32_t;
    @nativeField(ComplexInventoryTransaction.ref(), 0x50)
    transaction: ComplexInventoryTransaction;
}

/** @deprecated */
@nativeClass(null)
export class MobEquipmentPacket extends Packet {
    @nativeField(ActorRuntimeID)
    runtimeId:ActorRuntimeID;
    @nativeField(NetworkItemStackDescriptor)
    item:NetworkItemStackDescriptor;
    @nativeField(uint8_t, 0xC1)
    slot:uint8_t;
    @nativeField(uint8_t)
    selectedSlot:uint8_t;
    @nativeField(uint8_t)
    containerId:ContainerId;
}

/** @deprecated */
@nativeClass(null)
export class MobArmorEquipmentPacket extends Packet {
    // I need some tests, I do not know when this packet is sent
    // @nativeField(NetworkItemStackDescriptor)
    // head:NetworkItemStackDescriptor;
    // @nativeField(NetworkItemStackDescriptor, {ghost: true})
    // chest:NetworkItemStackDescriptor;
    // @nativeField(NetworkItemStackDescriptor)
    // torso:NetworkItemStackDescriptor; // Found 'torso' instead of 'chest' in IDA
    // @nativeField(NetworkItemStackDescriptor)
    // legs:NetworkItemStackDescriptor;
    // @nativeField(NetworkItemStackDescriptor)
    // feet:NetworkItemStackDescriptor;
    // @nativeField(ActorRuntimeID)
    // runtimeId:ActorRuntimeID;
}

/** @deprecated */
@nativeClass(null)
export class InteractPacket extends Packet {
    @nativeField(uint8_t)
    action:uint8_t;
    @nativeField(ActorRuntimeID)
    actorId:ActorRuntimeID;
    @nativeField(Vec3)
    pos:Vec3;
}
export namespace InteractPacket {
    /** @deprecated */
    export const Actions = minecraft.InteractPacket.Actions;
    /** @deprecated */
    export type Actions = minecraft.InteractPacket.Actions;
}

/** @deprecated */
@nativeClass(null)
export class BlockPickRequestPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class ActorPickRequestPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class PlayerActionPacket extends Packet {
    @nativeField(BlockPos)
    pos: BlockPos;
    @nativeField(int32_t)
    face: int32_t;
    @nativeField(int32_t)
    action: PlayerActionPacket.Actions;
    @nativeField(ActorRuntimeID)
    actorId: ActorRuntimeID;
}
/** @deprecated */
export namespace PlayerActionPacket {
    /** @deprecated */
    export const Actions = minecraft.PlayerActionPacket.Actions;
    /** @deprecated */
    export type Actions = minecraft.PlayerActionPacket.Actions;
}

/** @deprecated */
@nativeClass(null)
export class EntityFallPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class HurtArmorPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class SetActorDataPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class SetActorMotionPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class SetActorLinkPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class SetHealthPacket extends Packet {
    @nativeField(uint8_t)
    health:uint8_t;
}

/** @deprecated */
@nativeClass(null)
export class SetSpawnPositionPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class AnimatePacket extends Packet {
    @nativeField(ActorRuntimeID)
    actorId:ActorRuntimeID;
    @nativeField(int32_t)
    action:int32_t;
    @nativeField(float32_t)
    rowingTime:float32_t;
}
/** @deprecated */
export namespace AnimatePacket {
    /** @deprecated */
    export const Actions = minecraft.AnimatePacket.Actions;
    /** @deprecated */
    export type Actions = minecraft.AnimatePacket.Actions;
}

/** @deprecated */
@nativeClass(null)
export class RespawnPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class ContainerOpenPacket extends Packet {
    /** @deprecated */
    @nativeField(uint8_t, {ghost: true})
    windowId:uint8_t;
    @nativeField(uint8_t)
    containerId:ContainerId;
    @nativeField(int8_t)
    type:ContainerType;
    @nativeField(BlockPos)
    pos:BlockPos;
    @nativeField(bin64_t)
    entityUniqueId:bin64_t;
    @nativeField(int64_as_float_t, {ghost: true})
    entityUniqueIdAsNumber:int64_as_float_t;
}

/** @deprecated */
@nativeClass(null)
export class ContainerClosePacket extends Packet {
    /** @deprecated */
    @nativeField(uint8_t, {ghost: true})
    windowId:uint8_t;
    @nativeField(uint8_t)
    containerId:ContainerId;
    @nativeField(bool_t)
    server:bool_t;
}

/** @deprecated */
@nativeClass(null)
export class PlayerHotbarPacket extends Packet {
    @nativeField(uint32_t)
    selectedSlot:uint32_t;
    @nativeField(bool_t)
    selectHotbarSlot:bool_t;
    /** @deprecated */
    @nativeField(uint8_t, {ghost: true})
    windowId:uint8_t;
    @nativeField(uint8_t)
    containerId:ContainerId;
}

/** @deprecated */
@nativeClass(null)
export class InventoryContentPacket extends Packet {
    @nativeField(uint8_t)
    containerId:ContainerId;
    @nativeField(CxxVector.make(NetworkItemStackDescriptor), 56)
    slots:CxxVector<NetworkItemStackDescriptor>;
}

/** @deprecated */
@nativeClass(null)
export class InventorySlotPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class ContainerSetDataPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class CraftingDataPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class CraftingEventPacket extends Packet {
    @nativeField(uint8_t)
    containerId:ContainerId;
    @nativeField(int32_t, 0x34)
    containerType:ContainerType;
    @nativeField(mce.UUID)
    recipeId:mce.UUID;
    @nativeField(CxxVector.make(NetworkItemStackDescriptor))
    inputItems:CxxVector<NetworkItemStackDescriptor>;
    @nativeField(CxxVector.make(NetworkItemStackDescriptor))
    outputItems:CxxVector<NetworkItemStackDescriptor>;
}

/** @deprecated */
@nativeClass(null)
export class GuiDataPickItemPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class AdventureSettingsPacket extends Packet {
    @nativeField(uint32_t)
    flag1: uint32_t;
    @nativeField(uint32_t)
    commandPermission: uint32_t;
    @nativeField(uint32_t, 0x38)
    flag2: uint32_t;
    @nativeField(uint32_t)
    playerPermission: uint32_t;
    @nativeField(ActorUniqueID)
    actorId: ActorUniqueID;
    @nativeField(uint32_t, 0x4C)
    customFlag: uint32_t;
}

/** @deprecated */
@nativeClass(null)
export class BlockActorDataPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class PlayerInputPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class LevelChunkPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class SetCommandsEnabledPacket extends Packet {
    @nativeField(bool_t)
    commandsEnabled:bool_t;
}

/** @deprecated */
@nativeClass(null)
export class SetDifficultyPacket extends Packet {
    @nativeField(uint32_t)
    difficulty:uint32_t;
}

/** @deprecated */
@nativeClass(null)
export class ChangeDimensionPacket extends Packet {
    @nativeField(uint32_t)
    dimensionId:uint32_t;
    @nativeField(float32_t)
    x:float32_t;
    @nativeField(float32_t)
    y:float32_t;
    @nativeField(float32_t)
    z:float32_t;
    @nativeField(bool_t)
    respawn:bool_t;
}

/** @deprecated */
@nativeClass(null)
export class SetPlayerGameTypePacket extends Packet {
    @nativeField(int32_t)
    playerGameType:GameType;
}

/** @deprecated */
@nativeClass(null)
export class PlayerListPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class SimpleEventPacket extends Packet {
    @nativeField(uint16_t)
    subtype:uint16_t;
}

/** @deprecated */
@nativeClass(null)
export class TelemetryEventPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class SpawnExperienceOrbPacket extends Packet {
    @nativeField(Vec3)
    pos:Vec3;
    @nativeField(int32_t)
    amount:int32_t;
}

/** @deprecated */
@nativeClass(null)
export class MapItemDataPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class MapInfoRequestPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class RequestChunkRadiusPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class ChunkRadiusUpdatedPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class ItemFrameDropItemPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class GameRulesChangedPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class CameraPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class BossEventPacket extends Packet {
    /** @deprecated */
    @nativeField(bin64_t, {ghost: true})
    unknown:bin64_t;
    /** Always 1 */
    @nativeField(int32_t)
    flagDarken:int32_t;
    /** Always 2 */
    @nativeField(int32_t)
    flagFog:int32_t;
    /** Unique ID of the boss */
    @nativeField(bin64_t)
    entityUniqueId:bin64_t;
    @nativeField(bin64_t)
    playerUniqueId:bin64_t;
    @nativeField(uint32_t)
    type:uint32_t;
    @nativeField(CxxString, 0x50)
    title:CxxString;
    @nativeField(float32_t)
    healthPercent:float32_t;
    @nativeField(uint32_t)
    color:BossEventPacket.Colors;
    @nativeField(uint32_t)
    overlay:BossEventPacket.Overlay;
    @nativeField(bool_t)
    darkenScreen:bool_t;
    @nativeField(bool_t)
    createWorldFog:bool_t;
}
export namespace BossEventPacket {
    /** @deprecated */
    export const Types = minecraft.BossEventPacket.Types;
    /** @deprecated */
    export type Types = minecraft.BossEventPacket.Types;

    /** @deprecated */
    export const Colors = minecraft.BossEventPacket.Colors;
    /** @deprecated */
    export type Colors = minecraft.BossEventPacket.Colors;

    /** @deprecated */
    export const Overlay = minecraft.BossEventPacket.Overlay;
    /** @deprecated */
    export type Overlay = minecraft.BossEventPacket.Overlay;
}

/** @deprecated */
@nativeClass(null)
export class ShowCreditsPacket extends Packet {
    // unknown
}

@nativeClass()
class AvailableCommandsParamData extends NativeClass {
    @nativeField(CxxString)
    paramName:CxxString;
    @nativeField(int32_t)
    paramType:int32_t;
    @nativeField(bool_t)
    isOptional:bool_t;
    @nativeField(uint8_t)
    flags:uint8_t;
}

@nativeClass()
class AvailableCommandsOverloadData extends NativeClass {
    @nativeField(CxxVector.make(AvailableCommandsParamData))
    parameters:CxxVector<AvailableCommandsParamData>;
}

@nativeClass(0x68)
class AvailableCommandsCommandData extends NativeClass {
    @nativeField(CxxString)
    name:CxxString;
    @nativeField(CxxString)
    description:CxxString;
    @nativeField(uint16_t) // 40
    flags:uint16_t;
    @nativeField(uint8_t) // 42
    permission:uint8_t;
    /** @deprecated use overloads */
    @nativeField(CxxVector.make(CxxVector.make(CxxStringWith8Bytes)), {ghost: true})
    parameters:CxxVector<CxxVector<CxxString>>;
    @nativeField(CxxVector.make(AvailableCommandsOverloadData))
    overloads:CxxVector<AvailableCommandsOverloadData>;
    @nativeField(int32_t) // 60
    aliases:int32_t;
}

@nativeClass(0x38)
class AvailableCommandsEnumData extends NativeClass{
}

/** @deprecated */
@nativeClass(null)
export class AvailableCommandsPacket extends Packet {
    @nativeField(CxxVector.make(CxxString))
    enumValues:CxxVector<CxxString>;
    @nativeField(CxxVector.make(CxxString))
    postfixes:CxxVector<CxxString>;
    @nativeField(CxxVector.make(AvailableCommandsEnumData))
    enums:CxxVector<AvailableCommandsEnumData>;
    @nativeField(CxxVector.make(AvailableCommandsCommandData))
    commands:CxxVector<AvailableCommandsCommandData>;
}
/** @deprecated */
export namespace AvailableCommandsPacket {
    export type CommandData = AvailableCommandsCommandData;
    export const CommandData = AvailableCommandsCommandData;
    export type EnumData = AvailableCommandsEnumData;
    export const EnumData = AvailableCommandsEnumData;
}

/** @deprecated */
@nativeClass(null)
export class CommandRequestPacket extends Packet {
    @nativeField(CxxString)
    command:CxxString;
}


/** @deprecated */
@nativeClass(null)
export class CommandBlockUpdatePacket extends Packet {
    // unknown
}


/** @deprecated */
@nativeClass(null)
export class CommandOutputPacket extends Packet {
    // unknown
}


/** @deprecated */
@nativeClass(null)
export class ResourcePackDataInfoPacket extends Packet {
    // unknown
}


/** @deprecated */
@nativeClass(null)
export class ResourcePackChunkDataPacket extends Packet {
    // unknown
}


/** @deprecated */
@nativeClass(null)
export class ResourcePackChunkRequestPacket extends Packet {
    // unknown
}


/** @deprecated */
@nativeClass(null)
export class TransferPacket extends Packet {
    @nativeField(CxxString)
    address:CxxString;
    @nativeField(uint16_t)
    port:uint16_t;
}

/** @deprecated */
@nativeClass(null)
export class PlaySoundPacket extends Packet {
    @nativeField(CxxString)
    soundName:CxxString;
    @nativeField(BlockPos)
    pos:BlockPos;
    @nativeField(float32_t)
    volume:float32_t;
    @nativeField(float32_t)
    pitch:float32_t;
}

/** @deprecated */
@nativeClass(null)
export class StopSoundPacket extends Packet {
    @nativeField(CxxString)
    soundName:CxxString;
    @nativeField(bool_t)
    stopAll:bool_t;
}

/** @deprecated */
@nativeClass(null)
export class SetTitlePacket extends Packet {
    @nativeField(int32_t)
    type:int32_t;
    @nativeField(CxxString)
    text:CxxString;
    @nativeField(int32_t)
    fadeInTime:int32_t;
    @nativeField(int32_t)
    stayTime:int32_t;
    @nativeField(int32_t)
    fadeOutTime:int32_t;
}
export namespace SetTitlePacket {
    /** @deprecated */
    export const Types = minecraft.SetTitlePacket.Types;
    /** @deprecated */
    export type Types = minecraft.SetTitlePacket.Types;
}

/** @deprecated */
@nativeClass(null)
export class AddBehaviorTreePacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class StructureBlockUpdatePacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class ShowStoreOfferPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class PurchaseReceiptPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class PlayerSkinPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class SubClientLoginPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class WSConnectPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class SetLastHurtByPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class BookEditPacket extends Packet {
    @nativeField(uint8_t)
    type:uint8_t;
    @nativeField(int32_t, 0x34) // It is int32 but is uint8 after serialization
    inventorySlot:int32_t;
    @nativeField(int32_t) // It is int32 but is uint8 after serialization
    pageNumber:int32_t;
    @nativeField(int32_t)
    secondaryPageNumber:int32_t; // It is int32 but is uint8 after serialization
    @nativeField(CxxString)
    text:CxxString;
    @nativeField(CxxString)
    author:CxxString;
    @nativeField(CxxString)
    xuid:CxxString;
}
/** @deprecated */
export namespace BookEditPacket {
    /** @deprecated */
    export const Types = minecraft.BookEditPacket.Types;
    /** @deprecated */
    export type Types = minecraft.BookEditPacket.Types;
}

/** @deprecated */
@nativeClass(null)
export class NpcRequestPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class PhotoTransferPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class ModalFormRequestPacket extends Packet {
    @nativeField(uint32_t)
    id:uint32_t;
    @nativeField(CxxString)
    content:CxxString;
}

/** @deprecated use ModalFormRequestPacket, follow the real class name */
export const ShowModalFormPacket = ModalFormRequestPacket;
/** @deprecated use ModalFormRequestPacket, follow the real class name */
export type ShowModalFormPacket = ModalFormRequestPacket;

/** @deprecated */
@nativeClass(null)
export class ModalFormResponsePacket extends Packet {
    @nativeField(uint32_t)
    id:uint32_t;
    @nativeField(CxxString)
    response:CxxString;
}

/** @deprecated */
@nativeClass(null)
export class ServerSettingsRequestPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class ServerSettingsResponsePacket extends Packet {
    @nativeField(uint32_t)
    id:uint32_t;
    @nativeField(CxxString)
    content:CxxString;
}

/** @deprecated */
@nativeClass(null)
export class ShowProfilePacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class SetDefaultGameTypePacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class RemoveObjectivePacket extends Packet {
    @nativeField(CxxString)
    objectiveName:CxxString;
}

/** @deprecated */
@nativeClass(null)
export class SetDisplayObjectivePacket extends Packet {
    @nativeField(CxxString)
    displaySlot:'list'|'sidebar'|'belowname'|''|DisplaySlot;
    @nativeField(CxxString)
    objectiveName:CxxString;
    @nativeField(CxxString)
    displayName:CxxString;
    @nativeField(CxxString)
    criteriaName:'dummy'|'';
    @nativeField(uint8_t)
    sortOrder:ObjectiveSortOrder;
}

/** @deprecated */
@nativeClass()
export class ScorePacketInfo extends NativeClass {
    @nativeField(ScoreboardId)
    scoreboardId:ScoreboardId;
    @nativeField(CxxString)
    objectiveName:CxxString;

    @nativeField(int32_t)
    score:int32_t;
    @nativeField(uint8_t)
    type:ScorePacketInfo.Type;
    @nativeField(bin64_t)
    playerEntityUniqueId:bin64_t;
    @nativeField(bin64_t)
    entityUniqueId:bin64_t;
    @nativeField(CxxString)
    customName:CxxString;
}

export namespace ScorePacketInfo {
    /** @deprecated */
    export const Type = minecraft.ScorePacketInfo.Type;
    /** @deprecated */
    export type Type = minecraft.ScorePacketInfo.Type;
}

/** @deprecated */
@nativeClass(null)
export class SetScorePacket extends Packet {
    @nativeField(uint8_t)
    type:uint8_t;

    @nativeField(CxxVector.make(ScorePacketInfo))
    entries:CxxVector<ScorePacketInfo>;
}

export namespace SetScorePacket {
    /** @deprecated */
    export const Type = minecraft.SetScorePacket.Type;
    /** @deprecated */
    export type Type = minecraft.SetScorePacket.Type;
}

/** @deprecated */
@nativeClass(null)
export class LabTablePacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class UpdateBlockPacketSynced extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class MoveActorDeltaPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class SetScoreboardIdentityPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class SetLocalPlayerAsInitializedPacket extends Packet {
    @nativeField(ActorRuntimeID)
    actorId: ActorRuntimeID;
}

/** @deprecated */
@nativeClass(null)
export class UpdateSoftEnumPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class NetworkStackLatencyPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class ScriptCustomEventPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class SpawnParticleEffectPacket extends Packet {
    @nativeField(uint8_t)
    dimensionId: uint8_t;
    @nativeField(ActorUniqueID)
    actorId: ActorUniqueID;
    @nativeField(Vec3)
    pos: Vec3;
    @nativeField(CxxString)
    particleName: CxxString;
}

/** @deprecated use SpawnParticleEffectPacket, follow real class name */
export const SpawnParticleEffect = SpawnParticleEffectPacket;
/** @deprecated use SpawnParticleEffectPacket, follow real class name */
export type SpawnParticleEffect = SpawnParticleEffectPacket;

/** @deprecated */
@nativeClass(null)
export class AvailableActorIdentifiersPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class LevelSoundEventPacketV2 extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class NetworkChunkPublisherUpdatePacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class BiomeDefinitionList extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class LevelSoundEventPacket extends Packet {
    @nativeField(uint32_t)
    sound: uint32_t;
    @nativeField(Vec3)
    pos: Vec3;
    @nativeField(int32_t)
    extraData: int32_t;
    @nativeField(CxxString)
    entityType: CxxString;
    @nativeField(bool_t)
    isBabyMob: bool_t;
    @nativeField(bool_t)
    disableRelativeVolume: bool_t;
}

/** @deprecated */
@nativeClass(null)
export class LevelEventGenericPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class LecternUpdatePacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class RemoveEntityPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class ClientCacheStatusPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class OnScreenTextureAnimationPacket extends Packet {
    @nativeField(int32_t)
    animationType: int32_t;
}

/** @deprecated */
@nativeClass(null)
export class MapCreateLockedCopy extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class StructureTemplateDataRequestPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class StructureTemplateDataExportPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class ClientCacheBlobStatusPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class ClientCacheMissResponsePacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class EducationSettingsPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class EmotePacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class MultiplayerSettingsPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class SettingsCommandPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class AnvilDamagePacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class CompletedUsingItemPacket extends Packet {
    @nativeField(int16_t)
    itemId: int16_t;
    @nativeField(int32_t)
    action: CompletedUsingItemPacket.Actions;
}

export namespace CompletedUsingItemPacket {
    /** @deprecated */
    export const Actions = minecraft.CompletedUsingItemPacket.Actions;
    /** @deprecated */
    export type Actions = minecraft.CompletedUsingItemPacket.Actions;
}

/** @deprecated */
@nativeClass(null)
export class NetworkSettingsPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class PlayerAuthInputPacket extends Packet {
    @nativeField(float32_t)
    pitch: float32_t;
    @nativeField(float32_t)
    yaw: float32_t;
    @nativeField(Vec3)
    pos: Vec3;
    @nativeField(float32_t)
    moveX: float32_t;
    @nativeField(float32_t)
    moveZ: float32_t;
    @nativeField(float32_t)
    heaYaw: float32_t;
    @nativeField(bin64_t)
    inputFlags: bin64_t;
    @nativeField(uint32_t)
    inputMode: uint32_t;
    @nativeField(uint32_t)
    playMode: uint32_t;
    @nativeField(Vec3)
    vrGazeDirection: Vec3;
    @nativeField(bin64_t)
    tick: bin64_t;
    @nativeField(Vec3)
    delta: Vec3;
}

/** @deprecated */
@nativeClass(null)
export class CreativeContentPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class PlayerEnchantOptionsPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class ItemStackRequest extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class ItemStackResponse extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class PlayerArmorDamagePacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class CodeBuilderPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class UpdatePlayerGameTypePacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class EmoteListPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class PositionTrackingDBServerBroadcastPacket extends Packet {
    @nativeField(uint8_t)
    action: PositionTrackingDBServerBroadcastPacket.Actions;
    @nativeField(int32_t)
    trackingId: int32_t;
    // TODO: little endian encoded NBT compound tag
}

export namespace PositionTrackingDBServerBroadcastPacket {
    /** @deprecated */
    export const Actions = minecraft.PositionTrackingDBServerBroadcastPacket.Actions;
    /** @deprecated */
    export type Actions = minecraft.PositionTrackingDBServerBroadcastPacket.Actions;
}

/** @deprecated use PositionTrackingDBServerBroadcastPacket, follow the real class name */
export const PositionTrackingDBServerBroadcast = PositionTrackingDBServerBroadcastPacket;
/** @deprecated use PositionTrackingDBServerBroadcastPacket, follow the real class name */
export type PositionTrackingDBServerBroadcast = PositionTrackingDBServerBroadcastPacket;

/** @deprecated */
@nativeClass(null)
export class PositionTrackingDBClientRequestPacket extends Packet {
    @nativeField(uint8_t)
    action: PositionTrackingDBClientRequestPacket.Actions;
    @nativeField(int32_t)
    trackingId: int32_t;
}

export namespace PositionTrackingDBClientRequestPacket {
    /** @deprecated */
    export const Actions = minecraft.PositionTrackingDBClientRequestPacket.Actions;
    /** @deprecated */
    export type Actions = minecraft.PositionTrackingDBClientRequestPacket.Actions;
}

/** @deprecated Use PositionTrackingDBClientRequestPacket, follow the real class name */
export const PositionTrackingDBClientRequest = PositionTrackingDBClientRequestPacket;
/** @deprecated Use PositionTrackingDBClientRequestPacket, follow the real class name */
export type PositionTrackingDBClientRequest = PositionTrackingDBClientRequestPacket;

/** @deprecated */
@nativeClass(null)
export class DebugInfoPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class PacketViolationWarningPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class MotionPredictionHintsPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class AnimateEntityPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class CameraShakePacket extends Packet {
    @nativeField(float32_t)
    intensity:float32_t;
    @nativeField(float32_t)
    duration:float32_t;
    @nativeField(uint8_t)
    shakeType:uint8_t;
    @nativeField(uint8_t)
    shakeAction:uint8_t;
}
export namespace CameraShakePacket {
    /** @deprecated */
    export const ShakeType = minecraft.CameraShakePacket.ShakeType;
    /** @deprecated */
    export type ShakeType = minecraft.CameraShakePacket.ShakeType;
    /** @deprecated */
    export const ShakeAction = minecraft.CameraShakePacket.ShakeAction;
    /** @deprecated */
    export type ShakeAction = minecraft.CameraShakePacket.ShakeAction;
}

/** @deprecated */
@nativeClass(null)
export class PlayerFogPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class CorrectPlayerMovePredictionPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class ItemComponentPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class FilterTextPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class ClientboundDebugRendererPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class SyncActorPropertyPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class AddVolumeEntityPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class RemoveVolumeEntityPacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class SimulationTypePacket extends Packet {
    // unknown
}

/** @deprecated */
@nativeClass(null)
export class NpcDialoguePacket extends Packet {
    /** ActorUniqueID of the Npc */
    @nativeField(ActorUniqueID)
    actorId:ActorUniqueID;
    @nativeField(int32_t)
    action:NpcDialoguePacket.Actions;
    /** Always empty */
    // @nativeField(CxxString, 0x40)
    // dialogue:CxxString;
    // @nativeField(CxxString)
    // sceneName:CxxString;
    // @nativeField(CxxString)
    // npcName:CxxString;
    // @nativeField(CxxString)
    // actionJson:CxxString;

    @nativeField(int64_as_float_t, 0x30)
    actorIdAsNumber:int64_as_float_t;
}

/** @deprecated */
export namespace NpcDialoguePacket {
    /** @deprecated */
    export const Actions = minecraft.NpcDialoguePacket.Actions;
    /** @deprecated */
    export type Actions = minecraft.NpcDialoguePacket.Actions;
}

/** @deprecated */
export const PacketIdToType = {
    [MinecraftPacketIds.Login]: LoginPacket,
    [MinecraftPacketIds.PlayStatus]: PlayStatusPacket,
    [MinecraftPacketIds.ServerToClientHandshake]: ServerToClientHandshakePacket,
    [MinecraftPacketIds.ClientToServerHandshake]: ClientToServerHandshakePacket,
    [MinecraftPacketIds.Disconnect]: DisconnectPacket,
    [MinecraftPacketIds.ResourcePacksInfo]: ResourcePacksInfoPacket,
    [MinecraftPacketIds.ResourcePackStack]: ResourcePackStackPacket,
    [MinecraftPacketIds.ResourcePackClientResponse]: ResourcePackClientResponsePacket,
    [MinecraftPacketIds.Text]: TextPacket,
    [MinecraftPacketIds.SetTime]: SetTimePacket,
    [MinecraftPacketIds.StartGame]: StartGamePacket,
    [MinecraftPacketIds.AddPlayer]: AddPlayerPacket,
    [MinecraftPacketIds.AddActor]: AddActorPacket,
    [MinecraftPacketIds.RemoveActor]: RemoveActorPacket,
    [MinecraftPacketIds.AddItemActor]: AddItemActorPacket,
    [MinecraftPacketIds.TakeItemActor]: TakeItemActorPacket,
    [MinecraftPacketIds.MoveActorAbsolute]: MoveActorAbsolutePacket,
    [MinecraftPacketIds.MovePlayer]: MovePlayerPacket,
    [MinecraftPacketIds.RiderJump]: RiderJumpPacket,
    [MinecraftPacketIds.UpdateBlock]: UpdateBlockPacket,
    [MinecraftPacketIds.AddPainting]: AddPaintingPacket,
    [MinecraftPacketIds.TickSync]: TickSyncPacket,
    [MinecraftPacketIds.LevelSoundEventPa]: LevelSoundEventPacketV1,
    [MinecraftPacketIds.LevelEvent]: LevelEventPacket,
    [MinecraftPacketIds.BlockEvent]: BlockEventPacket,
    [MinecraftPacketIds.ActorEvent]: ActorEventPacket,
    [MinecraftPacketIds.MobEffect]: MobEffectPacket,
    [MinecraftPacketIds.UpdateAttributes]: UpdateAttributesPacket,
    [MinecraftPacketIds.InventoryTransaction]: InventoryTransactionPacket,
    [MinecraftPacketIds.MobEquipment]: MobEquipmentPacket,
    [MinecraftPacketIds.MobArmorEquipment]: MobArmorEquipmentPacket,
    [MinecraftPacketIds.Interact]: InteractPacket,
    [MinecraftPacketIds.BlockPickRequest]: BlockPickRequestPacket,
    [MinecraftPacketIds.ActorPickRequest]: ActorPickRequestPacket,
    [MinecraftPacketIds.PlayerAction]: PlayerActionPacket,
    [MinecraftPacketIds.HurtArmor]: HurtArmorPacket,
    [MinecraftPacketIds.SetActorData]: SetActorDataPacket,
    [MinecraftPacketIds.SetActorMotion]: SetActorMotionPacket,
    [MinecraftPacketIds.SetActorLink]: SetActorLinkPacket,
    [MinecraftPacketIds.SetHealth]: SetHealthPacket,
    [MinecraftPacketIds.SetSpawnPosition]: SetSpawnPositionPacket,
    [MinecraftPacketIds.Animate]: AnimatePacket,
    [MinecraftPacketIds.Respawn]: RespawnPacket,
    [MinecraftPacketIds.ContainerOpen]: ContainerOpenPacket,
    [MinecraftPacketIds.ContainerClose]: ContainerClosePacket,
    [MinecraftPacketIds.PlayerHotbar]: PlayerHotbarPacket,
    [MinecraftPacketIds.InventoryContent]: InventoryContentPacket,
    [MinecraftPacketIds.InventorySlot]: InventorySlotPacket,
    [MinecraftPacketIds.ContainerSetData]: ContainerSetDataPacket,
    [MinecraftPacketIds.CraftingData]: CraftingDataPacket,
    [MinecraftPacketIds.CraftingEvent]: CraftingEventPacket,
    [MinecraftPacketIds.GuiDataPickItem]: GuiDataPickItemPacket,
    [MinecraftPacketIds.AdventureSettings]: AdventureSettingsPacket,
    [MinecraftPacketIds.BlockActorData]: BlockActorDataPacket,
    [MinecraftPacketIds.PlayerInput]: PlayerInputPacket,
    [MinecraftPacketIds.LevelChunk]: LevelChunkPacket,
    [MinecraftPacketIds.SetCommandsEnabled]: SetCommandsEnabledPacket,
    [MinecraftPacketIds.SetDifficulty]: SetDifficultyPacket,
    [MinecraftPacketIds.ChangeDimension]: ChangeDimensionPacket,
    [MinecraftPacketIds.SetPlayerGameType]: SetPlayerGameTypePacket,
    [MinecraftPacketIds.PlayerList]: PlayerListPacket,
    [MinecraftPacketIds.SimpleEvent]: SimpleEventPacket,
    [MinecraftPacketIds.Event]: TelemetryEventPacket,
    [MinecraftPacketIds.SpawnExperienceOrb]: SpawnExperienceOrbPacket,
    [MinecraftPacketIds.ClientboundMapItemData]: MapItemDataPacket,
    [MinecraftPacketIds.MapInfoRequest]: MapInfoRequestPacket,
    [MinecraftPacketIds.RequestChunkRadius]: RequestChunkRadiusPacket,
    [MinecraftPacketIds.ChunkRadiusUpdated]: ChunkRadiusUpdatedPacket,
    [MinecraftPacketIds.ItemFrameDropItem]: ItemFrameDropItemPacket,
    [MinecraftPacketIds.GameRulesChanged]: GameRulesChangedPacket,
    [MinecraftPacketIds.Camera]: CameraPacket,
    [MinecraftPacketIds.BossEvent]: BossEventPacket,
    [MinecraftPacketIds.ShowCredits]: ShowCreditsPacket,
    [MinecraftPacketIds.AvailableCommands]: AvailableCommandsPacket,
    [MinecraftPacketIds.CommandRequest]: CommandRequestPacket,
    [MinecraftPacketIds.CommandBlockUpdate]: CommandBlockUpdatePacket,
    [MinecraftPacketIds.CommandOutput]: CommandOutputPacket,
    [MinecraftPacketIds.ResourcePackDataInfo]: ResourcePackDataInfoPacket,
    [MinecraftPacketIds.ResourcePackChunkData]: ResourcePackChunkDataPacket,
    [MinecraftPacketIds.ResourcePackChunkRequest]: ResourcePackChunkRequestPacket,
    [MinecraftPacketIds.Transfer]: TransferPacket,
    [MinecraftPacketIds.PlaySound]: PlaySoundPacket,
    [MinecraftPacketIds.StopSound]: StopSoundPacket,
    [MinecraftPacketIds.SetTitle]: SetTitlePacket,
    [MinecraftPacketIds.AddBehaviorTree]: AddBehaviorTreePacket,
    [MinecraftPacketIds.StructureBlockUpdate]: StructureBlockUpdatePacket,
    [MinecraftPacketIds.ShowStoreOffer]: ShowStoreOfferPacket,
    [MinecraftPacketIds.PurchaseReceipt]: PurchaseReceiptPacket,
    [MinecraftPacketIds.PlayerSkin]: PlayerSkinPacket,
    [MinecraftPacketIds.SubClientLogin]: SubClientLoginPacket,
    [MinecraftPacketIds.AutomationClientConnect]: WSConnectPacket,
    [MinecraftPacketIds.SetLastHurtBy]: SetLastHurtByPacket,
    [MinecraftPacketIds.BookEdit]: BookEditPacket,
    [MinecraftPacketIds.NpcRequest]: NpcRequestPacket,
    [MinecraftPacketIds.PhotoTransfer]: PhotoTransferPacket,
    [MinecraftPacketIds.ModalFormRequest]: ModalFormRequestPacket,
    [MinecraftPacketIds.ModalFormResponse]: ModalFormResponsePacket,
    [MinecraftPacketIds.ServerSettingsRequest]: ServerSettingsRequestPacket,
    [MinecraftPacketIds.ServerSettingsResponse]: ServerSettingsResponsePacket,
    [MinecraftPacketIds.ShowProfile]: ShowProfilePacket,
    [MinecraftPacketIds.SetDefaultGameType]: SetDefaultGameTypePacket,
    [MinecraftPacketIds.RemoveObjective]: RemoveObjectivePacket,
    [MinecraftPacketIds.SetDisplayObjective]: SetDisplayObjectivePacket,
    [MinecraftPacketIds.SetScore]: SetScorePacket,
    [MinecraftPacketIds.LabTable]: LabTablePacket,
    [MinecraftPacketIds.UpdateBlockPacket]: UpdateBlockPacketSynced,
    [MinecraftPacketIds.MoveActorDelta]: MoveActorDeltaPacket,
    [MinecraftPacketIds.SetScoreboardIdentity]: SetScoreboardIdentityPacket,
    [MinecraftPacketIds.SetLocalPlayerAsInitialized]: SetLocalPlayerAsInitializedPacket,
    [MinecraftPacketIds.UpdateSoftEnum]: UpdateSoftEnumPacket,
    [MinecraftPacketIds.NetworkStackLatency]: NetworkStackLatencyPacket,
    [MinecraftPacketIds.ScriptCustomEvent]: ScriptCustomEventPacket,
    [MinecraftPacketIds.SpawnParticleEffect]: SpawnParticleEffectPacket,
    [MinecraftPacketIds.AvailableActorIdentifiers]: AvailableActorIdentifiersPacket,
    [MinecraftPacketIds.LevelSoundEventPa]: LevelSoundEventPacketV2,
    [MinecraftPacketIds.NetworkChunkPublisherUpdate]: NetworkChunkPublisherUpdatePacket,
    [MinecraftPacketIds.BiomeDefiniti]: BiomeDefinitionList,
    [MinecraftPacketIds.LevelSoundEvent]: LevelSoundEventPacket,
    [MinecraftPacketIds.LevelEventGeneric]: LevelEventGenericPacket,
    [MinecraftPacketIds.LecternUpdate]: LecternUpdatePacket,
    [MinecraftPacketIds.RemoveEntity]: RemoveEntityPacket,
    [MinecraftPacketIds.ClientCacheStatus]: ClientCacheStatusPacket,
    [MinecraftPacketIds.OnScreenTextureAnimation]: OnScreenTextureAnimationPacket,
    [MinecraftPacketIds.MapCreateLock]: MapCreateLockedCopy,
    [MinecraftPacketIds.StructureTemplateDataRequest]: StructureTemplateDataRequestPacket,
    [MinecraftPacketIds.StructureTemplateDataResponse]: StructureTemplateDataExportPacket,
    [MinecraftPacketIds.ClientCacheBlobStatus]: ClientCacheBlobStatusPacket,
    [MinecraftPacketIds.ClientCacheMissResponse]: ClientCacheMissResponsePacket,
    [MinecraftPacketIds.EducationSettings]: EducationSettingsPacket,
    [MinecraftPacketIds.Emote]: EmotePacket,
    [MinecraftPacketIds.MultiplayerSettings]: MultiplayerSettingsPacket,
    [MinecraftPacketIds.SettingsCommand]: SettingsCommandPacket,
    [MinecraftPacketIds.AnvilDamage]: AnvilDamagePacket,
    [MinecraftPacketIds.CompletedUsingItem]: CompletedUsingItemPacket,
    [MinecraftPacketIds.NetworkSettings]: NetworkSettingsPacket,
    [MinecraftPacketIds.PlayerAuthInput]: PlayerAuthInputPacket,
    [MinecraftPacketIds.CreativeContent]: CreativeContentPacket,
    [MinecraftPacketIds.PlayerEnchantOptions]: PlayerEnchantOptionsPacket,
    [MinecraftPacketIds.ItemStackR]: ItemStackRequest,
    [MinecraftPacketIds.ItemStackRe]: ItemStackResponse,
    [MinecraftPacketIds.PlayerArmorDamage]: PlayerArmorDamagePacket,
    [MinecraftPacketIds.CodeBuilder]: CodeBuilderPacket,
    [MinecraftPacketIds.UpdatePlayerGameType]: UpdatePlayerGameTypePacket,
    [MinecraftPacketIds.EmoteList]: EmoteListPacket,
    [MinecraftPacketIds.PositionTrackingDBServerBroadcast]: PositionTrackingDBServerBroadcastPacket,
    [MinecraftPacketIds.PositionTrackingDBClientRequest]: PositionTrackingDBClientRequestPacket,
    [MinecraftPacketIds.DebugInfo]: DebugInfoPacket,
    [MinecraftPacketIds.PacketViolationWarning]: PacketViolationWarningPacket,
    [MinecraftPacketIds.MotionPredictionHints]: MotionPredictionHintsPacket,
    [MinecraftPacketIds.AnimateEntity]: AnimateEntityPacket,
    [MinecraftPacketIds.CameraShake]: CameraShakePacket,
    [MinecraftPacketIds.PlayerFog]: PlayerFogPacket,
    [MinecraftPacketIds.CorrectPlayerMovePrediction]: CorrectPlayerMovePredictionPacket,
    [MinecraftPacketIds.ItemComponent]: ItemComponentPacket,
    [MinecraftPacketIds.FilterText]: FilterTextPacket,
    [MinecraftPacketIds.ClientboundDebugRenderer]: ClientboundDebugRendererPacket,
    [MinecraftPacketIds.SyncActorProperty]: SyncActorPropertyPacket,
    [MinecraftPacketIds.AddVolumeEntity]: AddVolumeEntityPacket,
    [MinecraftPacketIds.RemoveVolumeEntity]: RemoveVolumeEntityPacket,
    [MinecraftPacketIds.SimulationType]: SimulationTypePacket,
    [MinecraftPacketIds.NpcDialogue]: NpcDialoguePacket,
};
(PacketIdToType as any).__proto__ = null;
/** @deprecated */
export type PacketIdToType = {[key in keyof typeof PacketIdToType]:InstanceType<typeof PacketIdToType[key]>};

for (const packetId in PacketIdToType) {
    PacketIdToType[packetId as unknown as keyof PacketIdToType].ID = +packetId;
}
