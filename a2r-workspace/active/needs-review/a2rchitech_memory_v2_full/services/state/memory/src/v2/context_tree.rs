use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ContextRoute {
    SummariesOnly,
    SummariesThenItems,
    ItemsThenHistory,
    GraphAndItems,
    HistoryOnly,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextDecision {
    pub route: ContextRoute,
    pub reason: String,
}

pub fn decide(user_query: &str) -> ContextDecision {
    let q = user_query.to_lowercase();
    if q.contains("what did i tell you") || q.contains("remember") {
        return ContextDecision { route: ContextRoute::SummariesThenItems, reason: "explicit recall request".into() };
    }
    if q.contains("between") || q.contains("relationship") || q.contains("connected") {
        return ContextDecision { route: ContextRoute::GraphAndItems, reason: "relationship query".into() };
    }
    ContextDecision { route: ContextRoute::SummariesOnly, reason: "default summaries-first".into() }
}
