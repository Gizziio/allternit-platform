//! Hetzner Pricing
//!
//! Server types and pricing for Hetzner Cloud.

pub struct ServerInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub vcpus: u32,
    pub memory_gb: u32,
    pub storage_gb: u32,
    pub price_monthly: f64,
    pub price_hourly: f64,
}

/// Hetzner Cloud servers (pricing as of 2024, EUR)
pub static HETZNER_SERVERS: &[ServerInfo] = &[
    ServerInfo {
        id: "cx11",
        name: "CX11",
        vcpus: 1,
        memory_gb: 2,
        storage_gb: 20,
        price_monthly: 4.51,
        price_hourly: 0.0067,
    },
    ServerInfo {
        id: "cx21",
        name: "CX21",
        vcpus: 2,
        memory_gb: 4,
        storage_gb: 40,
        price_monthly: 9.01,
        price_hourly: 0.0134,
    },
    ServerInfo {
        id: "cx31",
        name: "CX31",
        vcpus: 2,
        memory_gb: 8,
        storage_gb: 80,
        price_monthly: 15.81,
        price_hourly: 0.0235,
    },
    ServerInfo {
        id: "cx41",
        name: "CX41",
        vcpus: 4,
        memory_gb: 16,
        storage_gb: 160,
        price_monthly: 31.61,
        price_hourly: 0.0470,
    },
    ServerInfo {
        id: "cx51",
        name: "CX51",
        vcpus: 8,
        memory_gb: 32,
        storage_gb: 240,
        price_monthly: 63.21,
        price_hourly: 0.0941,
    },
];
