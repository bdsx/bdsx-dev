import { makefunc } from "../makefunc";
import { CommandFlag } from "../minecraft";
import { int32_t } from "../nativetype";

declare module "../minecraft" {
    interface CommandFlag {
        value:int32_t;
    }
    namespace CommandFlag {
        function create(value:number):CommandFlag;
    }
}

CommandFlag[makefunc.registerDirect] = true;
CommandFlag.define({
    value:int32_t,
});

CommandFlag.create = function(value:number):CommandFlag {
    const flag = new CommandFlag(true);
    flag.value = value;
    return flag;
};
