import { int32_t } from "../../nativetype";
import { MCRESULT } from "..";

declare module ".." {
    interface MCRESULT {
        result:int32_t;

        getFullCode():int32_t;
        isSuccess():boolean;
    }
    namespace MCRESULT {
        function create(result:int32_t):MCRESULT;
    }
}

MCRESULT.define({
    result:int32_t
});

MCRESULT.create = function(result:int32_t):MCRESULT {
    const out = new MCRESULT(true);
    out.result = result;
    return out;
};
