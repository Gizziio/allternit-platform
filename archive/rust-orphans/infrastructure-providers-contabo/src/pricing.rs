//! Contabo Pricing

pub struct VpsInfo {
    pub id: &'static str, pub name: &'static str,
    pub vcpus: u32, pub memory_gb: u32, pub storage_gb: u32,
    pub price_monthly: f64, pub price_hourly: f64,
}

pub static CONTABO_VPS: &[VpsInfo] = &[
    VpsInfo { id: "vps-10", name: "VPS 10", vcpus: 4, memory_gb: 8, storage_gb: 50, price_monthly: 5.50, price_hourly: 0.008 },
    VpsInfo { id: "vps-20", name: "VPS 20", vcpus: 6, memory_gb: 16, storage_gb: 100, price_monthly: 10.50, price_hourly: 0.015 },
    VpsInfo { id: "vps-30", name: "VPS 30", vcpus: 8, memory_gb: 30, storage_gb: 200, price_monthly: 16.50, price_hourly: 0.024 },
    VpsInfo { id: "vps-40", name: "VPS 40", vcpus: 10, memory_gb: 48, storage_gb: 400, price_monthly: 23.50, price_hourly: 0.034 },
];
