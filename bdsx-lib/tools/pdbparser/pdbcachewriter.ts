
import fs = require('fs');
import { pdb } from '../../core';
import { SYMOPT_NO_PUBLICS, SYMOPT_PUBLICS_ONLY, UNDNAME_COMPLETE } from '../../dbghelp';
import { dll } from '../../dll';
import { PdbCache, SymbolInfo } from './pdbcache';

// corrupted
const SKIPS = new Set<string>([
    // wrong return type, class but it's a function itself
    // void __cdecl `public: static class Threading::CustomTLS::TLSManager::getSharedInstance & __ptr64 __cdecl Bedrock::Threading::CustomTLS::TLSManager::getSharedInstance(void)'::`2'::`dynamic atexit destructor for 'sharedInstance''(void)
    '??__FsharedInstance@?1??getSharedInstance@TLSManager@CustomTLS@Threading@Bedrock@@SAAEAV1234@XZ@YAXXZ',
    // wrong return type, class but it's a function itself
    // void __cdecl `public: static struct PlatformUtils::PlatformData::get & __ptr64 __cdecl Bedrock::PlatformUtils::PlatformData::get(void)'::`2'::`dynamic atexit destructor for 'sharedInstance''(void)
    '??__FsharedInstance@?1??get@PlatformData@PlatformUtils@Bedrock@@SAAEAU123@XZ@YAXXZ',
    // wrong parameter type, enum but it's a function itself
    // void __cdecl `enum BlockRenderLayer __cdecl renderMethodToRenderLayer(class std::basic_string<char,struct std::char_traits<char>,class std::allocator<char> > const & __ptr64,enum renderMethodToRenderLayer)'::`2'::`dynamic atexit destructor for 'renderMethodToRenderLayerMap''(void)
    '??__FrenderMethodToRenderLayerMap@?1??renderMethodToRenderLayer@@YA?AW4BlockRenderLayer@@AEBV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@W41@@Z@YAXXZ',
]);


console.log(`[pdbcache.ts] caching...`);

let no = 0;
const filtered:SymbolInfo[] = [];
const fd = fs.openSync(PdbCache.path, 'w');
const old = pdb.setOptions(SYMOPT_PUBLICS_ONLY);
pdb.getAllEx(symbols=>{
    for (const info of symbols) {
        let item = info.name;
        no++;
        if (item.length > 2000) {
            console.log(`[pdbcache.ts] skipped ${no}, too long (deco_length == ${item.length})`);
            continue; // too long
        }

        if (SKIPS.has(item)) continue;
        if (item.startsWith('__imp_?')) { // ?
            item = item.substr(6);
        }
        item = pdb.undecorate(item, UNDNAME_COMPLETE);
        if (item.startsWith('?')) {
            console.log(`[pdbcache.ts] unresolved symbol: ${item}`);
            continue;
        }
        if (item.length > 4050) {
            console.log(`[pdbcache.ts] skipped ${no}, too long (undeo_length == ${item.length})`);
            continue; // too long
        }
        if (item.startsWith('__IMPORT_DESCRIPTOR_api-')) { // ?
            continue;
        }
        if (item.startsWith('_CT??')) { // ?
            continue;
        }
        if (item.startsWith('__@@_')) { // ?
            continue;
        }
        if (item.startsWith('\x7f')) { // ?
            continue;
        }
        if (/^_CTA[0-9]\?/.test(item)) { // ?
            continue;
        }
        if (/^_TI[0-9]\?/.test(item)) { // ?
            continue;
        }
        if (item.startsWith('_TI5?')) { // ?
            continue;
        }
        if (item.startsWith("TSS0<`template-parameter-2',")) { // ?
            continue;
        }
        if (/^__real@[0-9a-z]+$/.test(item)) { // constant values
            continue;
        }
        if (/^__xmm@[0-9a-z]+$/.test(item)) { // constant values
            continue;
        }
        if (/^__sse2_sinf4@@[0-9a-z]+$/.test(item)) { // constant values
            continue;
        }
        if (/^__sse4_sinf4@@[0-9a-z]+$/.test(item)) { // constant values
            continue;
        }
        const address = info.address.subptr(dll.current);
        filtered.push({address, name: item});
    }
});
pdb.setOptions(SYMOPT_NO_PUBLICS);
pdb.getAllEx(symbols=>{
    for (const info of symbols) {
        const item = info.name;
        if (item.length > 2000) {
            console.log(`[pdbcache.ts] skipped ${no}, too long (deco_length == ${item.length})`);
            continue; // too long
        }
        if (item.startsWith('?')) {
            console.log(`[pdbcache.ts] unresolved symbol: ${item}`);
            continue;
        }
        const address = info.address.subptr(dll.current);
        filtered.push({address, name: item});
    }
});

pdb.setOptions(old);

const intv = new Int32Array(3);
const singleInt = intv.subarray(0, 1);
const NULL = Buffer.alloc(1);
NULL[0] = 0;

intv[0] = PdbCache.VERSION;
intv[1] = filtered.length;
fs.writeSync(fd, intv.subarray(0, 2));
for (const {address, name} of filtered) {
    singleInt[0] = address;
    fs.writeSync(fd, singleInt);
    fs.writeSync(fd, name);
    fs.writeSync(fd, NULL);
}
fs.closeSync(fd);
console.log(`[pdbcache.ts] done`);
