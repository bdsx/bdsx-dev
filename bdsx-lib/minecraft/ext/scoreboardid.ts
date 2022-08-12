import { bin64_t, int64_as_float_t } from "../../nativetype";
import { IdentityDefinition, ScoreboardId } from "..";

declare module ".." {
    interface ScoreboardId {
        id:bin64_t;
        idAsNumber:int64_as_float_t;
        identityDef:IdentityDefinition;
    }
}

ScoreboardId.define({
    id:bin64_t,
    idAsNumber:int64_as_float_t,
    identityDef:IdentityDefinition.ref(),
});
