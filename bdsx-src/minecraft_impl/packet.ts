import { makefunc } from "../makefunc";
import { BinaryStream, ExtendedStreamReadResult, MinecraftPacketIds, MinecraftPackets, networkHandler, NetworkIdentifier, Packet, ReadOnlyBinaryStream } from "../minecraft";
import { MantleClass } from "../nativeclass";
import { CxxString, int32_t, uint32_t, void_t } from "../nativetype";
import { SharedPtr as BdsxSharedPtr } from "../sharedpointer";
import './networkhandler';

const PacketReadResult = uint32_t.extends({
    PacketReadNoError: 0,
    PacketReadError: 1,
});
type PacketReadResult = uint32_t;

const StreamReadResult = int32_t.extends({
    Disconnect: 0,
    Pass: 1,
    Warning: 2, // disconnect at 3 times
    Ignore: 0x7f,
});
type StreamReadResult = int32_t;

const sharedptr_of_packet = Symbol('sharedptr');

declare module "../minecraft" {
    interface ExtendedStreamReadResult {
        streamReadResult:StreamReadResult;
        dummy:int32_t;
        // array?
    }

    interface Packet extends MantleClass {
        [sharedptr_of_packet]?:BdsxSharedPtr<any>|null;

        getId():MinecraftPacketIds;
        getName():CxxString;
        write(stream:BinaryStream):void;
        read(stream:BinaryStream):PacketReadResult;
        readExtended(readOnlyBinaryStream:ReadOnlyBinaryStream):ExtendedStreamReadResult;

        /**
         * same with target.send
         */
        sendTo(target:NetworkIdentifier, unknownarg?:number):void;
        dispose():void;
    }

    namespace Packet {
        const ID:number;

        function create<T extends Packet>(this:{new(alloc?:boolean):T, ID:MinecraftPacketIds, ref():any}):T;
    }
}

ExtendedStreamReadResult.define({
    streamReadResult:StreamReadResult,
    dummy:int32_t,
});

Packet.prototype.dispose = function() {
    this[sharedptr_of_packet]!.dispose();
    this[sharedptr_of_packet] = null;
};

Packet.create = function<T extends Packet>(this:{new(alloc?:boolean):T, ID:MinecraftPacketIds, ref():any}):T {
    const id = this.ID;
    if (id === undefined) throw Error('Packet class is abstract, please use named class instead (ex. LoginPacket)');
    const sharedptr = MinecraftPackets.createPacket(id);

    const packet = sharedptr.p as T;
    if (packet === null) throw Error(`${this.name} is not created`);
    packet[sharedptr_of_packet] = sharedptr;
    return packet;
};

Packet.prototype.sendTo = function(target:NetworkIdentifier, unknownarg:number=0):void {
    networkHandler.send(target, this, unknownarg);
};
Packet.prototype.destruct = makefunc.js([0x0], void_t, {this:Packet});
Packet.prototype.getId = makefunc.js([0x8], int32_t, {this:Packet});
Packet.prototype.getName = makefunc.js([0x10], CxxString, {this:Packet, structureReturn: true});
Packet.prototype.write = makefunc.js([0x18], void_t, {this:Packet}, BinaryStream);
Packet.prototype.read = makefunc.js([0x20], int32_t, {this:Packet}, BinaryStream);
Packet.prototype.readExtended = makefunc.js([0x28], ExtendedStreamReadResult, {this:Packet, structureReturn: true}, ReadOnlyBinaryStream);
