import { APIResource } from '../../core/resource';
import * as MethodsAPI from './methods';
import { DpoHyperparameters, DpoMethod, Methods, ReinforcementHyperparameters, ReinforcementMethod, SupervisedHyperparameters, SupervisedMethod } from './methods';
import * as AlphaAPI from './alpha/alpha';
import { Alpha } from './alpha/alpha';
import * as CheckpointsAPI from './checkpoints/checkpoints';
import { Checkpoints } from './checkpoints/checkpoints';
import * as JobsAPI from './jobs/jobs';
import { FineTuningJob, FineTuningJobEvent, FineTuningJobEventsPage, FineTuningJobIntegration, FineTuningJobWandbIntegration, FineTuningJobWandbIntegrationObject, FineTuningJobsPage, JobCreateParams, JobListEventsParams, JobListParams, Jobs } from './jobs/jobs';
export declare class FineTuning extends APIResource {
    methods: MethodsAPI.Methods;
    jobs: JobsAPI.Jobs;
    checkpoints: CheckpointsAPI.Checkpoints;
    alpha: AlphaAPI.Alpha;
}
export declare namespace FineTuning {
    export { Methods as Methods, type DpoHyperparameters as DpoHyperparameters, type DpoMethod as DpoMethod, type ReinforcementHyperparameters as ReinforcementHyperparameters, type ReinforcementMethod as ReinforcementMethod, type SupervisedHyperparameters as SupervisedHyperparameters, type SupervisedMethod as SupervisedMethod, };
    export { Jobs as Jobs, type FineTuningJob as FineTuningJob, type FineTuningJobEvent as FineTuningJobEvent, type FineTuningJobWandbIntegration as FineTuningJobWandbIntegration, type FineTuningJobWandbIntegrationObject as FineTuningJobWandbIntegrationObject, type FineTuningJobIntegration as FineTuningJobIntegration, type FineTuningJobsPage as FineTuningJobsPage, type FineTuningJobEventsPage as FineTuningJobEventsPage, type JobCreateParams as JobCreateParams, type JobListParams as JobListParams, type JobListEventsParams as JobListEventsParams, };
    export { Checkpoints as Checkpoints };
    export { Alpha as Alpha };
}
//# sourceMappingURL=fine-tuning.d.ts.map