
const { DNFDB } = require('../dnf/dnfreader');
const path = require('path');

const db = new DNFDB(path.join(__dirname, 'minecraft.dnfdb'));
db.readNamespace(module.exports);

require('./enums');
require('./ext.all');
