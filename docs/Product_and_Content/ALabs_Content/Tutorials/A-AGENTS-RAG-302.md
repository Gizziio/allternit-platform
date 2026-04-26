# A://AGENTS-RAG-302 — Build a Document Intelligence Assistant

**Outcome:** Working RAG system with ingestion, retrieval, and citation  
**Artifact:** Deployed document Q&A system with evaluation results  
**Prerequisites:** A://CORE-REASONING-001, basic Python/Node.js  
**Time:** 4-6 hours  
**Difficulty:** Intermediate

---

## Problem

You have documents (PDFs, notes, files) but:
- They are hard to search
- Answers require manual reading
- Knowledge is fragmented across sources

---

## What You're Building

A system that:
1. Ingests documents from multiple sources
2. Chunks and embeds them
3. Stores in vector database
4. Answers questions using retrieval (RAG)
5. Cites sources for verification

**System Flow:**
```
Documents → Chunk → Embed → Store → Query → Retrieve → Generate Answer → Cite Sources
```

---

## Stack

| Component | Recommendation | Alternative |
|-----------|---------------|-------------|
| LLM API | OpenAI GPT-4 | Claude, local Ollama |
| Embeddings | OpenAI text-embedding-3-small | Cohere, local |
| Vector DB | Chroma (local) | Pinecone, Weaviate |
| Backend | Python (FastAPI) | Node.js + Express |
| Document Parsing | PyPDF2, python-docx | Unstructured.io |

---

## Implementation

### Step 1: Project Setup

```bash
mkdir document-intelligence
cd document-intelligence
python -m venv venv
source venv/bin/activate
pip install fastapi uvicorn chromadb openai pypdf2 python-dotenv
```

Create `.env`:
```
OPENAI_API_KEY=your_key_here
```

### Step 2: Document Ingestion

Create `ingest.py`:

```python
import os
import PyPDF2
from typing import List, Dict
import openai
import chromadb
from chromadb.utils import embedding_functions

class DocumentIngester:
    def __init__(self, db_path: str = "./chroma_db"):
        self.client = chromadb.PersistentClient(path=db_path)
        self.embedding_fn = embedding_functions.OpenAIEmbeddingFunction(
            api_key=os.getenv("OPENAI_API_KEY"),
            model_name="text-embedding-3-small"
        )
        self.collection = self.client.get_or_create_collection(
            name="documents",
            embedding_function=self.embedding_fn
        )
    
    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """Extract text from PDF file."""
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
        return text
    
    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 100) -> List[str]:
        """Split text into overlapping chunks."""
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start = end - overlap
        return chunks
    
    def ingest_document(self, file_path: str, doc_name: str):
        """Ingest a document into the vector store."""
        # Extract text
        if file_path.endswith('.pdf'):
            text = self.extract_text_from_pdf(file_path)
        else:
            with open(file_path, 'r') as f:
                text = f.read()
        
        # Chunk
        chunks = self.chunk_text(text)
        
        # Store with metadata
        for i, chunk in enumerate(chunks):
            self.collection.add(
                documents=[chunk],
                metadatas=[{
                    "source": doc_name,
                    "chunk_index": i,
                    "total_chunks": len(chunks)
                }],
                ids=[f"{doc_name}_chunk_{i}"]
            )
        
        return len(chunks)

# Usage
if __name__ == "__main__":
    ingester = DocumentIngester()
    num_chunks = ingester.ingest_document("./docs/handbook.pdf", "Employee Handbook")
    print(f"Ingested {num_chunks} chunks")
```

### Step 3: Query System

Create `query.py`:

```python
import os
import openai
import chromadb
from chromadb.utils import embedding_functions
from typing import List, Dict

class RAGQuery:
    def __init__(self, db_path: str = "./chroma_db"):
        self.client = chromadb.PersistentClient(path=db_path)
        self.embedding_fn = embedding_functions.OpenAIEmbeddingFunction(
            api_key=os.getenv("OPENAI_API_KEY"),
            model_name="text-embedding-3-small"
        )
        self.collection = self.client.get_collection(
            name="documents",
            embedding_function=self.embedding_fn
        )
        openai.api_key = os.getenv("OPENAI_API_KEY")
    
    def retrieve(self, query: str, n_results: int = 5) -> Dict:
        """Retrieve relevant chunks."""
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results
        )
        return results
    
    def generate_answer(self, query: str, contexts: List[str], sources: List[Dict]) -> Dict:
        """Generate answer with citations."""
        context_text = "\n\n---\n\n".join(contexts)
        
        prompt = f"""Answer the question using ONLY the provided context. 
If the answer is not in the context, say "I don't have enough information."

Context:
{context_text}

Question: {query}

Provide your answer and list the sources used."""

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that answers based on provided documents. Always cite your sources."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )
        
        return {
            "answer": response.choices[0].message.content,
            "sources": sources
        }
    
    def query(self, question: str) -> Dict:
        """Full RAG pipeline."""
        # Retrieve
        results = self.retrieve(question)
        contexts = results['documents'][0]
        sources = [
            {"source": meta["source"], "chunk": meta["chunk_index"]}
            for meta in results['metadatas'][0]
        ]
        
        # Generate
        answer = self.generate_answer(question, contexts, sources)
        return answer

# Usage
if __name__ == "__main__":
    rag = RAGQuery()
    result = rag.query("What is the vacation policy?")
    print(f"Answer: {result['answer']}")
    print(f"Sources: {result['sources']}")
```

### Step 4: API Server

Create `main.py`:

```python
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ingest import DocumentIngester
from query import RAGQuery
import shutil
import os

app = FastAPI(title="Document Intelligence API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ingester = DocumentIngester()
rag = RAGQuery()

class QueryRequest(BaseModel):
    question: str

@app.post("/ingest")
async def ingest_document(file: UploadFile = File(...)):
    """Upload and ingest a document."""
    temp_path = f"./temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        num_chunks = ingester.ingest_document(temp_path, file.filename)
        return {"status": "success", "chunks": num_chunks, "document": file.filename}
    finally:
        os.remove(temp_path)

@app.post("/query")
async def query_documents(request: QueryRequest):
    """Query the document database."""
    result = rag.query(request.question)
    return result

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Step 5: Run and Test

```bash
python main.py
```

Test with curl:
```bash
# Ingest a document
curl -X POST -F "file=@./handbook.pdf" http://localhost:8000/ingest

# Query
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the vacation policy?"}'
```

---

## Failure Modes

| Problem | Cause | Solution |
|---------|-------|----------|
| Wrong answers | Bad chunking | Adjust chunk size/overlap; use semantic chunking |
| Missing context | Retrieval too narrow | Increase n_results; add re-ranking |
| Hallucinations | Irrelevant chunks retrieved | Add relevance threshold; filter low scores |
| Too slow | Large context window | Summarize chunks; use hierarchical retrieval |
| Source confusion | Similar docs | Add doc metadata; improve chunk IDs |

---

## Evaluation

Create `eval.py`:

```python
import json
from query import RAGQuery

# Test set
test_questions = [
    {
        "question": "What is the vacation policy?",
        "expected": "contains: PTO, days, accrual",
        "should_cite": ["Employee Handbook"]
    },
    {
        "question": "Who is the CEO?",
        "expected": "contains: name",
        "should_cite": ["About Us", "Team"]
    },
    {
        "question": "What is the meaning of life?",
        "expected": "response: insufficient information",
        "should_cite": []
    }
]

def evaluate():
    rag = RAGQuery()
    results = []
    
    for test in test_questions:
        response = rag.query(test["question"])
        results.append({
            "question": test["question"],
            "response": response,
            "expected": test["expected"]
        })
    
    # Save results
    with open("eval_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"Evaluated {len(test_questions)} questions")
    print("Results saved to eval_results.json")

if __name__ == "__main__":
    evaluate()
```

---

## Capstone Requirements

Submit:
1. **Working system** — Code repository with README
2. **Deployed instance** — URL or screenshot of running API
3. **Query examples** — 5+ example queries with responses
4. **Evaluation results** — Test set results showing accuracy
5. **Source citations** — Evidence of proper attribution

---

## Upgrade Paths

1. **Add UI** — Build React frontend for drag-drop upload
2. **Multi-modal** — Support images, audio, video
3. **Memory** — Conversation history and follow-up questions
4. **Multi-doc routing** — Route queries to relevant doc collections
5. **Agent layer** — Add planning and tool use

---

## Rubric

| Criterion | Exceeds | Meets | Below |
|-----------|---------|-------|-------|
| System works | Handles 3+ doc types, 1000+ pages | PDF + text working | Only works on demo data |
| Retrieval quality | >90% relevant chunks | >70% relevant | <50% relevant |
| Citations | Every claim sourced | Most claims sourced | Missing sources |
| Evaluation | Comprehensive test set | Basic tests | No tests |
| Code quality | Documented, tested, structured | Clean, runnable | Messy, undocumented |

---

**Build this. Submit it. Prove you can deploy RAG.**
