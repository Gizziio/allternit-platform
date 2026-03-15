//! Audio Channel Module
//!
//! GAP-37: AudioChannel implementation
//! WIH: GAP-37, Owner: T2-A1, Dependencies: GAP-36
//!
//! Implements Opus decoding and audio stream buffering.
//! Uses STUB_APPROVED for audio codecs not yet fully implemented.

mod buffer;
mod channel;
mod decoder;

pub use buffer::*;
pub use channel::*;
pub use decoder::*;
