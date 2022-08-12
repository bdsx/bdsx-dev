import { VoidPointer } from "../../core";
import { CxxVector } from "../../cxxvector";
import { Level, ServerPlayer } from "..";

declare module ".." {
    interface Level {
        vftable:VoidPointer;
        players:CxxVector<ServerPlayer>;

        destroyBlock(blockSource:BlockSource, blockPos:BlockPos, dropResources:boolean):boolean;
        fetchEntity(id:ActorUniqueID, fetchRemovedActor:boolean):Actor|null;
    }
}

Level.abstract({
    vftable: VoidPointer,
    players:[CxxVector.make(ServerPlayer.ref()), 0x58],
});
