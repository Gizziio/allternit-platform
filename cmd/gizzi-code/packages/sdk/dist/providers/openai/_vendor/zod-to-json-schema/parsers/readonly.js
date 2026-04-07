import { parseDef } from '../parseDef';
export const parseReadonlyDef = (def, refs) => {
    return parseDef(def.innerType._def, refs);
};
//# sourceMappingURL=readonly.js.map