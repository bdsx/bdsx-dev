import { int32_t, uint32_t } from "../../nativetype";
import { Wrapper } from "../../pointer";
import { ScoreboardId, ScoreboardIdentityRef } from "..";

declare module ".." {
    interface ScoreboardIdentityRef {
        objectiveReferences:uint32_t;
        scoreboardId:ScoreboardId;

        modifyScoreInObjective(result:Wrapper<int32_t>, objective:Objective, score:number, action:PlayerScoreSetFunction):boolean;
    }
}
ScoreboardIdentityRef.define({
    objectiveReferences:uint32_t,
    scoreboardId:ScoreboardId,
});
