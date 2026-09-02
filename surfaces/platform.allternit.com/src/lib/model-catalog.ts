export interface CatalogModel {
  id: string;
  name: string;
  family: string;
  provider: "local" | "cloud";
  inputPrice: string;
  outputPrice: string;
  context: string;
}

export const DRAFT_MODEL_CATALOG: CatalogModel[] = [
  { id: "llama-3.1-8b", name: "Llama 3.1 8B", family: "Llama", provider: "local", inputPrice: "$0", outputPrice: "$0", context: "128K" },
  { id: "llama-3.1-70b", name: "Llama 3.1 70B", family: "Llama", provider: "local", inputPrice: "$0", outputPrice: "$0", context: "128K" },
  { id: "qwen2.5-7b", name: "Qwen 2.5 7B", family: "Qwen", provider: "local", inputPrice: "$0", outputPrice: "$0", context: "128K" },
  { id: "qwen2.5-72b", name: "Qwen 2.5 72B", family: "Qwen", provider: "local", inputPrice: "$0", outputPrice: "$0", context: "128K" },
  { id: "mistral-nemo", name: "Mistral Nemo", family: "Mistral", provider: "local", inputPrice: "$0", outputPrice: "$0", context: "128K" },
  { id: "mistral-large", name: "Mistral Large 2", family: "Mistral", provider: "cloud", inputPrice: "$2.00", outputPrice: "$6.00", context: "128K" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", family: "Claude", provider: "cloud", inputPrice: "$3.00", outputPrice: "$15.00", context: "200K" },
  { id: "claude-3-opus", name: "Claude 3 Opus", family: "Claude", provider: "cloud", inputPrice: "$15.00", outputPrice: "$75.00", context: "200K" },
  { id: "gpt-4o", name: "GPT-4o", family: "GPT", provider: "cloud", inputPrice: "$5.00", outputPrice: "$15.00", context: "128K" },
  { id: "gpt-4o-mini", name: "GPT-4o mini", family: "GPT", provider: "cloud", inputPrice: "$0.15", outputPrice: "$0.60", context: "128K" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", family: "Gemini", provider: "cloud", inputPrice: "$3.50", outputPrice: "$10.50", context: "1M" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", family: "Gemini", provider: "cloud", inputPrice: "$0.35", outputPrice: "$1.05", context: "1M" },
];
