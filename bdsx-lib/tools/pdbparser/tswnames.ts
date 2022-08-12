import { tsw } from "../lib/tswriter";

export const tswNames = {
    overloadInfo: new tsw.NameProperty('overloadInfo'),
    add: new tsw.NameProperty('add'),
    overloads: new tsw.NameProperty('overloads'),
    make: new tsw.NameProperty('make'),
    get: new tsw.NameProperty('get'),
    constructWith:new tsw.NameProperty('constructWith'),
    ctor: new tsw.NameProperty('ctor'),
    dtor: new tsw.NameProperty('dtor'),
    ID: new tsw.NameProperty('ID'),
    T: new tsw.TypeName('T'),
    $F: new tsw.Name('$F'),
    $O: new tsw.Name('$O'),
    $C: new tsw.Name('$C'),
    ref: new tsw.NameProperty('ref'),
};
