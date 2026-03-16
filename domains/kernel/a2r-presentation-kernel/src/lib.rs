pub mod canvas_protocol;
pub mod canvas_selector;
pub mod error;
pub mod interaction;
pub mod resolver;
pub mod tokenizer;
pub mod types;

use crate::canvas_protocol::CanvasProtocol;
use crate::canvas_selector::CanvasSelector;
use crate::interaction::InteractionGenerator;
use crate::resolver::SituationResolver;
use crate::tokenizer::IntentTokenizer;

pub struct PresentationKernel {
    tokenizer: IntentTokenizer,
    resolver: SituationResolver,
    generator: InteractionGenerator,
    selector: CanvasSelector,
    canvas_protocol: CanvasProtocol,
}

impl Default for PresentationKernel {
    fn default() -> Self {
        Self::new()
    }
}

impl PresentationKernel {
    pub fn new() -> Self {
        Self {
            tokenizer: IntentTokenizer::new(),
            resolver: SituationResolver::new(),
            generator: InteractionGenerator::new(),
            selector: CanvasSelector::new(),
            canvas_protocol: CanvasProtocol::new(),
        }
    }

    /// Get a reference to the canvas protocol
    pub fn canvas_protocol(&self) -> &CanvasProtocol {
        &self.canvas_protocol
    }

    /// Get a mutable reference to the canvas protocol
    pub fn canvas_protocol_mut(&mut self) -> &mut CanvasProtocol {
        &mut self.canvas_protocol
    }
}
