import { makefunc } from "../../makefunc";
import { int32_t } from "../../nativetype";
import { CommandFlag } from "..";

declare module ".." {
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
