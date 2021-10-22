import { events } from ".";
import { CANCEL } from "../../common";
import { hook } from "../../hook";
import { Actor, BuildPlatform, CompletedUsingItemPacket, ConnectionRequest, Container, ExtendedCertificate, ItemActor, ItemStack, LoginPacket, MinecraftPacketIds, Player as PlayerRaw } from "../../minecraft";
import { int32_t } from "../../nativetype";
import { _tickCallback } from "../../util";
import { Entity } from "../entity";
import { Item } from "../item";
import { ItemEntity } from "../itementity";
import { Player } from "../player";
import { EntityEvent } from "./entityevent";

export class PlayerEvent {
    constructor(public player: Player) {
    }
}

interface LoginPacketWithConnectionRequest extends LoginPacket {
    connreq:ConnectionRequest;
}

export class PlayerLoginEvent extends PlayerEvent {
    constructor(
        player:Player,

        private readonly packet:LoginPacketWithConnectionRequest) {
        super(player);
    }

    get os():BuildPlatform {
        return this.packet.connreq.getDeviceOS();
    }

    get deviceId():string {
        return this.packet.connreq.getDeviceId();
    }

    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    getRawPacket():LoginPacket {
        return this.packet;
    }
}

export class PlayerDisconnectEvent extends PlayerEvent {
}

export class PlayerAttackEvent extends PlayerEvent {
    victim:Entity;
    private readonly _victimEntity:Entity|null = null;

    constructor(
        player: Player,
        private readonly _victimActor: Actor,
    ) {
        super(player);
    }

    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    getRawVictimEntity():Actor {
        return this._victimEntity !== null ? this._victimEntity.getRawEntity()! : this._victimActor;
    }
}
EntityEvent.defineEntityGetter(PlayerAttackEvent.prototype, 'victim', '_victimEntity', '_victimActor');

export class PlayerDropItemEvent extends PlayerEvent {
    constructor(
        player: Player,
        public item: Item,
    ) {
        super(player);
    }
}

export class PlayerInventoryChangeEvent extends PlayerEvent {
    constructor(
        player: Player,
        readonly oldItem: Item,
        readonly newItem: Item,
        readonly slot:number,
    ) {
        super(player);
    }
}

export class PlayerRespawnEvent extends PlayerEvent {
}

export class PlayerLevelUpEvent extends PlayerEvent {
    constructor(
        player: Player,
        /** Amount of levels upgraded */
        public levels: number,
    ) {
        super(player);
    }
}

export class PlayerJoinEvent extends PlayerEvent {
    constructor(
        player: Player,
    ) {
        super(player);
    }
}

export class PlayerPickupItemEvent extends PlayerEvent {
    constructor(
        player: Player,
        public itemActor: ItemEntity,
    ) {
        super(player);
    }
}

export class PlayerCritEvent extends PlayerEvent {
}

export class PlayerUseItemEvent extends PlayerEvent {
    constructor(
        player: Player,
        public useMethod: PlayerUseItemEvent.Actions,
        public consumeItem: boolean,
        public item: Item
    ) {
        super(player);
    }
}

export namespace PlayerUseItemEvent {
    export import Actions = CompletedUsingItemPacket.Actions;
}

export class PlayerJumpEvent extends PlayerEvent {
}

export class PlayerStartSwimmingEvent extends PlayerEvent {
}

export class PlayerChatEvent extends PlayerEvent {
    constructor(
        player: Player,
        public message:string) {
        super(player);
    }
}


events.playerUseItem.setInstaller(()=>{
    function onPlayerUseItem(this: PlayerRaw, itemStack:ItemStack, useMethod:number, consumeItem:boolean):void {
        const player = Player.fromRaw(this);
        if (player === null) {
            return _onPlayerUseItem.call(this, itemStack, useMethod, consumeItem);
        }
        const item = new Item(itemStack, null);
        const event = new PlayerUseItemEvent(player, useMethod, consumeItem, item);
        events.playerUseItem.fire(event);
        _tickCallback();
        return _onPlayerUseItem.call(event.player.getRawEntity(), event.item.getRawItemStack(), event.useMethod, event.consumeItem);
    }
    const _onPlayerUseItem = hook(PlayerRaw, 'useItem').call(onPlayerUseItem);
});

events.playerCrit.setInstaller(()=>{
    function onPlayerCrit(this: PlayerRaw, actor:Actor):void {
        const player = Player.fromRaw(this);
        if (player === null) {
            return _onPlayerCrit.call(this, actor);
        }
        const event = new PlayerCritEvent(player);
        events.playerCrit.fire(event);
        _tickCallback();
        return _onPlayerCrit.call(event.player.getRawEntity(), actor);
    }
    const _onPlayerCrit = hook(PlayerRaw, '_crit').call(onPlayerCrit);
});

events.playerStartSwimming.setInstaller(()=>{
    function onPlayerStartSwimming(this:PlayerRaw):void {
        const player = Player.fromRaw(this);
        if (player === null) {
            return _onPlayerStartSwimming.call(this);
        }
        const event = new PlayerStartSwimmingEvent(player);
        const canceled = events.playerStartSwimming.fire(event) === CANCEL;
        _tickCallback();
        if (!canceled) {
            return _onPlayerStartSwimming.call(event.player.getRawEntity());
        }
    }
    const _onPlayerStartSwimming = hook(PlayerRaw, 'startSwimming').call(onPlayerStartSwimming);
});


events.playerAttack.setInstaller(()=>{
    function onPlayerAttack(this:PlayerRaw, victim:Actor):boolean {
        const player = Player.fromRaw(this);
        if (player === null) {
            return _onPlayerAttack.call(player, victim);
        }
        const event = new PlayerAttackEvent(player, victim);
        const canceled = events.playerAttack.fire(event) === CANCEL;
        _tickCallback();
        if (canceled) {
            return false;
        }
        return _onPlayerAttack.call(event.player, event.victim);
    }
    const _onPlayerAttack = hook(PlayerRaw, 'attack').call(onPlayerAttack);
});

events.playerDropItem.setInstaller(()=>{
    function onPlayerDropItem(this:PlayerRaw, itemStack:ItemStack, randomly:boolean):boolean {
        const player = Player.fromRaw(this);
        if (player === null) {
            return _onPlayerDropItem.call(this, itemStack, randomly);
        }
        const event = new PlayerDropItemEvent(player, new Item(itemStack, null));
        const canceled = events.playerDropItem.fire(event) === CANCEL;
        _tickCallback();
        if (canceled) {
            return false;
        }
        return _onPlayerDropItem.call(event.player.getRawEntity(), event.item.getRawItemStack(), randomly);
    }
    const _onPlayerDropItem = hook(PlayerRaw, 'drop').call(onPlayerDropItem);
});

events.playerInventoryChange.setInstaller(()=>{
    function onPlayerInventoryChange(this:PlayerRaw, container:Container, slot:number, oldItemStack:ItemStack, newItemStack:ItemStack, unknown:boolean):void {
        const player = Player.fromRaw(this);
        if (player === null) {
            return _onPlayerInventoryChange.call(player, container, slot, oldItemStack, newItemStack, unknown);
        }
        const event = new PlayerInventoryChangeEvent(player, new Item(oldItemStack, null), new Item(newItemStack, null), slot);
        events.playerInventoryChange.fire(event);
        _tickCallback();
        return _onPlayerInventoryChange.call(event.player.getRawEntity(), container, slot, event.oldItem.getRawItemStack(), event.newItem.getRawItemStack(), unknown);
    }
    const _onPlayerInventoryChange = hook(PlayerRaw, 'inventoryChanged').call(onPlayerInventoryChange);
});

events.playerRespawn.setInstaller(()=>{
    function onPlayerRespawn(this:PlayerRaw):void {
        const player = Player.fromRaw(this);
        if (player === null) {
            return _onPlayerRespawn.call(player);
        }
        const event = new PlayerRespawnEvent(player);
        events.playerRespawn.fire(event);
        _tickCallback();
        return _onPlayerRespawn.call(event.player.getRawEntity());
    }
    const _onPlayerRespawn = hook(PlayerRaw, 'respawn').call(onPlayerRespawn);
});

events.playerLevelUp.setInstaller(()=>{
    function onPlayerLevelUp(this:PlayerRaw, levels:int32_t):void {
        const player = Player.fromRaw(this);
        if (player === null) {
            return _onPlayerLevelUp.call(this, levels);
        }
        const event = new PlayerLevelUpEvent(player, levels);
        const canceled = events.playerLevelUp.fire(event) === CANCEL;
        _tickCallback();
        if (canceled) return;
        return _onPlayerLevelUp.call(event.player.getRawEntity(), event.levels);
    }
    const _onPlayerLevelUp = hook(PlayerRaw, "addLevels").call(onPlayerLevelUp);
});

events.playerJoin.setInstaller(()=>{
    events.packetAfter(MinecraftPacketIds.SetLocalPlayerAsInitialized).on((pk, ni) =>{
        const player = Player.fromNetworkIdentifier(ni);
        if (player === null) return;
        const event = new PlayerJoinEvent(player);
        events.playerJoin.fire(event);
    });
});

events.playerPickupItem.setInstaller(()=>{
    function onPlayerPickupItem(this:PlayerRaw, itemActor:ItemActor, orgCount:number, favoredSlot:number):boolean {
        const player = Player.fromRaw(this);
        if (player === null) {
            return _onPlayerPickupItem.call(player, itemActor, orgCount, favoredSlot);
        }
        const event = new PlayerPickupItemEvent(player, ItemEntity.fromRaw(itemActor));
        const canceled = events.playerPickupItem.fire(event) === CANCEL;
        _tickCallback();
        if (canceled) {
            return false;
        }
        return _onPlayerPickupItem.call(event.player.getRawEntity(), itemActor, orgCount, favoredSlot);
    }
    const _onPlayerPickupItem = hook(PlayerRaw, "take").call(onPlayerPickupItem);
});

events.packetAfter(MinecraftPacketIds.Login).on((ptr, ni) => {
    const connreq = ptr.connreq;
    if (connreq === null) return; // wrong client
    const cert = connreq.getCertificate();
    const xuid = ExtendedCertificate.getXuid(cert);
    const username = ExtendedCertificate.getIdentityName(cert);
    const player = new Player(ni, username, xuid);

    const ev = new PlayerLoginEvent(player, ptr as LoginPacketWithConnectionRequest);
    events.playerLogin.fire(ev);
});
events.packetBefore(MinecraftPacketIds.Text).on((ptr, ni)=>{
    const player = Player.fromNetworkIdentifier(ni);
    if (player === null) return;

    const ev = new PlayerChatEvent(player, ptr.message);
    if (events.playerChat.fire(ev) === CANCEL) {
        return CANCEL;
    }
    ptr.message = ev.message;
});
