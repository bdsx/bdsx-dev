import { Actor, CommandSelectorBase, WildcardCommandSelector } from "../minecraft";
import { NativeType } from "../nativetype";

declare module "../minecraft" {
    interface WildcardCommandSelector<T extends Actor> extends CommandSelectorBase {
    }
}
WildcardCommandSelector.setExtends(CommandSelectorBase);

WildcardCommandSelector.make(Actor).prototype[NativeType.ctor] = function() {
    CommandSelectorBase.prototype.constructWith.call(this, false);
};
