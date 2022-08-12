import { int32_t } from "../../nativetype";
import { ExtendedStreamReadResult } from "..";

declare module ".." {

    interface ExtendedStreamReadResult {
        streamReadResult:StreamReadResult;
    }

}

ExtendedStreamReadResult.abstract({
    streamReadResult:int32_t,
});

