import { parseDef } from '../parseDef';
export const parseCatchDef = (def, refs) => {
    return parseDef(def.innerType._def, refs);
};
//# sourceMappingURL=catch.js.map