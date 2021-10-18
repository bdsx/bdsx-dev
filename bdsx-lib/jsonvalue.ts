import { abstract } from "./common";
import { makefunc } from "./makefunc";
import { minecraftTsReady } from "./minecraft_impl/ready";
import { NativeType } from "./nativetype";

export const JsonValue = new NativeType<any>(
    'Json::Value',
    16,
    8,
    ()=>true,
    undefined,
    abstract,
    abstract,
);
export type JsonValue = any;

minecraftTsReady.promise.then(()=>{
    const { Json } = require('./minecraft') as typeof import('./minecraft');
    JsonValue[NativeType.getter] = (ptr, offset)=>{
        const jsoninst = ptr.getPointerAs(Json.Value, offset);
        return jsoninst.getValue();
    };
    JsonValue[NativeType.setter] = (ptr, value, offset)=>{
        const v = Json.Value.constructWith(value);
        makefunc.temporalDtors.push(()=>{ v.destruct(); });
        ptr.setPointer(v, offset);
    };
});
