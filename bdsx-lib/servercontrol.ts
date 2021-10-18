
import { bedrockServer } from "./launcher";

export const serverControl = {
    stop():void {
        bedrockServer.stop();
    }
};
