import { Item } from "..";

declare module ".." {
    interface Item {
        getCommandName():string;
    }
}

Item.prototype.getCommandName = function():string {
    const names = this.getCommandNames();
    const name = names[0];
    if (name == null) throw Error(`item has not any names`);
    return name.name;
};
