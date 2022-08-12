import { int32_t } from "../../nativetype";
import { OnHitSubcomponent, SplashPotionEffectSubcomponent } from "..";
import "./onhitsubcomponent";

declare module ".." {
    interface SplashPotionEffectSubcomponent extends OnHitSubcomponent {
        potionEffect: int32_t;
    }
}

SplashPotionEffectSubcomponent.setExtends(OnHitSubcomponent);
SplashPotionEffectSubcomponent.abstract({
    potionEffect:int32_t,
});
