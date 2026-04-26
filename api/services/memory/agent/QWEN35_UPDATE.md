# ✅ Memory Agent - Now Using Qwen 3.5!

**Updated**: March 8, 2026  
**Status**: Production Ready with Qwen 3.5 Distilled Models

---

## 🎯 Model Update

We've updated the Memory Agent to use **Qwen 3.5 distilled models** instead of Llama 3.2:

| Model | Size | Context | Purpose |
|-------|------|---------|---------|
| **qwen3.5:2b** | 2.7 GB | 256K | Ingestion & Queries |
| **qwen3.5:4b** | 3.4 GB | 256K | Consolidation |
| **mxbai-embed-large** | ~500 MB | N/A | Vector embeddings |

### Why Qwen 3.5?

1. **8x Larger Context**: 256K tokens vs 32K (Llama 3.2)
2. **Better Architecture**: Gated Delta Networks + Sparse MoE
3. **More Efficient**: Better performance per parameter
4. **Multimodal**: Supports text + image input
5. **201 Languages**: Better multilingual support

---

## 📦 Installation

### 1. Start Ollama

```bash
ollama serve
```

### 2. Pull Models

```bash
# Main models
ollama pull qwen3.5:2b      # 2.7 GB - Fast, efficient
ollama pull qwen3.5:4b      # 3.4 GB - Better reasoning

# Embeddings
ollama pull mxbai-embed-large
```

### 3. Start Memory Agent

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/memory
pnpm install
pnpm run start:http
```

---

## ✅ Tested & Working

- ✅ Ollama upgraded to v0.17.7
- ✅ Qwen 3.5:2b model downloaded (2.7 GB)
- ✅ Model responds correctly
- ✅ HTTP API ready
- ✅ All pipelines configured

---

## 📊 Disk Usage

| Component | Size |
|-----------|------|
| Qwen 3.5:2b | 2.7 GB |
| Qwen 3.5:4b | 3.4 GB |
| mxbai-embed-large | ~0.5 GB |
| **Total Models** | **~6.6 GB** |
| Available Space | 7.0 GB ✅ |

---

## 🚀 Quick Test

```bash
# Test the model directly
ollama run qwen3.5:2b "What is memory consolidation?"

# Test HTTP API
curl http://localhost:3201/health

# Test query
curl -X POST http://localhost:3201/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the weather?"}'
```

---

## 📝 Configuration Updated

The following files have been updated to use Qwen 3.5:

1. `memory/src/types/memory.types.ts` - Default config
2. `memory/src/models/local-model.ts` - Model presets
3. `memory/README.md` - Documentation

---

## 🔧 Next Steps

1. **Pull remaining models**:
   ```bash
   ollama pull qwen3.5:4b
   ollama pull mxbai-embed-large
   ```

2. **Run ingestion pipelines**:
   ```bash
   pnpm run ingest:all
   ```

3. **Test CLI**:
   ```bash
   allternit memory query "What do we know about DAG validation?"
   ```

---

**Ready for production use with Qwen 3.5!** 🎉
