use anyhow::Result;
use reqwest::Client;
use scraper::{Html, Selector};
use crate::ToolOutput;

pub struct SearchTool {
    client: Client,
}

impl SearchTool {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
                .build()
                .unwrap(),
        }
    }

    pub async fn search(&self, query: &str) -> Result<ToolOutput> {
        let url = format!("https://html.duckduckgo.com/html/?q={}", url::form_urlencoded::byte_serialize(query.as_bytes()).collect::<String>());
        
        let res = self.client.get(&url).send().await?.text().await?;
        let document = Html::parse_document(&res);
        
        let result_selector = Selector::parse(".result__body").unwrap();
        let title_selector = Selector::parse(".result__title").unwrap();
        let snippet_selector = Selector::parse(".result__snippet").unwrap();
        let link_selector = Selector::parse(".result__a").unwrap();

        let mut results = Vec::new();

        for element in document.select(&result_selector).take(5) {
            let title = element.select(&title_selector).next()
                .map(|e| e.text().collect::<String>().trim().to_string())
                .unwrap_or_default();
                
            let snippet = element.select(&snippet_selector).next()
                .map(|e| e.text().collect::<String>().trim().to_string())
                .unwrap_or_default();
                
            let link = element.select(&link_selector).next()
                .and_then(|e| e.value().attr("href"))
                .map(|s| s.to_string())
                .unwrap_or_default();

            if !title.is_empty() {
                results.push(serde_json::json!({
                    "title": title,
                    "snippet": snippet,
                    "link": link
                }));
            }
        }

        if results.is_empty() {
            // Fallback mock if scraper fails (anti-bot)
            results.push(serde_json::json!({
                "title": format!("Search results for {}", query),
                "snippet": "Real search failed (likely anti-bot), returning mock result.",
                "link": "http://example.com"
            }));
        }

        let text = results.iter()
            .map(|r| format!("- {} ({})\n  {}", r["title"].as_str().unwrap_or(""), r["link"].as_str().unwrap_or(""), r["snippet"].as_str().unwrap_or("")))
            .collect::<Vec<_>>()
            .join("\n\n");

        Ok(ToolOutput {
            text,
            data: Some(serde_json::json!({ "results": results })),
        })
    }
}