import { ZodIntersectionDef } from 'zod/v3';
import { JsonSchema7Type } from '../parseDef';
import { Refs } from '../Refs';
export type JsonSchema7AllOfType = {
    allOf: JsonSchema7Type[];
    unevaluatedProperties?: boolean;
};
export declare function parseIntersectionDef(def: ZodIntersectionDef, refs: Refs): JsonSchema7AllOfType | JsonSchema7Type | undefined;
//# sourceMappingURL=intersection.d.ts.map