use allternit_providers::adapters::openai::{LLMProvider, MockProvider, OpenAIProvider};
use allternit_tools::fs::FsTool;
use allternit_tools::search::SearchTool;
use serde_json::Value;
use std::env;
use std::sync::Arc;

pub struct Orchestrator {
    llm: Box<dyn LLMProvider>,
    fs_tool: FsTool,
    search_tool: SearchTool,
}

impl Orchestrator {
    pub fn new(fs_tool: FsTool, search_tool: SearchTool) -> Self {
        let llm: Box<dyn LLMProvider> = if let Ok(key) = env::var("OPENAI_API_KEY") {
            Box::new(OpenAIProvider::new(key, "gpt-4-turbo-preview".to_string()))
        } else {
            Box::new(MockProvider)
        };

        Self {
            llm,
            fs_tool,
            search_tool,
        }
    }

    pub async fn run(&self, intent: &str) -> anyhow::Result<String> {
        let system_prompt = r###"You are an intelligent agent. You have access to the following tools:
- web.search(query: str) -> str
- note.create(filename: str, content: str) -> str

To use a tool, output a line starting with "Action: " followed by the tool name and arguments in JSON format.
Example: Action: web.search({"query": "rust language"})

After the tool executes, I will give you the "Observation".
Then you must output "Thought: " followed by your reasoning.
Finally, output "Final Answer: " followed by your answer.
"###;

        let mut history = format!("Task: {}\n", intent);
        let mut steps = 0;

        while steps < 5 {
            let response = self.llm.complete(system_prompt, &history).await?;
            history.push_str(&format!("\n{}\n", response));

            if response.contains("Final Answer:") {
                return Ok(response);
            }

            if let Some(action_line) = response.lines().find(|l| l.starts_with("Action: ")) {
                let action_content = action_line.trim_start_matches("Action: ").trim();

                // Simple parsing for V0
                let observation = if action_content.starts_with("web.search") {
                    let json_str = action_content
                        .trim_start_matches("web.search")
                        .trim_matches(|c| c == '(' || c == ')');
                    let args: Value = serde_json::from_str(json_str)
                        .unwrap_or(serde_json::json!({"query": "unknown"}));
                    let query = args["query"].as_str().unwrap_or("unknown");

                    let result = self.search_tool.search(query).await?;
                    result.text
                } else if action_content.starts_with("note.create") {
                    let json_str = action_content
                        .trim_start_matches("note.create")
                        .trim_matches(|c| c == '(' || c == ')');
                    let args: Value = serde_json::from_str(json_str)
                        .unwrap_or(serde_json::json!({"filename": "error.md", "content": "error"}));
                    let filename = args["filename"].as_str().unwrap_or("error.md");
                    let content = args["content"].as_str().unwrap_or("error");

                    self.fs_tool.write(filename, content).await?;
                    format!("File {} created.", filename)
                } else {
                    "Error: Tool not found".to_string()
                };

                history.push_str(&format!("Observation: {}\n", observation));
            } else {
                // No action, maybe just thinking
                if steps > 0 && !response.contains("Thought:") {
                    return Ok(response); // Assuming chat completion if no tool used
                }
            }
            steps += 1;
        }

        Ok("Max steps reached.".to_string())
    }
}
