//! Contabo Regions

pub struct RegionInfo { pub id: &'static str, pub name: &'static str, pub location: &'static str }

pub static CONTABO_REGIONS: &[RegionInfo] = &[
    RegionInfo { id: "de", name: "Germany", location: "de" },
    RegionInfo { id: "us", name: "United States", location: "us" },
    RegionInfo { id: "sg", name: "Singapore", location: "sg" },
];
