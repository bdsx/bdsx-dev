import { GameRuleId } from "../minecraft";
import { int32_t } from "../nativetype";


declare module "../minecraft" {
    interface GameRuleId {
        value:int32_t;
    }
}

GameRuleId.define({
    value:int32_t,
});
