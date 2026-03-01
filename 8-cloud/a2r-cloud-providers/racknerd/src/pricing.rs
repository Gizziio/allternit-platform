//! RackNerd Pricing

pub struct PlanInfo { pub id: &'static str, pub name: &'static str, pub vcpus: u32, pub memory_gb: u32, pub storage_gb: u32, pub price_monthly: f64, pub price_hourly: f64 }
pub static RN_PLANS: &[PlanInfo] = &[
    PlanInfo { id: "budget-1", name: "Budget 1", vcpus: 1, memory_gb: 1, storage_gb: 20, price_monthly: 10.98, price_hourly: 0.016 },
    PlanInfo { id: "budget-2", name: "Budget 2", vcpus: 2, memory_gb: 2, storage_gb: 35, price_monthly: 15.98, price_hourly: 0.024 },
    PlanInfo { id: "budget-3", name: "Budget 3", vcpus: 3, memory_gb: 3, storage_gb: 50, price_monthly: 20.98, price_hourly: 0.031 },
];
