//@ts-check

const { bundle } = require('if-tsb');
const path = require('path');

/**
 * @param {string} input
 */
function bundlerun(input) {
    const inputParsed = path.parse(input);
    const output = path.resolve(inputParsed.dir+path.sep+inputParsed.name+'.bundle');

    const tsconfig = bundle.getTsConfig();
    tsconfig.entry = { [input]: output+'.js' };
    if (tsconfig.bundlerOptions == null) tsconfig.bundlerOptions = {};
    tsconfig.bundlerOptions.faster = true;
    tsconfig.compilerOptions.declaration = false;
    bundle(null, tsconfig).then(()=>{
        bundle.clear();
        require(output);
    }, err=>{
        console.error(err != null ? (err.stack || err.message || err) : err);
    });
}

function getArgv2() {
    const input = process.argv[2];
    if (input == null) {
        console.error(`no input`);
        console.error(`node (script) [...args]`);
        process.exit(-1);
    }
    process.argv.splice(2, 1);
    return input;
}

function getWorkerData() {
    try {
        const { isMainThread, workerData } = require('worker_threads');
        return (isMainThread && workerData && workerData.entry) || null;
    } catch (err) {
        return null;
    }
}

bundlerun(getWorkerData() || getArgv2());
