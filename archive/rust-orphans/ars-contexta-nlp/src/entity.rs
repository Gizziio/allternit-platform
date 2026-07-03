//! Entity extraction module
//! 
//! Provides Named Entity Recognition (NER) capabilities

/// Entity extractor trait
pub trait EntityExtractor: Send + Sync {
    /// Extract entities from text
    fn extract(&mut self, text: &str) -> anyhow::Result<Vec<Entity>>;
}

/// Entity representation
#[derive(Debug, Clone)]
pub struct Entity {
    pub text: String,
    pub label: EntityLabel,
    pub start: usize,
    pub end: usize,
    pub score: f32,
}

/// Entity labels (CoNLL-2003 style)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EntityLabel {
    Person,
    Organization,
    Location,
    Miscellaneous,
}

impl std::fmt::Display for EntityLabel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EntityLabel::Person => write!(f, "PER"),
            EntityLabel::Organization => write!(f, "ORG"),
            EntityLabel::Location => write!(f, "LOC"),
            EntityLabel::Miscellaneous => write!(f, "MISC"),
        }
    }
}

/// rust-bert based entity extractor
#[cfg(feature = "rust-bert-backend")]
pub struct RustBertEntityExtractor {
    // TODO: Add actual rust-bert model
    model_name: String,
}

#[cfg(feature = "rust-bert-backend")]
impl RustBertEntityExtractor {
    pub fn new(model_name: &str) -> anyhow::Result<Self> {
        Ok(Self {
            model_name: model_name.to_string(),
        })
    }
}

#[cfg(feature = "rust-bert-backend")]
impl EntityExtractor for RustBertEntityExtractor {
    fn extract(&mut self, _text: &str) -> anyhow::Result<Vec<Entity>> {
        // TODO: Implement actual NER using rust-bert
        Ok(vec![])
    }
}

/// Candle-based entity extractor (lighter alternative)
#[cfg(feature = "candle-backend")]
pub struct CandleEntityExtractor {
    // TODO: Add actual candle model
    model_path: String,
}

#[cfg(feature = "candle-backend")]
impl CandleEntityExtractor {
    pub fn new(model_path: &str) -> anyhow::Result<Self> {
        Ok(Self {
            model_path: model_path.to_string(),
        })
    }
}

#[cfg(feature = "candle-backend")]
impl EntityExtractor for CandleEntityExtractor {
    fn extract(&mut self, _text: &str) -> anyhow::Result<Vec<Entity>> {
        // TODO: Implement actual NER using candle
        Ok(vec![])
    }
}
