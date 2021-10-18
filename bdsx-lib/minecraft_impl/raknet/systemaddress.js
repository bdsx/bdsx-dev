"use strict";
exports.__esModule = true;
var minecraft_1 = require("../../minecraft");
var nativetype_1 = require("../../nativetype");
var portDelineator = '|'.charCodeAt(0);
minecraft_1.RakNet.SystemAddress.define({
    systemIndex: [nativetype_1.uint16_t, 130]
}, 136);
minecraft_1.RakNet.SystemAddress.toString = function () {
    var dest = Buffer.alloc(128);
    this.ToString(true, dest, portDelineator);
    var len = dest.indexOf(0);
    if (len === -1)
        throw Error('SystemAddress.ToString failed, null character not found');
    return dest.subarray(0, len).toString();
};
