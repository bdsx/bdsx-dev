import { Actor, CommandPermissionLevel, NetworkIdentifier, Packet, Player as PlayerRaw, ServerPlayer, TextPacket } from "../minecraft";
import { Entity } from "./entity";
import { events } from "./events";
import { system } from "./system";
import colors = require('colors');
import { Inventory } from "./inventory";

interface PlayerComponentClass {
    new(player:Player):PlayerComponent;
    available?(player:Player):boolean;
}

export class PlayerComponent {
    constructor(public readonly player:Player) {
    }

    /**
     * check if it's available for the specific player.
     */
    static available?(player:Player):boolean;

    /**
     * register this component class.
     * it will add the component to all Player instances.
     * can be filtered with UserComponent.available.
     */
    static register(this:PlayerComponentClass):void {
        components.push(this);
        for (const player of namemap.values()) {
            if (this.available != null && !this.available(player)) continue;
            player.addComponent(this);
        }
    }
}

const components:PlayerComponentClass[] = [];
const namemap = new Map<string, Player>();
const xuidmap = new Map<string, Player>();
const entityidmap = new Map<number, Player>();
const playerKey = Symbol('player');

interface NetworkIdentifierX extends NetworkIdentifier {
    [playerKey]?:PlayerNew;
}

export class Player extends Entity {
    /** it can be undefined if the player entity is not created */
    public entity:IEntity;

    protected actor:ServerPlayer|null;
    private _inv:Inventory|null;

    private readonly components = new Map<PlayerComponentClass, PlayerComponent>();

    constructor(
        private readonly networkIdentifier:NetworkIdentifierX,
        private readonly _name:string,
        public readonly xuid:string) {
        super(null);

        networkIdentifier[playerKey] = this;
        namemap.set(_name, this);
        xuidmap.set(xuid, this);
        this.ip;
    }

    protected actorMust():ServerPlayer {
        if (this.actor === null) throw Error(`${this}'s actor is not ready`);
        return this.actor as ServerPlayer;
    }

    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    sendPacket(packet:Packet):void {
        packet.sendTo(this.networkIdentifier);
    }

    get disconnected():boolean {
        return false;
    }

    get name():string {
        return this._name;
    }

    get ip():string {
        const ipport = this.networkIdentifier.toString();
        const idx = ipport.indexOf('|');
        return (idx !== -1) ? ipport.substr(0, idx) : ipport;
    }

    get inventory():Inventory {
        if (this._inv !== null) return this._inv;
        const inv = this.actorMust().getSupplies();
        return this._inv = new Inventory(inv);
    }

    addComponent(componentClass:PlayerComponentClass):PlayerComponent {
        let component = this.components.get(componentClass);
        if (component == null) {
            this.components.set(componentClass, component = new componentClass(this));
        }
        return component;
    }

    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    getRawNetworkIdentifier():NetworkIdentifier {
        return this.networkIdentifier;
    }

    getRawEntity():PlayerRaw|null {
        return super.getRawEntity() as PlayerRaw;
    }

    getCommandPermissionLevel():CommandPermissionLevel {
        return this.actorMust().getCommandPermissionLevel();
    }

    message(message:string):void {
        if (this.disconnected) return;
        const textPacket = TextPacket.create();
        textPacket.message = message;
        textPacket.sendTo(this.networkIdentifier);
        textPacket.dispose();
    }

    toString():string {
        return `[${this._name} Player]`;
    }

    static all():IterableIterator<Player> {
        return namemap.values();
    }
    static *fromIP(ipaddr:string):IterableIterator<Player> {
        for (const player of namemap.values()) {
            if (player.ip === ipaddr) yield player;
        }
    }
    static fromName(name:string):Player|null {
        return namemap.get(name) || null;
    }
    static fromXuid(xuid:string):Player|null {
        return xuidmap.get(xuid) || null;
    }
    static fromEntity(entity:IEntity):Player|null {
        return entityidmap.get(entity.id) || null;
    }
    static fromNetworkIdentifier(networkIdentifier:NetworkIdentifierX):Player|null {
        return networkIdentifier[playerKey] || null;
    }
    static fromRaw(actor:Actor):Player|null {
        const entity = super.fromRaw(actor);
        return entity instanceof Player ? entity : null;
    }
}
type PlayerNew = Player;

events.serverOpen.on(()=>{
    system.listenForEvent('minecraft:entity_created', ev=>{
        const entity = ev.data.entity;
        if (entity.__identifier__ !== 'minecraft:player') return;
        const nameable = system.getComponent(entity, 'minecraft:nameable');
        if (nameable === null) return;
        const player = namemap.get(nameable.data.name);
        if (player == null) {
            console.error(colors.red(`player not found on entity_created (name=${nameable.data.name})`));
            return;
        }
        player.entity = entity;
    });
});

Entity.registerMapper(PlayerRaw, actor=>{
    const name = actor.getNameTag();
    return namemap.get(name) || null;
});
