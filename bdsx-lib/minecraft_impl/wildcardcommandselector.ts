import { NativeTemplateClass } from "../complextype";
import { Actor, CommandSelectorBase, WildcardCommandSelector } from "../minecraft";
import { NativeType } from "../nativetype";
import { inheritMultiple } from "../util";

declare module "../minecraft" {
    interface WildcardCommandSelector<T extends Actor> extends CommandSelectorBase {
    }
}
WildcardCommandSelector.setExtends(CommandSelectorBase);
inheritMultiple(WildcardCommandSelector, NativeTemplateClass);

WildcardCommandSelector.make(Actor).prototype[NativeType.ctor] = function() {
    CommandSelectorBase.prototype.constructWith.call(this, false);
};
