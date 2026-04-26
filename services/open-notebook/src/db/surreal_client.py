import os
from typing import Any, Dict, List, Optional
from surrealdb import AsyncSurreal, RecordID


def extract_id(record: Any) -> str:
    """Extract string ID from a SurrealDB record (handles both RecordID objects and strings)."""
    raw = record["id"] if isinstance(record, dict) else record
    if isinstance(raw, RecordID):
        return str(raw.id)
    if isinstance(raw, str):
        return raw.split(":")[1] if ":" in raw else raw
    return str(raw)


class SurrealDBClient:
    def __init__(self):
        self.url = os.getenv("SURREAL_URL", "ws://127.0.0.1:9800/rpc")
        self.user = os.getenv("SURREAL_USER", "root")
        self.password = os.getenv("SURREAL_PASSWORD", "root")
        self.namespace = os.getenv("SURREAL_NAMESPACE", "open_notebook")
        self.database = os.getenv("SURREAL_DATABASE", "open_notebook")
        self._db: Optional[Any] = None

    async def connect(self):
        self._db = AsyncSurreal(self.url)
        await self._db.connect()
        await self._db.signin({"user": self.user, "pass": self.password})
        await self._db.use(self.namespace, self.database)
        await self._ensure_schema()

    async def disconnect(self):
        if self._db:
            await self._db.close()

    async def _ensure_schema(self):
        """Ensure tables exist."""
        await self._db.query("DEFINE TABLE IF NOT EXISTS notebook SCHEMALESS")
        await self._db.query("DEFINE TABLE IF NOT EXISTS source SCHEMALESS")
        await self._db.query("DEFINE TABLE IF NOT EXISTS chunk SCHEMALESS")
        await self._db.query("DEFINE TABLE IF NOT EXISTS message SCHEMALESS")
        await self._db.query("DEFINE TABLE IF NOT EXISTS chat_session SCHEMALESS")

    async def create(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        result = await self._db.create(table, data)
        return result[0] if isinstance(result, list) else result

    async def select(self, table: str, id: Optional[str] = None) -> Any:
        if id:
            return await self._db.select(f"{table}:{id}")
        return await self._db.select(table)

    async def query(self, sql: str, vars: Optional[Dict[str, Any]] = None) -> List[Any]:
        result = await self._db.query(sql, vars)
        return result

    async def update(self, table: str, id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        result = await self._db.update(f"{table}:{id}", data)
        return result[0] if isinstance(result, list) else result

    async def delete(self, table: str, id: str) -> None:
        await self._db.delete(f"{table}:{id}")


# Global client instance
db = SurrealDBClient()
