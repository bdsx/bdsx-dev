import { hook } from "../../hook";
import { int32_t, void_t } from "../../nativetype";
import { SharedPtr as BdsxSharedPtr } from "../../sharedpointer";
import { MinecraftPackets, Packet } from "..";
import { minecraftTsReady } from "../ext_ready";

declare module ".." {
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
