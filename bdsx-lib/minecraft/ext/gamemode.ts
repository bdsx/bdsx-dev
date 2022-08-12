
import { Actor, GameMode } from "..";

declare module ".." {
    interface GameMode {
        actor:Actor;
    }
}

GameMode.define({
    actor: [Actor.ref(), 8]
});
