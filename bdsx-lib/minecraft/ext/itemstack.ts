import { VoidPointer } from "../../core";
import { CxxVector } from "../../cxxvector";
import { bin64_t, bool_t, int16_t, uint8_t } from "../../nativetype";
import { Block, BlockLegacy, CompoundTag, Item, ItemStack, ItemStackBase } from "..";

declare module ".." {
    interface ItemStack extends ItemStackBase {
        vftable:VoidPointer;
        item:Item;
        userData: CompoundTag;
        block:Block;
        aux:int16_t;
        amount:uint8_t;
        valid:bool_t;
        pickupTime:bin64_t;
        showPickup:bool_t;
        canPlaceOnList:CxxVector<BlockLegacy>;
        canDestroyList:CxxVector<BlockLegacy>;

        getCommandName():string;

        /**
         * Value is applied only to Damageable items
         */
        setDamageValue(value:number):void

        /**
         * it returns the enchantability.
         * (See enchantability on https://minecraft.fandom.com/wiki/Enchanting_mechanics)
         */
        getEnchantValue(): number;
    }

    namespace ItemStack {
        /**
         * @param itemName Formats like 'minecraft:apple' and 'apple' are both accepted, even if the name does not exist, it still returns an ItemStack
         */
        function create(itemName:string, amount?:number, data?:number):ItemStack;
    }
}

ItemStack.setExtends(ItemStackBase);
ItemStack.abstract({
    vftable:VoidPointer, // 0x00
    item:Item.ref(), // 0x08
    userData:CompoundTag.ref(), // 0x10
    block:Block.ref(), // 0x18
    aux:int16_t, // 0x20
    amount:uint8_t, // 0x22
    valid:bool_t, // 0x23
    pickupTime:bin64_t, // 0x28
    showPickup:bool_t, // 0x30
    canPlaceOnList:CxxVector.make(BlockLegacy.ref()), // 0x38
    // something at 0x50
    canDestroyList:[CxxVector.make(BlockLegacy.ref()), 0x58],
}, 0x89);
