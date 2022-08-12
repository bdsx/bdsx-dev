import { Actor, HealthAttributeDelegate } from "..";

declare module ".." {
    interface HealthAttributeDelegate {
        actor:Actor;
    }
}

HealthAttributeDelegate.abstract({
    actor:[Actor, 0x20],
});
