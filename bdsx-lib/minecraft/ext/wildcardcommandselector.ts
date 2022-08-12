import { NativeTemplateClass } from "../../complextype";
import { NativeType } from "../../nativetype";
import { inheritMultiple } from "../../util";
import { Actor, CommandSelectorBase, WildcardCommandSelector } from "..";

declare module ".." {
    interface WildcardCommandSelector<T extends Actor> extends CommandSelectorBase {
    }
}
WildcardCommandSelector.setExtends(CommandSelectorBase);
inheritMultiple(WildcardCommandSelector, NativeTemplateClass);

WildcardCommandSelector.make(Actor).prototype[NativeType.ctor] = function() {
    CommandSelectorBase.prototype.constructWith.call(this, false);
};
