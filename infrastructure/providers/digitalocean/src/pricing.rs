//! DigitalOcean Pricing
//!
//! Droplet types and pricing for DigitalOcean.

/// Droplet type definition
pub struct DropletInfo {
    pub slug: &'static str,
    pub name: &'static str,
    pub vcpus: u32,
    pub memory_gb: u32,
    pub storage_gb: u32,
    pub price_monthly: f64,
    pub price_hourly: f64,
}

/// DigitalOcean Droplets (pricing as of 2024)
pub static DO_DROPLETS: &[DropletInfo] = &[
    DropletInfo {
        slug: "s-1vcpu-1gb",
        name: "Basic 1GB",
        vcpus: 1,
        memory_gb: 1,
        storage_gb: 25,
        price_monthly: 6.00,
        price_hourly: 0.009,
    },
    DropletInfo {
        slug: "s-1vcpu-2gb",
        name: "Basic 2GB",
        vcpus: 1,
        memory_gb: 2,
        storage_gb: 50,
        price_monthly: 12.00,
        price_hourly: 0.018,
    },
    DropletInfo {
        slug: "s-2vcpu-2gb",
        name: "Basic 2GB (2 CPU)",
        vcpus: 2,
        memory_gb: 2,
        storage_gb: 60,
        price_monthly: 18.00,
        price_hourly: 0.027,
    },
    DropletInfo {
        slug: "s-2vcpu-4gb",
        name: "Basic 4GB",
        vcpus: 2,
        memory_gb: 4,
        storage_gb: 80,
        price_monthly: 24.00,
        price_hourly: 0.036,
    },
    DropletInfo {
        slug: "s-4vcpu-8gb",
        name: "Basic 8GB",
        vcpus: 4,
        memory_gb: 8,
        storage_gb: 160,
        price_monthly: 48.00,
        price_hourly: 0.071,
    },
    DropletInfo {
        slug: "s-8vcpu-16gb",
        name: "Basic 16GB",
        vcpus: 8,
        memory_gb: 16,
        storage_gb: 320,
        price_monthly: 96.00,
        price_hourly: 0.143,
    },
];
