//! Authentication and authorization module
//!
//! Provides middleware for token validation, permission checking,
//! and development mode bypass capabilities.

pub mod middleware;
pub mod permissions;
pub mod models;

pub use middleware::{AuthLayer, AuthMiddleware, AuthContext};
pub use permissions::{Permission, PermissionChecker};
pub use models::{ApiToken, TokenInfo, AuthenticatedUser};
