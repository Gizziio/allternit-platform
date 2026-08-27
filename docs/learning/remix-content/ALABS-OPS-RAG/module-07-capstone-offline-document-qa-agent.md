# Capstone: Offline Document-QA Agent

**Course:** ALABS-OPS-RAG — Build Private RAG & Document Intelligence  
**Tier:** OPS

## Bridge Concept

The capstone asks you to build a complete document-QA system that runs entirely offline on a single laptop. It must ingest PDFs, answer questions with inline citations, and survive a network-disconnect test. This is the exact profile of Allternit's field-deployment RAG: consultants need to query sensitive docs on airplanes, in client basements, or in jurisdictions with strict data-residency laws.

## Learning Objectives

- [ ] Assemble a full-stack offline RAG pipeline: PDF parser → chunker → local embedder → local LLM.
- [ ] Implement citation rendering so every claim is traceable to a source page/paragraph.
- [ ] Package the system so a non-technical user can run it with a single command.

## Demo Outline (10 min)

1. **End-to-End Run:** Drop a PDF into a folder, run the ingest script, then ask a question.
2. **Citation Inspection:** Show how the answer maps back to specific PDF pages.
3. **Disconnect Test:** Turn off Wi-Fi. Re-run the query. Confirm zero network activity.

## Challenge (Capstone — 60 min)

> **Build:** Create an offline Document-QA agent that:
> - Accepts a directory of PDFs as input.
> - Runs a local ingest pipeline (no cloud APIs).
> - Answers natural-language questions with citations.
> - Includes a simple CLI or web UI.
> - Passes the zero-network test.
>
> **Deliverable:** A GitHub repo link + a 2-minute screen recording of the offline test.

## Allternit Connection

- **Internal system:** mcp-apps-adapter has an offline mode for field deployments.
- **Reference repo/file:** \"scripts/offline_rag_demo.py\"
- **Key difference from standard approach:** Allternit's offline RAG uses quantized 7B models and aggressive caching. One model load serves hundreds of queries without reinitialization.
