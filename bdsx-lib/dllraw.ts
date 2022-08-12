import { cgate, pdb } from "./core";


export namespace dllraw {
    export const bedrock_server = pdb.getList(pdb.coreCachePath, {}, [
        '??$_Allocate@$0BA@U_Default_allocate_traits@std@@$0A@@std@@YAPEAX_K@Z',
        '??0?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@QEAA@XZ',
        '?_Tidy_deallocate@?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@AEAAXXZ',
        'vsnprintf',
    ]);
    export namespace kernel32 {
        export const module = cgate.GetModuleHandleW('kernel32.dll');
        export const GetCurrentThreadId = cgate.GetProcAddress(module, 'GetCurrentThreadId');
        export const Sleep = cgate.GetProcAddress(module, 'Sleep');
    }
    export namespace vcruntime140 {
        export const module = cgate.GetModuleHandleW('vcruntime140.dll');
        export const memcpy = cgate.GetProcAddress(module, 'memcpy');
    }
    export namespace ucrtbase {
        export const module = cgate.GetModuleHandleW('ucrtbase.dll');
        export const malloc = cgate.GetProcAddress(module, 'malloc');
    }
}
