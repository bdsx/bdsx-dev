import { AttributeId } from "../../enums";

declare module ".." {
    interface BaseAttributeMap {
        getMutableInstance(type:AttributeId):AttributeInstance|null;
    }
}
