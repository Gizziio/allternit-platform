import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db.surreal_client import db
from api import notebooks, sources, chat, search, transform, podcast, connectors, canvas_sync, reddit

DATA_DIR = os.path.expanduser("~/.allternit/services/open-notebook/data")
os.makedirs(DATA_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[Open Notebook] Connecting to SurrealDB...")
    await db.connect()
    print("[Open Notebook] SurrealDB connected")
    yield
    print("[Open Notebook] Disconnecting...")
    await db.disconnect()


app = FastAPI(
    title="Allternit Research Backend",
    description="Headless notebook engine for A://Labs — RAG, citations, and grounded chat",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/health")
def health():
    return {"status": "ok", "service": "allternit-research-backend", "version": "0.1.0"}

# Static files for generated audio, exports, etc.
app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")

# API routers
app.include_router(notebooks.router)
app.include_router(sources.router)
app.include_router(chat.router)
app.include_router(search.router)
app.include_router(transform.router)
app.include_router(podcast.router)
app.include_router(connectors.router)
app.include_router(canvas_sync.router)
app.include_router(reddit.router)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "5055"))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False)
