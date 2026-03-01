//! Hetzner Regions
//!
//! Available Hetzner Cloud locations.

pub struct RegionInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub location: &'static str,
}

/// Hetzner Cloud regions (data centers)
pub static HETZNER_REGIONS: &[RegionInfo] = &[
    RegionInfo {
        id: "fsn1",
        name: "Falkenstein 1",
        location: "fsn1",
    },
    RegionInfo {
        id: "nbg1",
        name: "Nuremberg 1",
        location: "nbg1",
    },
    RegionInfo {
        id: "hel1",
        name: "Helsinki 1",
        location: "hel1",
    },
    RegionInfo {
        id: "ash",
        name: "Ashburn (US)",
        location: "ash",
    },
];
