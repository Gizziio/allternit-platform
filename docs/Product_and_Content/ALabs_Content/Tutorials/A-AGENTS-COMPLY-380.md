# A://AGENTS-COMPLY-380 — Build a Policy Assistant

**Outcome:** Compliance system that retrieves policies and answers with explicit references  
**Artifact:** Deployed policy assistant with audit trail  
**Prerequisites:** A://AGENTS-RAG-302, compliance fundamentals  
**Time:** 5-7 hours  
**Difficulty:** Intermediate

---

## Problem

Policy compliance is painful:
- Policies scattered across documents
- Employees can't find answers
- Decisions lack policy backing
- Audit trails are incomplete

---

## What You're Building

A policy assistant that:
1. Indexes all policy documents
2. Answers questions with citations
3. Flags policy conflicts
4. Maintains query audit trail
5. Escalates when uncertain

**System Flow:**
```
Question → Retrieve Policy → Analyze → Answer + Cite → Log → Escalate if needed
```

---

## Stack

| Component | Recommendation | Alternative |
|-----------|---------------|-------------|
| Policy Storage | SharePoint/Confluence API | PDF repository |
| Vector DB | Chroma | Pinecone |
| LLM | GPT-4 | Claude 3 |
| Audit DB | PostgreSQL | MySQL |
| Backend | Python/FastAPI | Node.js |

---

## Implementation

### Step 1: Policy Ingestion

```python
from typing import List, Dict
import os

class PolicyIngester:
    def __init__(self, storage_path: str = "./policies"):
        self.storage_path = storage_path
    
    def ingest_policy_document(self, file_path: str, metadata: Dict) -> Dict:
        """Ingest a policy document."""
        
        # Extract text based on file type
        if file_path.endswith('.pdf'):
            text = self._extract_pdf(file_path)
        elif file_path.endswith(('.docx', '.doc')):
            text = self._extract_word(file_path)
        else:
            with open(file_path, 'r') as f:
                text = f.read()
        
        # Parse policy structure
        policy = self._parse_policy(text, metadata)
        
        return policy
    
    def _extract_pdf(self, path: str) -> str:
        """Extract text from PDF."""
        import PyPDF2
        
        with open(path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
        return text
    
    def _parse_policy(self, text: str, metadata: Dict) -> Dict:
        """Parse policy into structured sections."""
        import re
        
        # Extract sections (e.g., "1. Purpose", "2. Scope")
        section_pattern = r'(?:^|\n)(\d+\.\s+[A-Z][^\n]+)'
        matches = list(re.finditer(section_pattern, text))
        
        sections = []
        for i, match in enumerate(matches):
            start = match.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            
            sections.append({
                "section_number": match.group(1).split('.')[0],
                "section_title": match.group(1).strip(),
                "content": text[start:end].strip()
            })
        
        return {
            "policy_id": metadata.get("policy_id"),
            "policy_name": metadata.get("policy_name"),
            "version": metadata.get("version", "1.0"),
            "effective_date": metadata.get("effective_date"),
            "owner": metadata.get("owner"),
            "full_text": text,
            "sections": sections,
            "metadata": metadata
        }
```

### Step 2: Policy Index

```python
import chromadb
from chromadb.utils import embedding_functions
import openai

class PolicyIndex:
    def __init__(self, db_path: str = "./policy_index"):
        self.client = chromadb.PersistentClient(path=db_path)
        self.embedding_fn = embedding_functions.OpenAIEmbeddingFunction(
            api_key=openai.api_key,
            model_name="text-embedding-3-small"
        )
        self.collection = self.client.get_or_create_collection(
            name="policies",
            embedding_function=self.embedding_fn
        )
    
    def index_policy(self, policy: Dict):
        """Index policy sections."""
        
        for section in policy["sections"]:
            doc_id = f"{policy['policy_id']}_sec{section['section_number']}"
            
            self.collection.add(
                documents=[section["content"]],
                metadatas=[{
                    "policy_id": policy["policy_id"],
                    "policy_name": policy["policy_name"],
                    "version": policy["version"],
                    "section_number": section["section_number"],
                    "section_title": section["section_title"],
                    "effective_date": policy["effective_date"]
                }],
                ids=[doc_id]
            )
    
    def query(self, question: str, policy_filter: str = None, n_results: int = 5) -> Dict:
        """Query policy index."""
        
        where_filter = {"policy_id": policy_filter} if policy_filter else None
        
        results = self.collection.query(
            query_texts=[question],
            n_results=n_results,
            where=where_filter
        )
        
        # Group by policy
        policies = {}
        for doc, meta in zip(results['documents'][0], results['metadatas'][0]):
            pid = meta['policy_id']
            if pid not in policies:
                policies[pid] = {
                    "policy_name": meta['policy_name'],
                    "version": meta['version'],
                    "sections": []
                }
            policies[pid]["sections"].append({
                "section_number": meta['section_number'],
                "section_title": meta['section_title'],
                "content": doc
            })
        
        return {
            "matches": results['documents'][0],
            "policies": list(policies.values()),
            "metadata": results['metadatas'][0]
        }
```

### Step 3: Policy Assistant

```python
import openai
from typing import Dict, List
from datetime import datetime

class PolicyAssistant:
    def __init__(self, index: PolicyIndex):
        self.index = index
        openai.api_key = os.getenv("OPENAI_API_KEY")
        self.audit_log = []
    
    def ask(self, question: str, user_id: str = None, policy_filter: str = None) -> Dict:
        """Answer policy question with citations."""
        
        # Retrieve relevant policies
        retrieval = self.index.query(question, policy_filter)
        
        # Build context
        context_parts = []
        for meta, doc in zip(retrieval['metadata'], retrieval['matches']):
            context_parts.append(f"""
Policy: {meta['policy_name']} (v{meta['version']})
Section {meta['section_number']}: {meta['section_title']}
{doc}
""")
        
        context = "\n---\n".join(context_parts)
        
        prompt = f"""You are a policy compliance assistant. Answer the question using ONLY the provided policy documents.

Policy Context:
{context}

Question: {question}

Instructions:
1. Answer directly if policy clearly addresses the question
2. Cite specific policy and section numbers
3. If multiple policies apply, note any conflicts
4. If uncertain, state "Policy guidance is unclear on this specific question"
5. Never make up policy that doesn't exist in the context

Provide your answer with citations."""

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a policy compliance assistant. Be precise and cite sources."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2
        )
        
        answer = response.choices[0].message.content
        
        # Check for conflicts
        conflicts = self._detect_conflicts(retrieval['metadata'])
        
        # Determine if escalation needed
        escalation_needed = (
            "unclear" in answer.lower() or
            "conflict" in answer.lower() or
            len(conflicts) > 0
        )
        
        result = {
            "question": question,
            "answer": answer,
            "citations": [
                {
                    "policy": m["policy_name"],
                    "version": m["version"],
                    "section": f"{m['section_number']}. {m['section_title']}"
                }
                for m in retrieval['metadata"]
            ],
            "conflicts": conflicts,
            "escalation_required": escalation_needed,
            "confidence": "high" if not escalation_needed else "low"
        }
        
        # Audit log
        self._log_query(user_id, question, result)
        
        return result
    
    def _detect_conflicts(self, metadata: List[Dict]) -> List[Dict]:
        """Detect potential policy conflicts."""
        conflicts = []
        
        # Simple conflict detection: different policies on same topic
        policies = set(m["policy_id"] for m in metadata)
        if len(policies) > 1:
            conflicts.append({
                "type": "multiple_policies",
                "message": "Multiple policies may apply. Review for consistency.",
                "policies": list(policies)
            })
        
        return conflicts
    
    def _log_query(self, user_id: str, question: str, result: Dict):
        """Log query for audit."""
        self.audit_log.append({
            "timestamp": datetime.now().isoformat(),
            "user_id": user_id,
            "question": question,
            "policies_cited": [c["policy"] for c in result["citations"]],
            "escalation_required": result["escalation_required"],
            "confidence": result["confidence"]
        })
```

### Step 4: API

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

# Initialize
index = PolicyIndex()
assistant = PolicyAssistant(index)

class QuestionRequest(BaseModel):
    question: str
    user_id: str = None
    policy_filter: str = None

@app.post("/ask")
async def ask_policy(request: QuestionRequest):
    result = assistant.ask(
        request.question,
        request.user_id,
        request.policy_filter
    )
    return result

@app.post("/policies/upload")
async def upload_policy(file: UploadFile, metadata: str = Form(...)):
    """Upload and index a policy document."""
    meta = json.loads(metadata)
    
    # Save file
    file_path = f"./uploads/{file.filename}"
    with open(file_path, "wb") as f:
        f.write(await file.read())
    
    # Ingest
    ingester = PolicyIngester()
    policy = ingester.ingest_policy_document(file_path, meta)
    
    # Index
    index.index_policy(policy)
    
    return {"status": "indexed", "policy_id": policy["policy_id"]}

@app.get("/audit")
async def get_audit_log(user_id: str = None):
    """Get audit log."""
    logs = assistant.audit_log
    if user_id:
        logs = [l for l in logs if l["user_id"] == user_id]
    return {"logs": logs}
```

---

## Capstone

Submit:
1. Working policy assistant
2. Sample Q&A with citations
3. Audit log demonstration
4. Conflict detection example

---

**Build this. Deploy it. Stay compliant.**
