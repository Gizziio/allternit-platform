# A://AGENTS-KB-350 — Build an Internal Knowledge Base Assistant

**Outcome:** Unified search across docs, Slack, and SOPs with Q&A  
**Artifact:** Deployed KB assistant with multiple source ingestion  
**Prerequisites:** A://AGENTS-RAG-302, A://OPS-KNOWLEDGE-204  
**Time:** 5-7 hours  
**Difficulty:** Intermediate

---

## Problem

Company knowledge is fragmented:
- Docs in Confluence/Notion
- Decisions in Slack threads
- Processes in PDFs
- No unified search

---

## What You're Building

A KB assistant that:
1. Connects to multiple sources (docs, Slack, PDFs)
2. Normalizes and indexes content
3. Answers questions with source attribution
4. Surfaces relevant SOPs and decisions

**System Flow:**
```
Sources → Connect → Extract → Normalize → Index → Query → Answer + Cite
```

---

## Stack

| Component | Recommendation | Alternative |
|-----------|---------------|-------------|
| Doc Sources | Notion API, Confluence API | Google Docs |
| Slack Export | Slack API | Export ZIP |
| Vector DB | Chroma | Pinecone |
| Embeddings | OpenAI | Local models |
| Backend | Python/FastAPI | Node.js |

---

## Implementation

### Step 1: Source Connectors

```python
from abc import ABC, abstractmethod
from typing import List, Dict
import requests

class SourceConnector(ABC):
    """Abstract base for knowledge sources."""
    
    @abstractmethod
    def fetch_all(self) -> List[Dict]:
        """Fetch all documents from source."""
        pass
    
    @abstractmethod
    def normalize(self, raw_doc: Dict) -> Dict:
        """Normalize to standard format."""
        pass

class NotionConnector(SourceConnector):
    def __init__(self, token: str):
        self.token = token
        self.base_url = "https://api.notion.com/v1"
    
    def fetch_all(self) -> List[Dict]:
        """Fetch all pages from Notion workspace."""
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Notion-Version": "2022-06-28"
        }
        
        # Search for all pages
        response = requests.post(
            f"{self.base_url}/search",
            headers=headers,
            json={"page_size": 100}
        )
        
        pages = response.json().get("results", [])
        documents = []
        
        for page in pages:
            if page["object"] == "page":
                content = self._fetch_page_content(page["id"], headers)
                documents.append({
                    "source": "notion",
                    "id": page["id"],
                    "title": self._extract_title(page),
                    "content": content,
                    "url": page["url"],
                    "last_edited": page["last_edited_time"]
                })
        
        return documents
    
    def _fetch_page_content(self, page_id: str, headers: dict) -> str:
        """Fetch block content of a page."""
        response = requests.get(
            f"{self.base_url}/blocks/{page_id}/children",
            headers=headers
        )
        
        blocks = response.json().get("results", [])
        text_parts = []
        
        for block in blocks:
            block_type = block["type"]
            if block_type in ["paragraph", "heading_1", "heading_2", "heading_3", "bulleted_list_item"]:
                text = self._extract_text_from_block(block)
                if text:
                    text_parts.append(text)
        
        return "\n".join(text_parts)
    
    def _extract_text_from_block(self, block: dict) -> str:
        """Extract text from a Notion block."""
        block_type = block["type"]
        rich_text = block.get(block_type, {}).get("rich_text", [])
        return "".join([t.get("plain_text", "") for t in rich_text])
    
    def _extract_title(self, page: dict) -> str:
        """Extract page title."""
        properties = page.get("properties", {})
        title_prop = properties.get("title", {})
        titles = title_prop.get("title", [])
        return "".join([t.get("plain_text", "") for t in titles]) or "Untitled"
    
    def normalize(self, raw_doc: Dict) -> Dict:
        """Normalize to standard format."""
        return {
            "id": f"notion_{raw_doc['id']}",
            "source": "notion",
            "title": raw_doc["title"],
            "content": raw_doc["content"],
            "url": raw_doc["url"],
            "metadata": {
                "last_edited": raw_doc["last_edited"]
            }
        }

class SlackConnector(SourceConnector):
    def __init__(self, token: str):
        self.token = token
    
    def fetch_all(self) -> List[Dict]:
        """Fetch messages from important channels."""
        # Implementation depends on Slack API scopes
        # Fetch from channels, handle rate limits
        pass
    
    def normalize(self, raw_doc: Dict) -> Dict:
        """Normalize Slack message/thread."""
        return {
            "id": f"slack_{raw_doc['channel']}_{raw_doc['ts']}",
            "source": "slack",
            "title": f"#{raw_doc['channel']} - {raw_doc['date']}",
            "content": raw_doc["text"],
            "url": raw_doc.get("permalink", ""),
            "metadata": {
                "channel": raw_doc["channel"],
                "author": raw_doc.get("user", "unknown"),
                "thread": raw_doc.get("is_thread", False)
            }
        }
```

### Step 2: Knowledge Base Index

```python
import chromadb
from chromadb.utils import embedding_functions
import openai

class KnowledgeBase:
    def __init__(self, db_path: str = "./kb_index"):
        self.client = chromadb.PersistentClient(path=db_path)
        self.embedding_fn = embedding_functions.OpenAIEmbeddingFunction(
            api_key=openai.api_key,
            model_name="text-embedding-3-small"
        )
        self.collection = self.client.get_or_create_collection(
            name="knowledge",
            embedding_function=self.embedding_fn
        )
    
    def ingest_from_source(self, connector: SourceConnector):
        """Ingest all documents from a source."""
        raw_docs = connector.fetch_all()
        
        for raw_doc in raw_docs:
            normalized = connector.normalize(raw_doc)
            self._index_document(normalized)
    
    def _index_document(self, doc: Dict):
        """Index a single normalized document."""
        # Chunk if needed
        chunks = self._chunk_content(doc["content"])
        
        for i, chunk in enumerate(chunks):
            self.collection.add(
                documents=[chunk],
                metadatas=[{
                    "doc_id": doc["id"],
                    "source": doc["source"],
                    "title": doc["title"],
                    "url": doc.get("url", ""),
                    "chunk_index": i,
                    **doc.get("metadata", {})
                }],
                ids=[f"{doc['id']}_chunk_{i}"]
            )
    
    def _chunk_content(self, content: str, max_chunk_size: int = 1000) -> List[str]:
        """Split content into chunks."""
        if len(content) <= max_chunk_size:
            return [content]
        
        chunks = []
        paragraphs = content.split("\n\n")
        current_chunk = ""
        
        for para in paragraphs:
            if len(current_chunk) + len(para) < max_chunk_size:
                current_chunk += para + "\n\n"
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = para + "\n\n"
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def query(self, question: str, source_filter: str = None, n_results: int = 5) -> Dict:
        """Query the knowledge base."""
        
        where_filter = {"source": source_filter} if source_filter else None
        
        results = self.collection.query(
            query_texts=[question],
            n_results=n_results,
            where=where_filter
        )
        
        # Group by source document
        sources = {}
        for doc, meta in zip(results['documents'][0], results['metadatas'][0]):
            doc_id = meta['doc_id']
            if doc_id not in sources:
                sources[doc_id] = {
                    "title": meta['title'],
                    "source": meta['source'],
                    "url": meta['url'],
                    "chunks": []
                }
            sources[doc_id]["chunks"].append(doc)
        
        return {
            "answer_context": "\n\n---\n\n".join(results['documents'][0]),
            "sources": list(sources.values())
        }
```

### Step 3: Q&A Interface

```python
import openai

class KBAnswering:
    def __init__(self, kb: KnowledgeBase):
        self.kb = kb
        openai.api_key = os.getenv("OPENAI_API_KEY")
    
    def ask(self, question: str, source_filter: str = None) -> Dict:
        """Answer a question using the knowledge base."""
        
        # Retrieve relevant context
        retrieval = self.kb.query(question, source_filter)
        
        prompt = f"""Answer the following question based on the provided knowledge base content.
If the answer is not in the provided content, say "I don't have that information in my knowledge base."

Knowledge Base Content:
{retrieval['answer_context']}

Question: {question}

Provide:
1. A clear, direct answer
2. Source citations [Source: Title]
3. Relevant URLs if available"""

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful knowledge base assistant. Always cite your sources."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )
        
        return {
            "answer": response.choices[0].message.content,
            "sources": retrieval['sources']
        }
    
    def find_sop(self, task: str) -> Dict:
        """Find relevant SOP for a task."""
        return self.ask(f"What is the SOP or process for: {task}")
    
    def find_decision(self, topic: str) -> Dict:
        """Find past decisions on a topic."""
        return self.ask(f"What decisions have been made about: {topic}", source_filter="slack")
```

### Step 4: API

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

# Initialize
kb = KnowledgeBase()

# Ingest from sources
# notion = NotionConnector(os.getenv("NOTION_TOKEN"))
# kb.ingest_from_source(notion)

qa = KBAnswering(kb)

class QuestionRequest(BaseModel):
    question: str
    source: str = None  # Optional filter

@app.post("/ask")
async def ask_question(request: QuestionRequest):
    result = qa.ask(request.question, request.source)
    return result

@app.post("/ingest/notion")
async def ingest_notion():
    connector = NotionConnector(os.getenv("NOTION_TOKEN"))
    kb.ingest_from_source(connector)
    return {"status": "ingested"}

@app.get("/sources")
async def list_sources():
    # Return list of indexed sources
    return {"sources": ["notion", "slack", "confluence"]}
```

---

## Capstone

Submit:
1. Working KB with 2+ source types
2. Query examples with citations
3. SOP lookup demo
4. Source synchronization

---

**Build this. Deploy it. Know everything.**
