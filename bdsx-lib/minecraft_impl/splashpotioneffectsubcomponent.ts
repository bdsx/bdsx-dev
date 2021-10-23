import { OnHitSubcomponent, SplashPotionEffectSubcomponent } from "../minecraft";
import { int32_t } from "../nativetype";
import "./onhitsubcomponent";

declare module "../minecraft" {
    interface SplashPotionEffectSubcomponent extends OnHitSubcomponent {
        potionEffect: int32_t;
    }
}

SplashPotionEffectSubcomponent.setExtends(OnHitSubcomponent);
SplashPotionEffectSubcomponent.abstract({
    potionEffect:int32_t,
});