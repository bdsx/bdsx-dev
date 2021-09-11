
import './asm/checkasm';
import path = require('path');
process.argv[1] = path.join(__dirname, 'bdsx');
import './bdsx/launcher';
