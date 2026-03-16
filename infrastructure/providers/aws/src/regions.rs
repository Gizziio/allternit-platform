//! AWS Regions
//!
//! Available AWS regions for deployment.

/// AWS region definition
pub struct RegionInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub location: &'static str,
}

/// AWS regions
pub static AWS_REGIONS: &[RegionInfo] = &[
    RegionInfo {
        id: "us-east-1",
        name: "US East (N. Virginia)",
        location: "us-east-1",
    },
    RegionInfo {
        id: "us-east-2",
        name: "US East (Ohio)",
        location: "us-east-2",
    },
    RegionInfo {
        id: "us-west-1",
        name: "US West (N. California)",
        location: "us-west-1",
    },
    RegionInfo {
        id: "us-west-2",
        name: "US West (Oregon)",
        location: "us-west-2",
    },
    RegionInfo {
        id: "eu-west-1",
        name: "EU (Ireland)",
        location: "eu-west-1",
    },
    RegionInfo {
        id: "eu-west-2",
        name: "EU (London)",
        location: "eu-west-2",
    },
    RegionInfo {
        id: "eu-central-1",
        name: "EU (Frankfurt)",
        location: "eu-central-1",
    },
    RegionInfo {
        id: "ap-southeast-1",
        name: "Asia Pacific (Singapore)",
        location: "ap-southeast-1",
    },
    RegionInfo {
        id: "ap-southeast-2",
        name: "Asia Pacific (Sydney)",
        location: "ap-southeast-2",
    },
    RegionInfo {
        id: "ap-northeast-1",
        name: "Asia Pacific (Tokyo)",
        location: "ap-northeast-1",
    },
];
