//! Static media provider catalog: unit prices, model options, and the
//! per-user availability view (BYOK configured + platform-funded lane).
//!
//! Prices (2026-08/09, list prices from the vendor/fal pages):
//! - MiniMax H3 video: $0.08/s at 768P, $0.13/s at 2K. The 2K figure is
//!   corroborated across reseller/model listings but not directly listed on
//!   the official paygo table — flagged in the catalog.
//! - fal Seedance 2.0: fast $0.2419/s, standard $0.3034/s @720p, standard
//!   1080p $0.682/s (from the fal.ai model page).
//! - gpt-image: low $0.006 / medium $0.053 / high $0.211 per 1024² image.
//!   Batch API is 50% off — interactive generation does not use it.
//! - fal FLUX schnell: $0.003/megapixel, rounded up to the nearest MP.

use serde_json::{json, Value};

use crate::db::DbHandle;
use crate::llm_gateway::route_credentials::has_credential;

pub const MINIMAX_PRICE_768P_PER_SEC: f64 = 0.08;
pub const MINIMAX_PRICE_2K_PER_SEC: f64 = 0.13;
pub const FAL_SEEDANCE_FAST_720P_PER_SEC: f64 = 0.2419;
pub const FAL_SEEDANCE_STANDARD_720P_PER_SEC: f64 = 0.3034;
pub const FAL_SEEDANCE_STANDARD_1080P_PER_SEC: f64 = 0.682;
pub const GPT_IMAGE_PRICES_PER_IMAGE: [(&str, f64); 3] =
    [("low", 0.006), ("medium", 0.053), ("high", 0.211)];
pub const FLUX_PRICE_PER_MEGAPIXEL: f64 = 0.003;

/// Platform-funded lane master switch. Ships DISABLED: the operator must set
/// `ALLTERNIT_MEDIA_PLATFORM_FUNDED` to "1"/"true" AND provide the provider
/// env keys before any request may bill Allternit's own accounts.
pub fn platform_funded_enabled() -> bool {
    matches!(
        std::env::var("ALLTERNIT_MEDIA_PLATFORM_FUNDED")
            .unwrap_or_default()
            .to_lowercase()
            .as_str(),
        "1" | "true"
    )
}

fn availability(db: &DbHandle, user_id: &str, credential_provider_id: &str) -> (Value, Value) {
    let byok = has_credential(db, user_id, credential_provider_id);
    let platform_enabled = platform_funded_enabled()
        && platform_env_key_present(credential_provider_id);
    (
        json!({ "configured": byok }),
        json!({ "enabled": platform_enabled }),
    )
}

fn platform_env_key_present(credential_provider_id: &str) -> bool {
    let var = match credential_provider_id {
        "minimax" => "MINIMAX_API_KEY",
        "fal" => "FAL_KEY",
        "openai" => "OPENAI_API_KEY",
        _ => return false,
    };
    std::env::var(var).map(|k| !k.is_empty()).unwrap_or(false)
}

/// Per-user media catalog: static prices/models plus BYOK and
/// platform-funded availability flags.
pub fn catalog_for_user(db: &DbHandle, user_id: &str) -> Value {
    let (minimax_byok, minimax_platform) = availability(db, user_id, "minimax");
    let (fal_byok, fal_platform) = availability(db, user_id, "fal");
    let (openai_byok, openai_platform) = availability(db, user_id, "openai");
    json!({
        "providers": [
            {
                "id": "minimax-h3",
                "kind": "video",
                "name": "MiniMax H3",
                "credential_provider_id": "minimax",
                "models": [{
                    "id": "MiniMax-H3",
                    "resolutions": [
                        { "id": "768P", "price_per_second": MINIMAX_PRICE_768P_PER_SEC },
                        { "id": "2K", "price_per_second": MINIMAX_PRICE_2K_PER_SEC,
                          "price_note": "corroborated, not directly listed on official paygo table" }
                    ],
                    "durations": [4, 5, 6, 10, 15]
                }],
                "byok": minimax_byok,
                "platform_funded": minimax_platform
            },
            {
                "id": "fal-seedance",
                "kind": "video",
                "name": "Seedance 2.0 (fal)",
                "credential_provider_id": "fal",
                "models": [{
                    "id": "seedance-2.0",
                    "tiers": [
                        { "id": "fast", "price_per_second": FAL_SEEDANCE_FAST_720P_PER_SEC, "resolution": "720p" },
                        { "id": "standard", "price_per_second": FAL_SEEDANCE_STANDARD_720P_PER_SEC, "resolution": "720p" },
                        { "id": "standard-1080p", "price_per_second": FAL_SEEDANCE_STANDARD_1080P_PER_SEC, "resolution": "1080p" }
                    ],
                    "durations": [4, 5, 6, 10, 15]
                }],
                "byok": fal_byok,
                "platform_funded": fal_platform
            },
            {
                "id": "gpt-image",
                "kind": "image",
                "name": "gpt-image (OpenAI)",
                "credential_provider_id": "openai",
                "models": [{
                    "id": "gpt-image-2",
                    "sizes": ["1024x1024", "1024x1536", "1536x1024"],
                    "qualities": GPT_IMAGE_PRICES_PER_IMAGE
                        .iter()
                        .map(|(id, price)| json!({ "id": id, "price_per_image": price }))
                        .collect::<Vec<_>>()
                }],
                "byok": openai_byok,
                "platform_funded": openai_platform,
                "note": "Batch API is 50% off; interactive generation does not use it."
            },
            {
                "id": "flux-fal",
                "kind": "image",
                "name": "FLUX schnell (fal)",
                "credential_provider_id": "fal",
                "models": [{
                    "id": "fal-ai/flux/schnell",
                    "price_per_megapixel": FLUX_PRICE_PER_MEGAPIXEL,
                    "price_note": "rounded up to nearest megapixel"
                }],
                "byok": fal_byok,
                "platform_funded": fal_platform
            }
        ]
    })
}

/// Estimated cost in USD for a video job, using catalog unit prices.
pub fn estimate_video_cost(
    provider: &str,
    resolution: &str,
    fast: bool,
    duration_secs: u32,
) -> Option<f64> {
    let per_second = match provider {
        "minimax-h3" => {
            if resolution.eq_ignore_ascii_case("2k") {
                MINIMAX_PRICE_2K_PER_SEC
            } else {
                MINIMAX_PRICE_768P_PER_SEC
            }
        }
        "fal-seedance" => {
            if resolution.contains("1080") {
                FAL_SEEDANCE_STANDARD_1080P_PER_SEC
            } else if fast {
                FAL_SEEDANCE_FAST_720P_PER_SEC
            } else {
                FAL_SEEDANCE_STANDARD_720P_PER_SEC
            }
        }
        _ => return None,
    };
    Some(per_second * duration_secs as f64)
}

/// Estimated cost in USD for a gpt-image request (n images at quality).
pub fn estimate_gpt_image_cost(quality: &str, n: u32) -> Option<f64> {
    GPT_IMAGE_PRICES_PER_IMAGE
        .iter()
        .find(|(id, _)| id == &quality)
        .map(|(_, price)| price * n as f64)
}

/// Estimated cost in USD for a FLUX schnell request (square_hd ≈ 1 MP/image,
/// billed rounded up to the nearest whole megapixel).
pub fn estimate_flux_cost(num_images: u32) -> f64 {
    FLUX_PRICE_PER_MEGAPIXEL * num_images as f64
}
