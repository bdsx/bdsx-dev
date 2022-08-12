import { int32_t } from "../../nativetype";
import { GameRuleId } from "..";


declare module ".." {
    interface GameRuleId {
        value:int32_t;
    }
}

GameRuleId.define({
    value:int32_t,
});
