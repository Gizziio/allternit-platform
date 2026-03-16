//! DigitalOcean Regions
//!
//! Available DigitalOcean regions for deployment.

/// DigitalOcean region definition
pub struct RegionInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub location: &'static str,
}

/// DigitalOcean regions
pub static DO_REGIONS: &[RegionInfo] = &[
    RegionInfo {
        id: "nyc1",
        name: "New York 1",
        location: "nyc1",
    },
    RegionInfo {
        id: "nyc3",
        name: "New York 3",
        location: "nyc3",
    },
    RegionInfo {
        id: "sfo3",
        name: "San Francisco 3",
        location: "sfo3",
    },
    RegionInfo {
        id: "ams3",
        name: "Amsterdam 3",
        location: "ams3",
    },
    RegionInfo {
        id: "sgp1",
        name: "Singapore 1",
        location: "sgp1",
    },
    RegionInfo {
        id: "lon1",
        name: "London 1",
        location: "lon1",
    },
    RegionInfo {
        id: "fra1",
        name: "Frankfurt 1",
        location: "fra1",
    },
    RegionInfo {
        id: "tor1",
        name: "Toronto 1",
        location: "tor1",
    },
    RegionInfo {
        id: "blr1",
        name: "Bangalore 1",
        location: "blr1",
    },
];
