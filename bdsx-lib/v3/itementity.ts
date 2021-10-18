import { ItemActor } from "../minecraft";
import { Entity } from "./entity";

export class ItemEntity extends Entity {
    static fromRaw(actor:ItemActor):Entity {
        const entity = super.fromRaw(actor);
        if (entity == null) throw Error(`is not ItemEntity [${actor.constructor.name}:${actor}]`);
        return entity;
    }
}

Entity.registerMapper(ItemActor, actor=>new ItemEntity(actor));
