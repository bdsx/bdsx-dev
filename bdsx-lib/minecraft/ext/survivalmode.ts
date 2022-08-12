import { GameMode, SurvivalMode } from "..";

declare module ".." {
    interface SurvivalMode extends GameMode {
    }
}

(SurvivalMode as any).__proto__ = GameMode;
(SurvivalMode as any).prototype.__proto__ = GameMode.prototype;
