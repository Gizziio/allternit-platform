//! AWS Pricing Information
//!
//! Instance types and pricing for AWS.

/// AWS instance type definition
pub struct InstanceTypeInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub vcpus: u32,
    pub memory_gb: u32,
    pub storage_gb: u32,
    pub price_monthly: f64,
    pub price_hourly: f64,
}

/// AWS instance types (us-west-2 pricing as of 2024)
pub static AWS_INSTANCE_TYPES: &[InstanceTypeInfo] = &[
    InstanceTypeInfo {
        id: "t3.micro",
        name: "t3.micro",
        vcpus: 2,
        memory_gb: 1,
        storage_gb: 0,
        price_monthly: 7.59,
        price_hourly: 0.0104,
    },
    InstanceTypeInfo {
        id: "t3.small",
        name: "t3.small",
        vcpus: 2,
        memory_gb: 2,
        storage_gb: 0,
        price_monthly: 15.18,
        price_hourly: 0.0208,
    },
    InstanceTypeInfo {
        id: "t3.medium",
        name: "t3.medium",
        vcpus: 2,
        memory_gb: 4,
        storage_gb: 0,
        price_monthly: 30.37,
        price_hourly: 0.0416,
    },
    InstanceTypeInfo {
        id: "t3.large",
        name: "t3.large",
        vcpus: 2,
        memory_gb: 8,
        storage_gb: 0,
        price_monthly: 60.74,
        price_hourly: 0.0832,
    },
    InstanceTypeInfo {
        id: "t3.xlarge",
        name: "t3.xlarge",
        vcpus: 4,
        memory_gb: 16,
        storage_gb: 0,
        price_monthly: 121.47,
        price_hourly: 0.1664,
    },
    InstanceTypeInfo {
        id: "m5.large",
        name: "m5.large",
        vcpus: 2,
        memory_gb: 8,
        storage_gb: 0,
        price_monthly: 70.08,
        price_hourly: 0.096,
    },
    InstanceTypeInfo {
        id: "m5.xlarge",
        name: "m5.xlarge",
        vcpus: 4,
        memory_gb: 16,
        storage_gb: 0,
        price_monthly: 140.16,
        price_hourly: 0.192,
    },
    InstanceTypeInfo {
        id: "c5.large",
        name: "c5.large",
        vcpus: 2,
        memory_gb: 4,
        storage_gb: 0,
        price_monthly: 62.05,
        price_hourly: 0.085,
    },
];
