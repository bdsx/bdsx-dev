import { ItemStack, Item as ItemRaw, Block } from "../minecraft";


export class Item {
    constructor(
        private itemStack:ItemStack|null,
        private item:ItemRaw|null) {
        if (itemStack === null && item === null) throw Error(`both cannot be null`);
    }

    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    getRawItemStack():ItemStack {
        if (this.itemStack !== null) return this.itemStack;
        const itemStack = new ItemStack(true);
        itemStack.constructWith(this.item!);
        this.itemStack = itemStack;

        setImmediate(()=>{
            itemStack.destruct();
            this.itemStack = null;
        });
        return itemStack;
    }

    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    getRawItem():ItemRaw {
        if (this.item !== null) return this.item;
        return this.item = this.itemStack!.getItem();
    }

    get isBlock():boolean {
        const itemStack = this.getRawItemStack();
        return itemStack.vftable === Block.vftable;
    }

    get id():ItemId {
        const item = this.getRawItem();
        if (item != null) {
            const Name = item.getCommandName();
            if (Name.includes(':')) return Name as any;
            else return 'minecraft:' + Name as any;
        }
        return 'minecraft:air';
    }
}

