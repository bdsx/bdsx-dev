
import { bool_t, Type } from "../../nativetype";
import { Actor, Mob } from "..";

declare module ".." {
    interface Mob extends Actor {
        /** @deprecated is Actor constructor */
        constructWith(iLevel:ILevel):void;
        /** @deprecated is Actor constructor */
        constructWith(actorDefinitionGroup:ActorDefinitionGroup|null, actorDefinitionIdentifier:ActorDefinitionIdentifier):void;

        hasComponent(T0:Type<ProjectileComponent>):()=>bool_t;
    }
}

(Mob as any).__proto__ = Actor;
