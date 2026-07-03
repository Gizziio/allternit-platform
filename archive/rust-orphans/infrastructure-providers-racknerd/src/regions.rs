//! RackNerd Regions

pub struct RegionInfo { pub id: &'static str, pub name: &'static str, pub location: &'static str }
pub static RN_REGIONS: &[RegionInfo] = &[
    RegionInfo { id: "us", name: "United States", location: "us" },
    RegionInfo { id: "eu", name: "Europe", location: "eu" },
];
