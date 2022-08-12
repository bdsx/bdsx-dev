import { VoidPointer } from "../../core";
import { bool_t, CxxString, int32_t } from "../../nativetype";
import { CommandParameterData, typeid_t } from "..";

declare module ".." {
    interface CommandParameterData {
        tid:typeid_t<CommandRegistry>;
        parser:VoidPointer; // bool (CommandRegistry::*)(void *, CommandRegistry::ParseToken const &, CommandOrigin const &, int, std::string &,std::vector<std::string> &) const;
        name:CxxString;
        desc:VoidPointer|null; // char*
        unk56:int32_t;
        type:CommandParameterDataType;
        offset:int32_t;
        flag_offset:int32_t;
        optional:bool_t;
        pad73:bool_t;
    }
}

CommandParameterData.define({
    tid:typeid_t,
    parser:VoidPointer,
    name:CxxString,
    desc:VoidPointer,
    unk56:int32_t,
    type:int32_t,
    offset:int32_t,
    flag_offset:int32_t,
    optional:bool_t,
    pad73:bool_t,
});
