import { APIResource } from '../../../core/resource';
import * as GradersAPI from './graders';
import { GraderRunParams, GraderRunResponse, GraderValidateParams, GraderValidateResponse, Graders } from './graders';
export declare class Alpha extends APIResource {
    graders: GradersAPI.Graders;
}
export declare namespace Alpha {
    export { Graders as Graders, type GraderRunResponse as GraderRunResponse, type GraderValidateResponse as GraderValidateResponse, type GraderRunParams as GraderRunParams, type GraderValidateParams as GraderValidateParams, };
}
//# sourceMappingURL=alpha.d.ts.map