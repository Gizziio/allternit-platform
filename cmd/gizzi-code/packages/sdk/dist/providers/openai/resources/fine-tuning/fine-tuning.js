// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from '../../core/resource';
import * as MethodsAPI from './methods';
import { Methods, } from './methods';
import * as AlphaAPI from './alpha/alpha';
import { Alpha } from './alpha/alpha';
import * as CheckpointsAPI from './checkpoints/checkpoints';
import { Checkpoints } from './checkpoints/checkpoints';
import * as JobsAPI from './jobs/jobs';
import { Jobs, } from './jobs/jobs';
export class FineTuning extends APIResource {
    methods = new MethodsAPI.Methods(this._client);
    jobs = new JobsAPI.Jobs(this._client);
    checkpoints = new CheckpointsAPI.Checkpoints(this._client);
    alpha = new AlphaAPI.Alpha(this._client);
}
FineTuning.Methods = Methods;
FineTuning.Jobs = Jobs;
FineTuning.Checkpoints = Checkpoints;
FineTuning.Alpha = Alpha;
//# sourceMappingURL=fine-tuning.js.map