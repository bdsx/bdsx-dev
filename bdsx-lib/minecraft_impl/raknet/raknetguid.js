"use strict";
exports.__esModule = true;
var minecraft_1 = require("../../minecraft");
var nativetype_1 = require("../../nativetype");
minecraft_1.RakNet.RakNetGUID.define({
    g: nativetype_1.bin64_t,
    systemIndex: nativetype_1.uint16_t
});
