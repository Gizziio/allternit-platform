# A://AGENTS-WEB-311 — Build a Web Research Agent

**Outcome:** Automated research system that searches, extracts, ranks, and cites  
**Artifact:** Working research agent with API and evaluation results  
**Prerequisites:** A://CORE-REASONING-001, API fundamentals  
**Time:** 5-7 hours  
**Difficulty:** Intermediate

---

## Problem

Research is time-consuming:
- Manual search across multiple sources
- Reading and synthesizing information
- Verifying claims and finding citations
- Keeping track of sources

---

## What You're Building

A research agent that:
1. Takes a research question
2. Searches multiple sources
3. Extracts content from results
4. Ranks source relevance
5. Synthesizes a cited brief

**System Flow:**
```
Query → Search → Fetch → Extract → Rank → Synthesize → Cite
```

---

## Stack

| Component | Recommendation | Alternative |
|-----------|---------------|-------------|
| Search API | Serper (Google) | Brave Search, Bing |
| Web Fetch | ScrapingBee | Playwright, requests |
| Content Extract | Readability-lxml | Mozilla Readability |
| LLM | GPT-4 | Claude 3 |
| Backend | Python/FastAPI | Node.js |

---

## Implementation

### Step 1: Setup

```bash
mkdir web-research-agent
cd web-research-agent
python -m venv venv
source venv/bin/activate
pip install fastapi uvicorn openai requests beautifulsoup4 readability-lxml pydantic
```

### Step 2: Search Module

```python
import requests
import os
from typing import List, Dict

class SearchEngine:
    def __init__(self):
        self.api_key = os.getenv("SERPER_API_KEY")
        self.endpoint = "https://google.serper.dev/search"
    
    def search(self, query: str, num_results: int = 10) -> List[Dict]:
        """Search and return results."""
        headers = {
            "X-API-KEY": self.api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "q": query,
            "num": num_results
        }
        
        response = requests.post(self.endpoint, json=payload, headers=headers)
        data = response.json()
        
        results = []
        for item in data.get("organic", []):
            results.append({
                "title": item.get("title"),
                "url": item.get("link"),
                "snippet": item.get("snippet")
            })
        
        return results
```

### Step 3: Content Extraction

```python
import requests
from readability import Document
from bs4 import BeautifulSoup

class ContentExtractor:
    def fetch_and_extract(self, url: str) -> Dict:
        """Fetch URL and extract main content."""
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            # Parse with Readability
            doc = Document(response.text)
            title = doc.title()
            content = doc.summary()
            
            # Clean HTML
            soup = BeautifulSoup(content, 'html.parser')
            text = soup.get_text(separator='\n', strip=True)
            
            return {
                "url": url,
                "title": title,
                "content": text[:5000],  # Limit length
                "success": True
            }
        except Exception as e:
            return {
                "url": url,
                "error": str(e),
                "success": False
            }
```

### Step 4: Research Agent

```python
import openai
from typing import List, Dict

class ResearchAgent:
    def __init__(self):
        self.search_engine = SearchEngine()
        self.extractor = ContentExtractor()
        openai.api_key = os.getenv("OPENAI_API_KEY")
    
    def research(self, query: str, max_sources: int = 5) -> Dict:
        """Full research pipeline."""
        # Search
        search_results = self.search_engine.search(query, num_results=10)
        
        # Extract content from top results
        sources = []
        for result in search_results[:max_sources]:
            extracted = self.extractor.fetch_and_extract(result["url"])
            if extracted["success"]:
                sources.append({
                    **extracted,
                    "search_snippet": result["snippet"]
                })
        
        # Synthesize
        brief = self.synthesize(query, sources)
        
        return {
            "query": query,
            "brief": brief,
            "sources": [{"url": s["url"], "title": s["title"]} for s in sources],
            "num_sources": len(sources)
        }
    
    def synthesize(self, query: str, sources: List[Dict]) -> str:
        """Generate cited research brief."""
        # Prepare context
        context_parts = []
        for i, source in enumerate(sources):
            context_parts.append(f"""
Source [{i+1}]: {source['title']}
URL: {source['url']}
Content: {source['content'][:1500]}
""")
        
        context = "\n---\n".join(context_parts)
        
        prompt = f"""Based on the following sources, provide a comprehensive but concise answer to the research question. 

Research Question: {query}

Sources:
{context}

Instructions:
1. Synthesize information from multiple sources
2. Cite sources using [1], [2], etc.
3. If sources disagree, note the discrepancy
4. If information is missing, say so
5. Keep the response factual and neutral

Provide your answer:"""

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a research assistant that synthesizes information from web sources. Always cite your sources."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=1500
        )
        
        return response.choices[0].message.content

# Usage
if __name__ == "__main__":
    agent = ResearchAgent()
    result = agent.research("Latest developments in fusion energy 2024")
    print(result["brief"])
```

---

## Failure Modes

| Problem | Cause | Solution |
|---------|-------|----------|
| Poor sources | Broad query | Add search operators; filter domains |
| Extraction fails | JS-heavy sites | Use ScrapingBee/Playwright |
| Biased synthesis | Source imbalance | Diversify sources; flag bias |
| Outdated info | Stale search results | Add date filter; recency bias |
| Hallucinated citations | Source misattribution | Verify citations exist in sources |

---

## Evaluation

```python
test_queries = [
    {
        "query": "What are the main types of renewable energy?",
        "criteria": ["solar", "wind", "hydro", "geothermal"],
        "min_sources": 3
    },
    {
        "query": "Latest SpaceX Starship launch results",
        "criteria": ["date", "outcome", "next steps"],
        "recency_days": 30
    }
]
```

---

## Capstone

Submit:
1. Working API endpoint
2. 5 research examples with outputs
3. Source diversity analysis
4. Evaluation results

---

## Rubric

| Criterion | Exceeds | Meets | Below |
|-----------|---------|-------|-------|
| Source quality | Authoritative, diverse | Relevant | Poor or biased |
| Extraction | Clean content from 90%+ URLs | 70%+ success | <50% success |
| Citations | Accurate, verifiable | Present | Missing or wrong |
| Synthesis | Balanced, comprehensive | Coherent | Confused or biased |

---

**Build this. Deploy it. Research at scale.**
