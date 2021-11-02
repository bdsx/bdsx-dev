import { hook } from "../hook";
import { MinecraftPackets, Packet } from "../minecraft";
import { int32_t, void_t } from "../nativetype";
import { SharedPtr as BdsxSharedPtr } from "../sharedpointer";
import { minecraftTsReady } from "./ready";

declare module "../minecraft" {
    namespace MinecraftPackets {
        /**
         * receive the parameter instead of structureReturn:true
         */
        function createPacketRaw(out:BdsxSharedPtr<Packet>, packetId:MinecraftPacketIds):void;
    }
}

minecraftTsReady(()=>{
    MinecraftPackets.createPacketRaw = hook(MinecraftPackets.createPacket).reform(void_t, null, BdsxSharedPtr.make(Packet), int32_t);
});
