
import { Block as BlockRaw } from '../minecraft';

export class Block {
    constructor(private readonly block:BlockRaw) {
    }

    /**
     * @deprecated compatibility warning. it returns the native class of Bedrock Dedicated Server. it can be modified by updates.
     */
    getRawBlock():BlockRaw {
        return this.block;
    }
}
