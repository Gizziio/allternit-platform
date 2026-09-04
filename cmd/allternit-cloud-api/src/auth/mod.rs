//! Authentication and authorization module
//!
//! Provides middleware for token validation, permission checking,
//! and development mode bypass capabilities.

pub mod clerk;
pub mod dataplane_jwt;
pub mod dev_token;
pub mod middleware;
pub mod models;
pub mod permissions;
pub mod resolve;

pub use middleware::{AuthContext, AuthLayer, AuthMiddleware};
pub use models::{ApiToken, AuthenticatedUser, TokenInfo};
pub use permissions::{Permission, PermissionChecker};
pub use resolve::{resolve_user, resolve_user_id, resolve_user_scoped};
