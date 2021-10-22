import { ItemStack, PlayerInventory } from "../minecraft";


export class Inventory {
    private _slotsArray:ItemStack[]|null = null;

    constructor(private readonly inventory:PlayerInventory) {
    }

    private _slots():ItemStack[] {
        // assume that it's same until the end of the JS processing.
        if (this._slotsArray !== null) return this._slotsArray;
        this._slotsArray = this.inventory.getSlots(); // it will process through the entire inventory, reduce to call it for optimizing.
        process.nextTick(()=>{
            this._slotsArray = null;
        });
        return this._slotsArray;
    }

    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    getRawContainer():PlayerInventory {
        return this.inventory;
    }

    get size():number {
        return this._slots().length;
    }

    get(i:number):ItemStack {
        return this._slots()[i];
    }
}
