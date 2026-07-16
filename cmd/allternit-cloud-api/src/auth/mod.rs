//! Authentication and authorization module
//!
//! Provides middleware for token validation, permission checking,
//! and development mode bypass capabilities.

pub mod clerk;
pub mod middleware;
pub mod models;
pub mod permissions;

pub use middleware::{AuthContext, AuthLayer, AuthMiddleware};
pub use models::{ApiToken, AuthenticatedUser, TokenInfo};
pub use permissions::{Permission, PermissionChecker};
