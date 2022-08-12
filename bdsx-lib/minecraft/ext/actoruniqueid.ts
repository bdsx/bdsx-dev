import { bin64_t, int32_t } from "../../nativetype";
import { ActorUniqueID } from "..";

declare module ".." {
    interface ActorUniqueID {
        value:bin64_t;
        lowBits:number;
        highBits:number;

        equals(other:ActorUniqueID):boolean;
    }
    namespace ActorUniqueID {
        function create(lowBits:number, highBits:number):ActorUniqueID;
        function create(value:bin64_t):ActorUniqueID;
    }
}

ActorUniqueID.define({
    value: bin64_t,
    lowBits: [int32_t, 0],
    highBits: [int32_t, 0],
});
ActorUniqueID.create = function(value:bin64_t|number, highBits?:number):ActorUniqueID {
    const out = new ActorUniqueID(true);
    if (highBits != null) {
        out.lowBits = +value;
        out.highBits = highBits;
    } else {
        out.value = value+'';
    }
    return out;
};
ActorUniqueID.prototype.equals = function(other:ActorUniqueID):boolean {
    return this.lowBits === other.lowBits && this.highBits === other.highBits;
};
