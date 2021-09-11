

import path = require('path');
import { fsutil } from '../bdsx/bdsx/fsutil';

const asm = path.join(__dirname, 'asmcode.asm');
const js = path.join(__dirname, '../bdsx/bdsx/asm/asmcode.js');
if (fsutil.checkModifiedSync(asm, js)) {
    require('./compile');
}
