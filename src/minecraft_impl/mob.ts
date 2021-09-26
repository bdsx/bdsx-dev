
import { Actor, Mob } from "../minecraft";

declare module '../minecraft' {
    interface Mob extends Actor {
        /** @deprecated is Actor constructor */
        constructWith(iLevel:ILevel):void;
        /** @deprecated is Actor constructor */
        constructWith(actorDefinitionGroup:ActorDefinitionGroup|null, actorDefinitionIdentifier:ActorDefinitionIdentifier):void;

    }
}

(Mob as any).__proto__ = Actor;
