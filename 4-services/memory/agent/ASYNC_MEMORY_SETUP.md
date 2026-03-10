# 24/7 Asynchronous Memory System - Setup Complete

**Strategy**: Overnight consolidation + Background ingestion = Always prepared memory

---

## What We Built

```
┌─────────────────────────────────────────────────────────┐
│  WHILE YOU SLEEP (3 AM Daily)                           │
│  ╔══════════════════════════════════════════════════╗   │
│  ║  Daily Consolidation Script                      ║   │
│  ║  ├─ Process all new memories                     ║   │
│  ║  ├─ Find connections between ideas               ║   │
│  ║  ├─ Generate insights                            ║   │
│  ║  └─ Pre-compute common queries                   ║   │
│  ╚══════════════════════════════════════════════════╝   │
├─────────────────────────────────────────────────────────┤
│  WHILE YOU WORK                                         │
│  ╔══════════════════════════════════════════════════╗   │
│  ║  Background File Watcher                         ║   │
│  ║  ├─ Watches ./inbox for new files                ║   │
│  ║  ├─ Queues files for processing                  ║   │
│  ║  └─ Zero GPU required (just queues)              ║   │
│  ╚══════════════════════════════════════════════════╝   │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Setup (3 Commands)

### 1. Setup Cron Job (Daily Consolidation at 3 AM)

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/4-services/memory/agent

./scripts/setup-cron.sh
```

### 2. Start File Watcher (Background)

```bash
# Start file watcher (runs 24/7, minimal resources)
pnpm run start:watcher &

# Or as daemon
pnpm run daemon start
```

### 3. Test Consolidation

```bash
# Run consolidation manually to test
./scripts/daily-consolidate.sh
```

---

## Daily Workflow

### Morning (You're Working)

```bash
# Drop files in inbox anytime
echo "Meeting notes: We decided on microservices" > inbox/meeting.txt
cp ~/docs/architecture.md inbox/

# Watcher automatically queues them
# (No GPU used, just records the queue)
```

### Overnight (3 AM)

```
[3:00 AM] Cron triggers daily-consolidate.sh
[3:01 AM] Loads queued files
[3:02 AM] Uses Qwen 3.5 (smallest/fastest) to:
          ├─ Summarize each file
          ├─ Extract entities & topics
          ├─ Find connections between memories
          └─ Generate insights
[3:30 AM] Consolidation complete
[3:31 AM] All memories organized & connected
```

### Next Morning

```bash
# Query your organized memory
curl http://localhost:3201/api/query \
  -d '{"question": "What did I learn this week?"}'

# Responses are FAST because:
# - Consolidation happened overnight
# - Insights pre-computed
# - Connections already found
```

---

## Scripts Created

| Script | Purpose | Schedule |
|--------|---------|----------|
| `daily-consolidate.sh` | Run overnight consolidation | 3 AM daily (cron) |
| `setup-cron.sh` | Setup automated schedule | Run once |
| `watcher.ts` | Watch inbox for new files | 24/7 background |

---

## Commands

### Management

```bash
# Start file watcher (background)
pnpm run start:watcher

# Start HTTP API (for queries)
pnpm run start:http

# Run consolidation manually
pnpm run consolidate:daily

# Setup cron (run once)
pnpm run setup:cron

# Check status
pnpm run daemon status

# View logs
pnpm run daemon logs
```

### Logs

```bash
# Watcher logs
tail -f /tmp/memory-watcher.log

# Consolidation logs
tail -f /tmp/memory-consolidate-*.log

# Cron logs
tail -f /tmp/memory-cron.log

# Ingest queue
cat /tmp/memory-ingest-queue.json
```

---

## Resource Usage

| Component | CPU | RAM | GPU | When |
|-----------|-----|-----|-----|------|
| **File Watcher** | <1% | ~50MB | ❌ | 24/7 |
| **HTTP API** | <1% | ~100MB | ❌ | On-demand |
| **Consolidation** | 50-100% | ~500MB | ✅ (overnight) | 3 AM daily |

**Key**: GPU only used during overnight consolidation when you're not using the VPS!

---

## Performance Optimization

### Using Smallest Model for Speed

```bash
# .env configured for overnight speed
OLLAMA_CONSOLIDATE_MODEL=qwen3.5:0.8b  # Fastest
OLLAMA_QUERY_MODEL=qwen3.5:2b          # Balanced
```

### Why This Works

1. **Overnight = No Time Pressure**
   - Can take 30-60 minutes to consolidate
   - You're sleeping, no rush

2. **Pre-computed = Fast Queries**
   - Insights already generated
   - Connections already found
   - Query just retrieves pre-computed results

3. **Queue-Based = No Blocking**
   - Drop files anytime
   - They wait in queue
   - Processed overnight

---

## What To Expect

### Week 1: Building Base

```
Day 1: Drop 10 files → Overnight: Process 10 files
Day 2: Drop 5 files  → Overnight: Process 5 files + connect to Day 1
Day 3: Drop 20 files → Overnight: Process 20 files + find patterns
...
Day 7: 100+ memories, 20+ insights, 50+ connections
```

### Week 2+: Compound Knowledge

```
Your memory grows intelligently:
- New memories connect to old ones
- Patterns emerge across days
- Insights build on each other
```

### Query Speed

| Query Type | Speed | Why |
|------------|-------|-----|
| **Pre-computed insights** | <1 sec | Already generated |
| **Simple fact lookup** | 5-10 sec | Direct retrieval |
| **Complex synthesis** | 30-60 sec | Requires LLM |

---

## Cron Schedule

Default: **3:00 AM daily**

Change it:

```bash
crontab -e

# Change this line:
0 3 * * * /path/to/daily-consolidate.sh

# Examples:
0 2 * * *  # 2 AM
0 4 * * *  # 4 AM
0 3 * * 0  # 3 AM Sundays only
```

---

## Troubleshooting

### Watcher Not Starting

```bash
# Check if already running
ps aux | grep watcher

# Kill existing
pkill -f "tsx src/watcher"

# Restart
pnpm run start:watcher
```

### Consolidation Not Running

```bash
# Check cron
crontab -l | grep consolidate

# Check logs
cat /tmp/memory-cron.log

# Test manually
./scripts/daily-consolidate.sh
```

### Queue Not Processing

```bash
# Check queue
cat /tmp/memory-ingest-queue.json

# Manually process
pnpm run ingest:all
```

---

## Advanced: Pre-Compute Common Queries

Add to `daily-consolidate.sh`:

```bash
# Pre-compute common queries overnight
curl -X POST http://localhost:3201/api/query \
  -d '{"question": "What are the main themes this week?"}' \
  -o /tmp/cache/themes.json

curl -X POST http://localhost:3201/api/query \
  -d '{"question": "What tasks did I complete?"}' \
  -o /tmp/cache/tasks.json
```

Then queries are **instant** during the day!

---

## Summary

```
✅ File Watcher: Runs 24/7 (minimal resources)
✅ Daily Consolidation: 3 AM overnight (uses GPU)
✅ Pre-computed Insights: Fast queries during day
✅ Queue-Based: Drop files anytime, processed overnight

🎯 Result: Always organized, always prepared
   GPU limitation doesn't matter because
   heavy lifting happens while you sleep!
```

---

**Next Steps:**

1. Run `./scripts/setup-cron.sh` (one-time)
2. Start watcher: `pnpm run start:watcher &`
3. Drop files in `inbox/` anytime
4. Wake up to organized memory!
