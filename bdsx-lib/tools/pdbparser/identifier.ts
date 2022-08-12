import { tsw } from "../lib/tswriter";
import { PdbId } from "./symbolparser";
import type { BlockScope } from "./symbolwriter";
import { ImportItem, ResItem } from "./tswrapperutil";

export interface ToTswOptions {
    isField?:boolean;
    noTemplate?:boolean;
    noJsType?:boolean;
    absoluteValue?:boolean;
}

export interface TemplateRedirect {
    redirect(scope:BlockScope, item:PdbId<PdbId.TemplateBase>, templates:Identifier[], opts:ToTswOptions):ResItem;
    templates:Identifier[];
}

export interface Identifier extends PdbId<PdbId.Data> {
    jsType?:((item:Identifier)=>ResItem)|ResItem|ImportItem|null;
    jsTypeOnly?:tsw.Type;
    jsTypeNullable?:boolean;
    templateRedirects?:TemplateRedirect[];

    dontExport?:boolean;
    dontExportContents?:boolean;
    paramVarName?:string|null;
    filted?:boolean;
    tswVar?:tsw.Name;

    isMantleClass?:boolean;
}
