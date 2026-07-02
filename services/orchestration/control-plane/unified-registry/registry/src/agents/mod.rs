//! Agent registry types and persistence.
//!
//! This module re-exports the canonical agent definitions from `agents.rs` so
//! there is a single source of truth for the registry contract.

mod agents;

pub use self::agents::{
    AgentDefinition,
    AgentRegistry,
    AvatarConfig,
    CharacterLayer,
    HarnessByokConfig,
    HarnessByokProviderConfig,
    HarnessCloudConfig,
    HarnessConfig,
    HarnessLocalConfig,
    HarnessSubprocessConfig,
    ModelConfig,
    RoleCard,
    VoiceConfig,
};

pub use super::RegistryError;
