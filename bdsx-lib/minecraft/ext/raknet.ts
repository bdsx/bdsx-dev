import { VoidPointer } from "../../core";
import { uint16_t, bin64_t } from "../../nativetype";
import { RakNet } from "..";

declare module ".." {
    namespace RakNet {
        interface AddressOrGUID {
            rakNetGuid:RakNetGUID;
            systemAddress:SystemAddress;

            GetSystemIndex():uint16_t;
        }
        interface RakNetGUID {
            g:bin64_t;
            systemIndex:uint16_t;
        }
        interface RakPeer {
            vftable:VoidPointer;
        }
        interface SystemAddress {
            systemIndex:uint16_t;
            toString():string;
        }
    }
}

RakNet.AddressOrGUID.define({
    rakNetGuid:RakNet.RakNetGUID,
    systemAddress:RakNet.SystemAddress,
});

RakNet.AddressOrGUID.prototype.GetSystemIndex = function():uint16_t {
    const rakNetGuid = this.rakNetGuid;
    if (rakNetGuid.g !== RakNet.UNASSIGNED_RAKNET_GUID.g) {
        return rakNetGuid.systemIndex;
    } else {
        return this.systemAddress.systemIndex;
    }
};

RakNet.RakNetGUID.define({
    g:bin64_t,
    systemIndex:uint16_t,
});

RakNet.RakPeer.define({
    vftable:VoidPointer
});

const portDelineator = 0x7c; // '|'

RakNet.SystemAddress.define({
    systemIndex: [uint16_t, 130]
}, 136);

RakNet.SystemAddress.toString = function(this:RakNet.SystemAddress):string {
    const dest = Buffer.alloc(128);
    this.ToString(true, dest, portDelineator);
    const len = dest.indexOf(0);
    if (len === -1) throw Error('SystemAddress.ToString failed, null character not found');
    return dest.subarray(0, len).toString();
};
