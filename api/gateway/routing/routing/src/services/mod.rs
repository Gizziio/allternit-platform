//! API Services Module
//!
//! Core services for the Allternit API layer.

pub mod capsule_permissions;
pub mod capsule_registry;

pub use capsule_registry::{
    Capsule, CapsuleEvent, CapsuleId, CapsulePermission as RegistryCapsulePermission,
    CapsuleRegistry, CapsuleResponse, CapsuleSpec, CapsuleState, SharedCapsuleRegistry,
    ToolUISurface,
};

pub use capsule_permissions::{
    default_capsule_permissions, full_capsule_permissions, restricted_capsule_permissions,
    Permission, PermissionCheckResult, PermissionChecker, PermissionConditions, PermissionSet,
    PermissionType,
};
