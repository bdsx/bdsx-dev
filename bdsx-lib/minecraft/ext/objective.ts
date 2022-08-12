import { CxxString } from "../../nativetype";
import { Objective, ObjectiveCriteria } from "..";

declare module ".." {
    interface Objective {
        name:CxxString;
        displayName:CxxString;
        criteria:ObjectiveCriteria;
    }
}

Objective.abstract({
    name:[CxxString, 0x40],
    displayName:CxxString,
    criteria:ObjectiveCriteria.ref(),
});
