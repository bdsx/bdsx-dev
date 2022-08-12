import { VoidPointer } from "../../core";
import { SharedPtr as SharedPtr2 } from "../../sharedpointer";
import { NetworkHandler, RakNetInstance } from "..";

declare module ".." {
    interface NetworkHandler {
        vftable:VoidPointer;
        instance:RakNetInstance;

        send(ni:NetworkIdentifier, packet:Packet, senderSubClientId:number):void;
    }
    namespace NetworkHandler {
        interface Connection {
            networkIdentifier:NetworkIdentifier;
            u1:VoidPointer;
            u2:VoidPointer;
            u3:VoidPointer;
            epeer:SharedPtr2<EncryptedNetworkPeer>;
            bpeer:SharedPtr2<BatchedNetworkPeer>;
            bpeer2:SharedPtr2<BatchedNetworkPeer>;
        }
    }
}

NetworkHandler.abstract({
    vftable: VoidPointer,
    instance: [RakNetInstance.ref(), 0x48]
});
