import { remapAndPrintError } from "../bdsx/bdsx/source-map-support";

try {
    require('./symbolwriter');
} catch (err) {
    remapAndPrintError(err);
}
