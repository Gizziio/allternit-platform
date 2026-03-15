//! Backpressure Controller
//!
//! Pause/resume streaming based on client buffer capacity.

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
// Arc not used
use tokio::sync::watch;

/// Controller for backpressure management
pub struct BackpressureController {
    max_buffer_size: usize,
    threshold: f64,
    current_size: AtomicUsize,
    paused: AtomicBool,
    pause_tx: watch::Sender<bool>,
}

impl BackpressureController {
    pub fn new(max_buffer_size: usize, threshold: f64) -> Self {
        let (pause_tx, _) = watch::channel(false);
        Self {
            max_buffer_size,
            threshold,
            current_size: AtomicUsize::new(0),
            paused: AtomicBool::new(false),
            pause_tx,
        }
    }

    /// Check if we should pause (backpressure)
    pub fn should_pause(&self) -> bool {
        let current = self.current_size.load(Ordering::Relaxed);
        let threshold_bytes = (self.max_buffer_size as f64 * self.threshold) as usize;

        let should_pause = current > threshold_bytes;

        if should_pause && !self.paused.load(Ordering::Relaxed) {
            self.paused.store(true, Ordering::Relaxed);
            let _ = self.pause_tx.send(true);
        }

        should_pause
    }

    /// Wait until resumed
    pub async fn wait_for_resume(&self) -> Result<(), ()> {
        let mut rx = self.pause_tx.subscribe();

        loop {
            if !self.should_pause() {
                return Ok(());
            }

            match rx.changed().await {
                Ok(()) => {
                    if !*rx.borrow() {
                        return Ok(());
                    }
                }
                Err(_) => return Err(()),
            }
        }
    }

    /// Record that data was emitted
    pub fn record_emission(&self, bytes: usize) {
        self.current_size.fetch_add(bytes, Ordering::Relaxed);
        self.should_pause(); // Check threshold
    }

    /// Record that client consumed data
    pub fn record_consumption(&self, bytes: usize) {
        let prev = self.current_size.fetch_sub(bytes, Ordering::Relaxed);
        let new_size = prev.saturating_sub(bytes);

        // Check if we should resume
        let was_paused = self.paused.load(Ordering::Relaxed);
        if was_paused {
            let threshold_bytes = (self.max_buffer_size as f64 * self.threshold) as usize;
            let low_water_mark = (threshold_bytes as f64 * 0.5) as usize; // 50% of threshold

            if new_size <= low_water_mark {
                self.paused.store(false, Ordering::Relaxed);
                let _ = self.pause_tx.send(false);
            }
        }
    }

    /// Get current buffer usage
    pub fn current_size(&self) -> usize {
        self.current_size.load(Ordering::Relaxed)
    }

    /// Check if currently paused
    pub fn is_paused(&self) -> bool {
        self.paused.load(Ordering::Relaxed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_backpressure_threshold() {
        let controller = BackpressureController::new(1000, 0.8);

        // Below threshold
        controller.record_emission(500);
        assert!(!controller.should_pause());

        // Above threshold
        controller.record_emission(400);
        assert!(controller.should_pause());
    }

    #[test]
    fn test_resume_after_consumption() {
        let controller = BackpressureController::new(1000, 0.8);

        // Trigger pause
        controller.record_emission(900);
        assert!(controller.should_pause());
        assert!(controller.is_paused());

        // Consume enough to resume
        controller.record_consumption(500);
        assert!(!controller.is_paused());
    }
}
