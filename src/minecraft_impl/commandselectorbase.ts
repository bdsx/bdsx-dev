import { Actor, CommandOrigin, CommandSelectorBase } from "../minecraft";


declare module "../minecraft" {
    interface CommandSelectorBase {
        newResultsArray(origin:CommandOrigin):Actor[];
    }
}

CommandSelectorBase.prototype.newResultsArray = function(origin:CommandOrigin):Actor[] {
    const list = this.newResults(origin);
    const actors = list.p!;
    list.dispose();
    return actors;
};

CommandSelectorBase.define({}, 0xc0);
