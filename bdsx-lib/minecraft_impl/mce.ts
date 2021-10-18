import { StaticPointer } from "../core";
import { dll } from "../dll";
import { Crypto, mce } from "../minecraft";
import { bin64_t, int32_t, uint16_t, uint32_t, uint64_as_float_t, uint8_t } from "../nativetype";
import { hex } from "../util";

declare module "../minecraft" {
    namespace mce {
        interface UUID {
            v1:int32_t;
            v2:uint16_t;
            v3:uint16_t;
            v4:bin64_t;
            equals(other:UUID):boolean;
            toString():string;
        }
        namespace UUID {
            /**
             * @alias Crypto.Random.generateUUID
             */
            function generate():UUID;
        }

        interface Blob {
            /** @deprecated Has to be confirmed working */
            bytes:StaticPointer;
            size:uint64_as_float_t;
        }

        interface Image {
            imageFormat:uint32_t;
            width:uint32_t;
            height:uint32_t;
            usage:uint8_t;
            blob:mce.Blob;
        }
    }
}

mce.UUID.define({
    v1:int32_t,
    v2:uint16_t,
    v3:uint16_t,
    v4:bin64_t,
});

mce.UUID.prototype.toString = function() {
    const ptr = this as any as StaticPointer;
    const n1 = hex.format(ptr.getInt32(0), 8);
    const n2 = hex.format(ptr.getInt32(4), 8);
    const n3 = hex.format(ptr.getInt32(8), 8);
    const n4 = hex.format(ptr.getInt32(12), 8);

    const u2 = n2.substr(0, 4);
    const u3 = n2.substr(4, 4);
    const u4 = n3.substr(0, 4);
    const u5 = n3.substr(4, 4)+n4;
    return `${n1}-${u2}-${u3}-${u4}-${u5}`;
};

mce.Blob.define({
    bytes:StaticPointer,
    size:uint64_as_float_t,
});

mce.UUID.prototype.equals = function(other:mce.UUID):boolean {
    return dll.vcruntime140.memcmp(this, other, 16) === 0;
};
mce.UUID.generate = function() {
    return Crypto.Random.generateUUID();
};

mce.Image.define({
    imageFormat:uint32_t,
    width:uint32_t,
    height:uint32_t,
    usage:uint8_t,
    blob:mce.Blob,
});
