"""
Allternit Computer Use — Session Manager
Unified session lifecycle across all adapter families.

Wraps and normalizes the existing session management from
brain_adapter.py (SessionContext, get_or_create_session_context).
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
import uuid
import json
import os


@dataclass
class Session:
    """
    Computer-use session — matches session.schema.json.
    Tracks lifecycle, adapter binding, auth, artifacts, and trace state.
    """
    session_id: str = field(default_factory=lambda: f"ses_{uuid.uuid4().hex[:12]}")
    run_id: str = ""
    family: str = ""        # browser, retrieval, desktop, hybrid
    mode: str = ""          # assist, execute, inspect, parallel, desktop, hybrid, crawl
    adapter_id: str = ""    # bound adapter
    status: str = "created" # created, active, checkpointed, restored, destroyed
    auth_ref: Optional[str] = None  # reference to credential (never inline)
    trace_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    checkpoint_support: bool = False
    artifact_root: str = ""
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    destroyed_at: Optional[str] = None
    # Internal state (not in schema — operational tracking)
    previous_actions: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "run_id": self.run_id,
            "family": self.family,
            "mode": self.mode,
            "adapter_id": self.adapter_id,
            "status": self.status,
            "auth_ref": self.auth_ref,
            "trace_id": self.trace_id,
            "checkpoint_support": self.checkpoint_support,
            "artifact_root": self.artifact_root,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "destroyed_at": self.destroyed_at,
        }


class SessionManager:
    """
    Manages session lifecycle for all computer-use families.
    Enforces session isolation (G2 policy guarantee).
    """

    def __init__(self, sessions_dir: Optional[str] = None):
        self._sessions: Dict[str, Session] = {}
        self._sessions_dir = Path(sessions_dir or os.path.expanduser("~/.allternit/sessions"))
        self._sessions_dir.mkdir(parents=True, exist_ok=True)

    def create(
        self,
        *,
        run_id: str,
        family: str,
        mode: str,
        adapter_id: str,
        auth_ref: Optional[str] = None,
        checkpoint_support: bool = False,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Session:
        """Create a new session."""
        session = Session(
            run_id=run_id,
            family=family,
            mode=mode,
            adapter_id=adapter_id,
            auth_ref=auth_ref,
            checkpoint_support=checkpoint_support,
            metadata=metadata or {},
        )
        # Set artifact root per session for isolation
        session.artifact_root = str(self._sessions_dir / session.session_id / "artifacts")
        Path(session.artifact_root).mkdir(parents=True, exist_ok=True)

        self._sessions[session.session_id] = session
        self._persist(session)
        return session

    def get(self, session_id: str) -> Optional[Session]:
        """Get a session by ID."""
        return self._sessions.get(session_id)

    def activate(self, session_id: str) -> Session:
        """Transition session to active state."""
        session = self._require(session_id)
        session.status = "active"
        session.updated_at = datetime.utcnow().isoformat()
        self._persist(session)
        return session

    def record_action(self, session_id: str, action: Dict[str, Any]) -> Session:
        """Record an action in session history."""
        session = self._require(session_id)
        session.previous_actions.append({
            **action,
            "timestamp": datetime.utcnow().isoformat(),
        })
        session.updated_at = datetime.utcnow().isoformat()
        self._persist(session)
        return session

    def checkpoint(self, session_id: str) -> Session:
        """Checkpoint session state."""
        session = self._require(session_id)
        if not session.checkpoint_support:
            raise ValueError(f"Session {session_id} does not support checkpointing")
        session.status = "checkpointed"
        session.updated_at = datetime.utcnow().isoformat()
        self._persist(session)
        return session

    def restore(self, session_id: str) -> Session:
        """Restore session from checkpoint."""
        session = self._require(session_id)
        if session.status != "checkpointed":
            raise ValueError(f"Session {session_id} is not checkpointed (status: {session.status})")
        session.status = "restored"
        session.updated_at = datetime.utcnow().isoformat()
        self._persist(session)
        return session

    def destroy(self, session_id: str) -> Session:
        """Destroy a session."""
        session = self._require(session_id)
        session.status = "destroyed"
        session.destroyed_at = datetime.utcnow().isoformat()
        session.updated_at = session.destroyed_at
        self._persist(session)
        return session

    def list_sessions(
        self,
        family: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[Session]:
        """List sessions, optionally filtered."""
        sessions = list(self._sessions.values())
        if family:
            sessions = [s for s in sessions if s.family == family]
        if status:
            sessions = [s for s in sessions if s.status == status]
        return sessions

    def get_artifact_root(self, session_id: str) -> str:
        """Get the isolated artifact root for a session."""
        session = self._require(session_id)
        return session.artifact_root

    def _require(self, session_id: str) -> Session:
        """Get session or raise."""
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        return session

    def _persist(self, session: Session) -> None:
        """Persist session state to disk."""
        session_dir = self._sessions_dir / session.session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        path = session_dir / "session.json"
        try:
            with open(path, "w") as f:
                json.dump(session.to_dict(), f, indent=2)
        except OSError:
            pass
