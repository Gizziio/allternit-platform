import { parseDef } from '../parseDef';
export function parsePromiseDef(def, refs) {
    return parseDef(def.type._def, refs);
}
//# sourceMappingURL=promise.js.map