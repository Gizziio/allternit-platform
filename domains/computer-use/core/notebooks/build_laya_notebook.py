"""Build notebooks/laya_finetune_kaggle.ipynb (draft, prep-only).

Cell bodies mirror the official Laya Kaggle notebook
(github.com/NandhaKishorM/laya, notebooks/laya_finetune_typed_decisions_2xT4_kaggle.ipynb)
where they are unchanged (install, DDP train script, calibration); the
data path replaces LocalLLaMA/typed-decisions with our exported JEV trace
cases (scripts/export_laya_finetune.py output, realigned gold).
"""

import json
from pathlib import Path

OUT = Path(__file__).resolve().parent / "laya_finetune_kaggle.ipynb"

CELLS = []


def md(source):
    CELLS.append({"cell_type": "markdown", "metadata": {}, "source": source})


def code(source):
    CELLS.append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": source,
    })


md("""# Fine-Tuning Laya on Allternit JEV Shadow-Head Traces (Kaggle 2×T4 DDP)

Draft — **prep only** (no Kaggle credentials on the authoring machine; run by
uploading this notebook to Kaggle with the trace export as Input).

Fine-tunes **Laya** (`convaiinnovations/laya`, ModernBERT RLCD System 1
decision model, Apache-2.0) on labeled shadow-head traces from the Allternit
computer-use harness (`core/trace_recorder.py` JSONL, exported by
`scripts/export_laya_finetune.py` to the `LocalLLaMA/typed-decisions` row
schema). The fine-tuned checkpoint is a drop-in for `core/laya_head.LayaHead`
via `model=/path/to/checkpoint` (`laya.Agent` accepts local directories).

### Kaggle Notebook Settings (right sidebar → Notebook options)
* **Accelerator:** `GPU T4 x2` (both GPUs are used via DDP)
* **Internet:** `On`
* **Input:** upload the trace export (`laya-cases-*.jsonl`, produced by
  `scripts/export_laya_finetune.py`) as a Dataset; it mounts under
  `/kaggle/input/`
* **Output:** `/kaggle/working/laya_finetuned_jev` — download the whole
  directory (model.safetensors + rl_agent_config.json + tokenizer/ + encoder/)

### Training-budget assumptions (free 2×T4 session, ~4–9 h cap)
* Trace states are the canonical shadow state text (~0.5–2k tokens); the
  preprocessor pads to `max_len=1024`, `head_max_len=256` (same bump the
  upstream typed-decisions run uses).
* Upstream reference: 6,000 decisions (typed-decisions) train in ~4–6 min.
  JEV traces are far smaller — ~60 decisions per 66-step eval run, a few
  hundred per real-harness sweep — so wall-clock training stays in the
  **minutes** even with 4 epochs; the cap is only a concern beyond ~50k
  decisions. Keep `EPOCHS=4` and the batch schedule below unless the input
  grows past that.
* Labels are one-hot from the recorded-LLM transcript; the recorder's
  write-time redaction means no PII values are in the training text.
""")

md("""## 1. Environment & Dual T4 GPU Check""")
code("""!nvidia-smi
import os, torch

n_gpu = torch.cuda.device_count()
print(f"CUDA Available: {torch.cuda.is_available()} | Visible GPUs: {n_gpu}")
for i in range(n_gpu):
    p = torch.cuda.get_device_properties(i)
    print(f"  GPU {i}: {p.name} ({p.total_memory / 1e9:.1f} GB)")

assert n_gpu >= 2, (
    f"Expected 2 GPUs, but detected {n_gpu}!\\n"
    "Please switch your Kaggle Accelerator: on the right sidebar, go to "
    "Notebook options -> Accelerator -> select GPU T4 x2."
)

os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"
print("Both T4 GPUs verified and ready for DDP training!")
""")

md("""## 2. Install Dependencies""")
code("""!pip install -q -U "laya>=0.3.3" "transformers>=4.48.0" "datasets>=3.0.0" safetensors huggingface_hub pyarrow pandas scipy accelerate tabulate
import laya, transformers, torch
print("Laya version        :", laya.__version__)
print("Transformers version:", transformers.__version__)
print("PyTorch version     :", torch.__version__)
""")

md("""## 3. Upload & Convert the Trace Export (Input)

The Input is the JSONL produced by `scripts/export_laya_finetune.py`
(typed-decisions-style rows: `id`, `workflow`, `state`, `questions`, `gold` —
gold is one-hot over the transcript labels, already realigned so each state
pairs with the action the reference policy took FROM that state).

If you only have raw `core/trace_recorder.py` traces, run the exporter first
(in the repo): `python scripts/export_laya_finetune.py traces.jsonl -o laya-cases.jsonl`

**Split discipline:** the three synthetic eval tasks are labeled
`split=heldout` by the recorder and become the evaluation set here; train on
`split=train` only. Real-harness traces from non-held-out tasks are the
training substrate — eval-only runs produce NO train rows by construction.""")
code("""import glob, json, os

INPUT_GLOB = "/kaggle/input/jev-shadow-traces/laya-cases-*.jsonl"
OUT_DIR = "/kaggle/working/laya_finetuned_jev"

paths = sorted(glob.glob(INPUT_GLOB))
assert paths, f"No trace export found at {INPUT_GLOB!r} — upload it as a Kaggle Input."
cases = []
for path in paths:
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if line:
                cases.append(json.loads(line))
print(f"Loaded {len(cases)} cases from {len(paths)} file(s).")

train_cases = [c for c in cases if c.get("split") == "train"]
heldout_cases = [c for c in cases if c.get("split") == "heldout"]
print(f"train: {len(train_cases)} | heldout: {len(heldout_cases)}")
assert train_cases, (
    "No train-split cases — these eval traces are all heldout by design. "
    "Provide real-harness traces from non-held-out tasks for training, or "
    "accept tiny-data smoke behavior if just validating the pipeline."
)
""")

md("""## 4. Preprocess for DDP (tokenize once, both ranks read from disk)

Same `build_training_item` logic as the upstream typed-decisions notebook —
gold probabilities over the criteria keys, normalized, with `label = argmax`.
Our export already emits one-hot gold; `state`/`questions`/`gold` are JSON
strings, decoded here exactly like the HF dataset loader does.""")
code("""import os, json, torch
from transformers import AutoTokenizer
from huggingface_hub import snapshot_download
from laya.agent import _fix_tokenizer_config
from laya.common import build_sequence, render_options, QTYPES

MODEL_ID = "convaiinnovations/laya"
print(f"Fetching tokenizer and config from {MODEL_ID}...")
model_dir = snapshot_download(MODEL_ID)
_fix_tokenizer_config(model_dir)

tok = AutoTokenizer.from_pretrained(os.path.join(model_dir, "tokenizer"))
with open(os.path.join(model_dir, "rl_agent_config.json")) as f:
    cfg = json.load(f)

MAX_LEN = 1024        # shadow state texts run longer than the 512 default
HEAD_MAX_LEN = 256    # room for 16 target options at ~48 tokens each

def build_training_item(state, q, gold_q):
    t = q["type"]
    crit = q.get("criteria", {})
    if t == "choice":
        keys = list(crit.keys())
        target = [gold_q["probabilities"].get(k, 0.0) for k in keys]
    elif t == "noul":
        target = [gold_q["probabilities"].get("false", 0.5), gold_q["probabilities"].get("true", 0.5)]
    elif t == "score":
        n_levels = len(crit) if isinstance(crit, list) else 4
        target = [gold_q["probabilities"].get(str(i), 0.0) for i in range(n_levels)]
    else:
        return None

    s = sum(target)
    target = [v / s for v in target] if s > 0 else [1.0 / len(target)] * len(target)
    label = target.index(max(target))
    k = len(render_options({"t": t, "crit": crit}))

    seq, markers = build_sequence(tok, state, {"t": t, "ins": q["instructions"], "crit": crit}, MAX_LEN, HEAD_MAX_LEN)
    if len(markers) != k:
        return None  # options overflowed the head budget — skip, don't crash
    return {"ids": seq, "markers": markers, "qtype": QTYPES[t], "target": target, "label": label}

items = []
skipped = 0
for row in train_cases:
    state = json.loads(row["state"])
    questions = json.loads(row["questions"])
    gold = json.loads(row["gold"])
    for qid, q in questions.items():
        if qid in gold:
            it = build_training_item(state, q, gold[qid])
            if it:
                items.append(it)
            else:
                skipped += 1

print(f"Preprocessed {len(items)} training sequences ({skipped} skipped) across {len(train_cases)} cases.")
torch.save(items, "/kaggle/working/train_items.pt")
print("Saved preprocessed items to /kaggle/working/train_items.pt")
""")

md("""## 5. DDP Training Script (`train_ddp.py`)

Identical to the upstream Laya typed-decisions training: pure-policy-gradient
RLCD with proper scoring rules (`proper_reward`), GRPO-style group baseline,
soft cross-entropy guidance, gradient checkpointing, and post-training
per-qtype temperature calibration. Saves a loadable checkpoint directory
(`model.safetensors` fp16 + `encoder/` + `tokenizer/` + updated
`rl_agent_config.json` with the fitted temperatures and `max_len=1024`).""")
code(r'''%%writefile /kaggle/working/train_ddp.py
import os, sys, time, json, random, math
import numpy as np
import torch
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP
from safetensors.torch import load_file, save_file
from transformers import AutoTokenizer
from laya.common import build_model, proper_reward, QTYPES

def collate_train_batch(items, pad_id):
    n, L = len(items), max(len(it["ids"]) for it in items)
    kmax = max(len(it["markers"]) for it in items)
    ids = torch.full((n, L), pad_id, dtype=torch.long)
    att = torch.zeros((n, L), dtype=torch.long)
    mpos = torch.zeros((n, kmax), dtype=torch.long)
    mmask = torch.zeros((n, kmax), dtype=torch.bool)
    target = torch.zeros((n, kmax), dtype=torch.float32)
    for i, it in enumerate(items):
        ids[i, : len(it["ids"])] = torch.tensor(it["ids"])
        att[i, : len(it["ids"])] = 1
        k = len(it["markers"])
        mpos[i, :k] = torch.tensor(it["markers"])
        mmask[i, :k] = True
        target[i, : len(it["target"])] = torch.tensor(it["target"], dtype=torch.float32)
    return {
        "input_ids": ids,
        "attention_mask": att,
        "marker_pos": mpos,
        "marker_mask": mmask,
        "target": target,
        "qtype": torch.tensor([it["qtype"] for it in items]),
        "label": torch.tensor([it["label"] for it in items])
    }

def fit_one_temp(sel):
    if len(sel) < 10:
        return 1.0
    kmax = max(len(z) for z, _ in sel)
    Z = torch.full((len(sel), kmax), -1e4)
    T = torch.zeros((len(sel), kmax))
    for i, (z, t) in enumerate(sel):
        Z[i, :len(z)] = torch.tensor(z)
        T[i, :len(t)] = torch.tensor(t, dtype=torch.float32)
    log_t = torch.zeros(1, requires_grad=True)
    opt = torch.optim.LBFGS([log_t], lr=0.1, max_iter=100)
    def closure():
        opt.zero_grad()
        loss = -(T * torch.log_softmax(Z / log_t.exp(), -1)).sum(-1).mean()
        loss.backward()
        return loss
    opt.step(closure)
    return float(torch.clamp(log_t.exp(), 0.1, 10.0).item())

def main():
    dist.init_process_group("nccl")
    rank = dist.get_rank()
    world_size = dist.get_world_size()
    local_rank = int(os.environ.get("LOCAL_RANK", "0"))
    torch.cuda.set_device(local_rank)
    device = torch.device("cuda", local_rank)

    model_dir = sys.argv[1]
    output_dir = sys.argv[2]

    with open(os.path.join(model_dir, "rl_agent_config.json")) as f:
        cfg = json.load(f)
    cfg["gradient_checkpointing"] = True
    cfg["max_tokens_per_batch"] = 4096
    cfg["max_len"] = 1024
    cfg["head_max_len"] = 256

    tok = AutoTokenizer.from_pretrained(os.path.join(model_dir, "tokenizer"))
    model = build_model(cfg, encoder_dir=os.path.join(model_dir, "encoder"))

    weights = load_file(os.path.join(model_dir, "model.safetensors"))
    model.load_state_dict(weights, strict=True)

    model.encoder.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
    model.head_checkpointing = True
    model.to(device)
    model.train()

    ddp_model = DDP(model, device_ids=[local_rank], find_unused_parameters=True)

    all_items = torch.load("/kaggle/working/train_items.pt", weights_only=False)
    my_items = all_items[rank::world_size]

    EPOCHS = 4
    MICRO_BATCH = 8      # 8 sequences per forward pass per GPU
    GRAD_ACCUM = 4       # Effective batch across 2 GPUs = 64 sequences
    GROUP_SIZE = 4       # GRPO baseline samples
    LR_ENCODER = 2.5e-5
    LR_HEAD = 1.0e-4
    SIGMA_START = 0.4
    SIGMA_END = 0.1

    enc_params = [p for n, p in ddp_model.named_parameters() if "encoder." in n]
    head_params = [p for n, p in ddp_model.named_parameters() if "encoder." not in n]

    optimizer = torch.optim.AdamW([
        {"params": enc_params, "lr": LR_ENCODER},
        {"params": head_params, "lr": LR_HEAD}
    ], weight_decay=0.01)

    total_updates = (len(my_items) // (MICRO_BATCH * GRAD_ACCUM)) * EPOCHS
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=max(1, total_updates), eta_min=1e-6)
    scaler = torch.amp.GradScaler("cuda", enabled=True)

    if rank == 0:
        print(f"Starting 2xT4 DDP training: {len(all_items)} total items | {len(my_items)} per rank | {EPOCHS} epochs")
    t0 = time.time()

    for epoch in range(EPOCHS):
        random.seed(42 + epoch + rank)
        random.shuffle(my_items)
        epoch_loss, n_batches = 0.0, 0
        optimizer.zero_grad(set_to_none=True)
        accum_step = 0

        progress = epoch / max(1, EPOCHS - 1)
        sigma = SIGMA_START + (SIGMA_END - SIGMA_START) * progress

        for b_idx in range(0, len(my_items), MICRO_BATCH):
            chunk = my_items[b_idx:b_idx + MICRO_BATCH]
            if not chunk:
                continue

            batch = collate_train_batch(chunk, tok.pad_token_id)

            with torch.autocast("cuda", dtype=torch.float16):
                logits, act = ddp_model(
                    batch["input_ids"].to(device),
                    batch["attention_mask"].to(device),
                    batch["marker_pos"].to(device),
                    batch["marker_mask"].to(device),
                    batch["qtype"].to(device)
                )

            logits = logits.float()
            mask = batch["marker_mask"].to(device)
            k = mask.sum(-1, keepdim=True).float()
            target = batch["target"].to(device)

            eps = torch.randn((GROUP_SIZE,) + logits.shape, device=device) * sigma * mask
            eps = (eps - eps.sum(-1, keepdim=True) / k) * mask
            z = logits.detach().unsqueeze(0) + eps
            q = torch.softmax(z.masked_fill(~mask, -1e4), -1)

            with torch.no_grad():
                r = proper_reward(q, target.unsqueeze(0), batch["qtype"].to(device), mask, w_sph=0.75, w_rps=1.0)
                adv = r - r.mean(0, keepdim=True)
                adv = adv / (adv.std() + 1e-6)

            logp = -(((z - logits.unsqueeze(0)) ** 2) * mask).sum(-1) / (2 * sigma ** 2)
            loss_rl = -(adv * logp).mean()
            loss_ce = -(target * torch.log_softmax(logits.masked_fill(~mask, -1e4), -1)).sum(-1).mean()
            loss = (loss_rl + 1.0 * loss_ce) / GRAD_ACCUM + 0.0 * act.sum()

            scaler.scale(loss).backward()
            accum_step += 1

            if accum_step % GRAD_ACCUM == 0 or (b_idx + MICRO_BATCH) >= len(my_items):
                scaler.unscale_(optimizer)
                torch.nn.utils.clip_grad_norm_(ddp_model.parameters(), 1.0)
                scaler.step(optimizer)
                scaler.update()
                scheduler.step()
                optimizer.zero_grad(set_to_none=True)

            epoch_loss += loss.item() * GRAD_ACCUM
            n_batches += 1

            if rank == 0 and (n_batches % 50) == 0:
                cur_lr = scheduler.get_last_lr()[0]
                print(f"  Epoch {epoch+1}/{EPOCHS} | Step {n_batches} | Loss: {loss.item()*GRAD_ACCUM:.4f} | Reward: {r.mean().item():.3f} | LR: {cur_lr:.2e}")

        if rank == 0:
            print(f"=== Epoch {epoch+1}/{EPOCHS} Completed in {time.time()-t0:.1f}s | Avg Loss: {epoch_loss/max(1, n_batches):.4f} ===")

    dist.barrier()

    # Post-training per-qtype temperature calibration (rank 0).
    if rank == 0:
        print("\nFitting post-training calibration temperatures...")
        del optimizer, scaler, scheduler
        torch.cuda.empty_cache()
        model.eval()
        calib_items = all_items[::15][:400]
        calib_preds = []
        with torch.no_grad():
            for c_idx in range(0, len(calib_items), 16):
                c_chunk = calib_items[c_idx:c_idx + 16]
                cb = collate_train_batch(c_chunk, tok.pad_token_id)
                with torch.autocast("cuda", dtype=torch.float16):
                    l_sub, _ = model(
                        cb["input_ids"].to(device),
                        cb["attention_mask"].to(device),
                        cb["marker_pos"].to(device),
                        cb["marker_mask"].to(device),
                        cb["qtype"].to(device)
                    )
                l_np = l_sub.float().cpu().numpy()
                for r, it in enumerate(c_chunk):
                    k = len(it["markers"])
                    calib_preds.append((it["qtype"], l_np[r, :k], it["target"]))

        fitted_temps = [1.2, 1.2, 1.2]
        try:
            for qt in range(3):
                sel = [(z, t) for q_type, z, t in calib_preds if q_type == qt]
                if sel:
                    fitted_temps[qt] = fit_one_temp(sel)
            print("Fitted calibration temperatures (choice, score, noul):", [round(t, 3) for t in fitted_temps])
        except Exception as e:
            print("Temperature fitting fallback:", e)
        os.makedirs(output_dir, exist_ok=True)
        sd = {k: v.half().contiguous().cpu() for k, v in model.state_dict().items()}
        save_file(sd, os.path.join(output_dir, "model.safetensors"))
        model.encoder.config.save_pretrained(os.path.join(output_dir, "encoder"))
        tok.save_pretrained(os.path.join(output_dir, "tokenizer"))

        cfg["fine_tuned"] = True
        cfg["model_name"] = "laya-jev-shadow-head"
        cfg["temperature"] = fitted_temps
        with open(os.path.join(output_dir, "rl_agent_config.json"), "w") as f:
            json.dump(cfg, f, indent=2)
        print(f"Model successfully saved to {output_dir}!")

    dist.destroy_process_group()

if __name__ == "__main__":
    main()
''')

md("""## 6. Launch Multi-GPU Fine-Tuning with `torchrun`""")
code("""OUTPUT_DIR = "/kaggle/working/laya_finetuned_jev"
MODEL_DIR = model_dir

cmd = f"torchrun --standalone --nproc_per_node=2 /kaggle/working/train_ddp.py {MODEL_DIR} {OUTPUT_DIR}"
print("Executing DDP training:", cmd)
!{cmd}
""")

md("""## 7. Evaluate on the Held-Out Split

Loads the fine-tuned checkpoint with plain `laya.Agent` (the exact call
`core/laya_head.LayaHead(model=...)` makes) and scores argmax accuracy per
question type on the held-out cases. Zero-shot reference from the local
measurement: the base english checkpoint agrees with the recorded LLM policy
only near chance on these menus (see docs/JEV_LAYA_NOTES.md) — the honest
expectation for a tiny trace corpus is a solid jump over that baseline, not
production-grade agreement (the structural cap is the reference itself).""")
code("""import time, json
import numpy as np
import laya

agent_ft = laya.Agent(OUTPUT_DIR, device="cuda")

correct = {"operation": 0, "target": 0}
count = {"operation": 0, "target": 0}
latencies = []

for row in heldout_cases:
    state = json.loads(row["state"])
    questions = json.loads(row["questions"])
    gold = json.loads(row["gold"])
    t0 = time.perf_counter()
    res = agent_ft.predict(state, questions)
    latencies.append((time.perf_counter() - t0) * 1000)
    for qid, g in gold.items():
        ans = res["answers"].get(qid)
        if ans is None:
            continue
        kind = "operation" if qid == "operation" else "target"
        if ans["type"] == "choice":
            count[kind] += 1
            correct[kind] += int(ans["choice"] == str(g["label"]))

print(f"held-out cases: {len(heldout_cases)}")
print(f"operation accuracy: {correct['operation']}/{count['operation']}"
      + (f" = {correct['operation']/max(1,count['operation']):.3f}" if count['operation'] else " (none labeled)"))
print(f"target accuracy:    {correct['target']}/{count['target']}"
      + (f" = {correct['target']/max(1,count['target']):.3f}" if count['target'] else " (none labeled)"))
print(f"latency p50: {np.percentile(latencies, 50):.1f} ms" if latencies else "no cases")
""")

md("""## 8. Package & Download

The whole output directory is the checkpoint — download it as a zip, then
point `LayaHead(model=<local dir>)` at the extracted folder. No re-export or
conversion step exists because `laya.Agent` loads this layout natively.""")
code("""import shutil

zip_path = shutil.make_archive("/kaggle/working/laya_finetuned_jev", "zip", OUTPUT_DIR)
print("Checkpoint archive:", zip_path)

# Optional: push to a private HF repo instead of downloading (needs
# HF_TOKEN in Kaggle Secrets). Uncomment to use.
# from huggingface_hub import HfApi
# from kaggle_secrets import UserSecretsClient
# token = UserSecretsClient().get_secret("HF_TOKEN")
# api = HfApi(token=token)
# api.create_repo("convaiinnovations/laya-jev-shadow-head", exist_ok=True)
# api.upload_folder(folder_path=OUTPUT_DIR, repo_id="convaiinnovations/laya-jev-shadow-head")
""")

nb = {
    "nbformat": 4,
    "nbformat_minor": 5,
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3",
        },
        "language_info": {"name": "python", "pygments_lexer": "ipython3"},
    },
    "cells": CELLS,
}

OUT.write_text(json.dumps(nb, indent=1))
print(f"wrote {OUT} ({len(CELLS)} cells)")
