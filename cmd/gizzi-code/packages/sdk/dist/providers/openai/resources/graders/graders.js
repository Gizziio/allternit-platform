// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from '../../core/resource';
import * as GraderModelsAPI from './grader-models';
import { GraderModels, } from './grader-models';
export class Graders extends APIResource {
    graderModels = new GraderModelsAPI.GraderModels(this._client);
}
Graders.GraderModels = GraderModels;
//# sourceMappingURL=graders.js.map