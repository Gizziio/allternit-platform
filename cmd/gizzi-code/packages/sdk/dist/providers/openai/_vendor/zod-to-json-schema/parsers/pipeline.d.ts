import { ZodPipelineDef } from 'zod/v3';
import { JsonSchema7Type } from '../parseDef';
import { Refs } from '../Refs';
import { JsonSchema7AllOfType } from './intersection';
export declare const parsePipelineDef: (def: ZodPipelineDef<any, any>, refs: Refs) => JsonSchema7AllOfType | JsonSchema7Type | undefined;
//# sourceMappingURL=pipeline.d.ts.map