FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    MCP_MEMORY_STORAGE_BACKEND=sqlite_vec \
    MCP_MEMORY_SQLITE_PATH=/app/data/memory.db \
    MCP_MEMORY_BACKUPS_PATH=/app/data/backups \
    PYTHONPATH=/app/src \
    CHROMA_TELEMETRY_IMPL=none \
    ANONYMIZED_TELEMETRY=false \
    HF_HUB_DISABLE_TELEMETRY=1

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl bash && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean

COPY --from=source pyproject.toml .
COPY --from=source uv.lock .
COPY --from=source README.md .
COPY --from=source scripts/installation/install_uv.py .

RUN python install_uv.py && mkdir -p /app/data/backups

COPY --from=source src/ /app/src/
COPY --from=source run_server.py ./
COPY --from=source scripts/utils/uv_wrapper.py ./uv_wrapper.py
COPY --from=source scripts/utils/memory_wrapper_uv.py ./memory_wrapper_uv.py
COPY --from=source tools/docker/docker-entrypoint-unified.sh /usr/local/bin/

RUN python -m uv pip install torch --index-url https://download.pytorch.org/whl/cpu && \
    python -m uv pip install -e . && \
    python -m uv pip install -e ".[sqlite]"

RUN chmod a+rw /dev/stdin /dev/stdout /dev/stderr && \
    chmod +x /usr/local/bin/docker-entrypoint-unified.sh

VOLUME ["/app/data"]

EXPOSE 8000 8765

ENTRYPOINT ["/usr/local/bin/docker-entrypoint-unified.sh"]
