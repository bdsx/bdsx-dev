import { bool_t, int32_t } from "../../nativetype";
import { Objective, ScoreInfo } from "..";

declare module ".." {
    interface ScoreInfo {
        objective:Objective|null;
        valid:bool_t;
        value:int32_t;
    }
}

ScoreInfo.define({
    objective:Objective.ref(),
    valid:bool_t,
    value:int32_t,
});
