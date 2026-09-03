//! Core services for Cowork Runtime

pub mod api_keys;
pub mod contabo_runtime_service;
pub mod cost_service;
pub mod event_store;
pub mod executor_service;
pub mod hosted_runtime_lifecycle;
pub mod inference_settlement;
pub mod quota_service;
pub mod run_service;
pub mod scheduler_service;
pub mod task_service;

pub use contabo_runtime_service::{
    ContaboContainerState, ContaboRuntimeService, HostedInstanceRow, ProvisionedContaboRuntime,
};
pub use cost_service::{
    finalize_run_cost_tracking, init_run_cost_tracking, start_cost_tracking_task, AlertType,
    CostAlert, CostBreakdown, CostRate, CostService, CostServiceImpl, RunCost, RunCostSummary,
    SetCostRateRequest, UpdateBudgetRequest, UserCostBudget, UserCostSummary,
};
pub use event_store::{event_utils, EventStore, EventStoreImpl};
pub use executor_service::{
    start_executor_service, AllowAllGate, ApprovalGate, ExecutorConfig, ExecutorDeps,
    ExecutorService,
};
pub use hosted_runtime_lifecycle::{
    hosted_usage_summary, hosted_wake_decision, hosted_wake_target, mark_hosted_instance_starting,
    open_session_accrued_cost, record_runtime_started, record_runtime_stopped,
    start_hosted_runtime_lifecycle_task, touch_instance_activity, touch_runtime_activity,
    wake_hosted_runtime_for_device, HostedUsageSummary, HostedWakeDecision, HostedWakeOutcome,
    HostedWakeTarget,
};
pub use inference_settlement::{
    check_inference_allowed, credit_balance_row, meter_json_response, meter_stream_response,
    settle_inference, StreamSettlement, UsageMeteringBody,
};
pub use quota_service::{QuotaService, SharedQuotaService, UserQuota};
pub use run_service::{RunListFilter, RunService, RunServiceImpl};
pub use scheduler_service::{
    start_scheduler_service, MisfirePolicy, SchedulerConfig, SchedulerService,
};
pub use task_service::TaskService;
