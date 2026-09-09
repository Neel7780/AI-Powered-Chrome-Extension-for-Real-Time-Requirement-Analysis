"""
Database Service for Persistent Meeting Storage
Uses SQLite with zero external dependencies to store meeting sessions,
transcripts, real-time ambiguities, and stakeholder clarification answers.
"""

import json
import sqlite3
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from ..config import settings

logger = logging.getLogger("AIRequirementAnalyst.Database")

# Ensure database directory exists
DATA_DIR = settings.BASE_DIR / "backend" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "meetings.db"

class DatabaseManager:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self) -> None:
        """Initializes tables if they do not exist."""
        with self._get_connection() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS meetings (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    domain TEXT DEFAULT 'HR Tech',
                    is_active INTEGER DEFAULT 1,
                    is_finalized INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS utterances (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    meeting_id TEXT NOT NULL,
                    speaker TEXT NOT NULL,
                    text TEXT NOT NULL,
                    timestamp TEXT,
                    is_ambiguous INTEGER DEFAULT 0,
                    ambiguity_score INTEGER DEFAULT 0,
                    detected_flags TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS clarifications (
                    id TEXT NOT NULL,
                    meeting_id TEXT NOT NULL,
                    category TEXT,
                    question TEXT NOT NULL,
                    triggered_by TEXT,
                    suggested_options TEXT,
                    selected_response TEXT,
                    severity TEXT,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (id, meeting_id),
                    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS requirements_cache (
                    meeting_id TEXT PRIMARY KEY,
                    baseline TEXT,
                    refined TEXT,
                    evaluation TEXT,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
                );
            """)
        logger.info(f"SQLite database initialized at {self.db_path}")

    def create_meeting(self, title: str = "Live Meeting", domain: str = "HR Tech", meeting_id: Optional[str] = None) -> str:
        """Creates a new meeting record and marks it active while marking other meetings inactive."""
        mid = meeting_id or f"meet_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}_{uuid.uuid4().hex[:6]}"
        now = datetime.now().isoformat()
        with self._get_connection() as conn:
            # Mark previous meetings inactive
            conn.execute("UPDATE meetings SET is_active = 0 WHERE is_active = 1")
            conn.execute(
                "INSERT OR REPLACE INTO meetings (id, title, domain, is_active, is_finalized, created_at, updated_at) VALUES (?, ?, ?, 1, 0, ?, ?)",
                (mid, title, domain, now, now)
            )
        logger.info(f"Created new meeting session {mid} - '{title}'")
        return mid

    def get_active_meeting_id(self) -> Optional[str]:
        """Returns the ID of the currently active meeting."""
        with self._get_connection() as conn:
            row = conn.execute("SELECT id FROM meetings WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1").fetchone()
            if row:
                return row["id"]
        return None

    def set_active_meeting(self, meeting_id: str) -> bool:
        """Switches the active meeting to the specified ID."""
        with self._get_connection() as conn:
            conn.execute("UPDATE meetings SET is_active = 0")
            cur = conn.execute("UPDATE meetings SET is_active = 1, updated_at = ? WHERE id = ?", (datetime.now().isoformat(), meeting_id))
            return cur.rowcount > 0

    def list_meetings(self) -> List[Dict[str, Any]]:
        """Returns all meetings with summary counts."""
        with self._get_connection() as conn:
            query = """
                SELECT 
                    m.id, m.title, m.domain, m.is_active, m.is_finalized, m.created_at, m.updated_at,
                    COUNT(DISTINCT u.id) AS transcript_count,
                    COUNT(DISTINCT c.id) AS clarification_count,
                    SUM(CASE WHEN c.selected_response IS NOT NULL AND TRIM(c.selected_response) != '' THEN 1 ELSE 0 END) AS resolved_count
                FROM meetings m
                LEFT JOIN utterances u ON m.id = u.meeting_id
                LEFT JOIN clarifications c ON m.id = c.meeting_id
                GROUP BY m.id
                ORDER BY m.updated_at DESC
            """
            rows = conn.execute(query).fetchall()
            return [dict(r) for r in rows]

    def get_meeting_full(self, meeting_id: str) -> Optional[Dict[str, Any]]:
        """Loads meeting metadata, utterances, clarifications, and requirements cache."""
        with self._get_connection() as conn:
            m_row = conn.execute("SELECT * FROM meetings WHERE id = ?", (meeting_id,)).fetchone()
            if not m_row:
                return None

            m_dict = dict(m_row)

            # Utterances
            u_rows = conn.execute(
                "SELECT id, speaker, text, timestamp, is_ambiguous, ambiguity_score, detected_flags FROM utterances WHERE meeting_id = ? ORDER BY id ASC",
                (meeting_id,)
            ).fetchall()

            transcript = []
            for u in u_rows:
                flags = json.loads(u["detected_flags"]) if u["detected_flags"] else []
                transcript.append({
                    "id": f"u-{u['id']}",
                    "speaker": u["speaker"],
                    "text": u["text"],
                    "timestamp": u["timestamp"] or "00:00",
                    "isAmbiguous": bool(u["is_ambiguous"]),
                    "ambiguityScore": u["ambiguity_score"],
                    "detectedFlags": flags
                })

            # Clarifications
            c_rows = conn.execute(
                "SELECT id, category, question, triggered_by, suggested_options, selected_response, severity FROM clarifications WHERE meeting_id = ? ORDER BY rowid ASC",
                (meeting_id,)
            ).fetchall()

            clarifications = []
            for c in c_rows:
                opts = json.loads(c["suggested_options"]) if c["suggested_options"] else []
                clarifications.append({
                    "id": c["id"],
                    "category": c["category"] or "Clarification",
                    "question": c["question"],
                    "triggeredBy": c["triggered_by"],
                    "suggestedOptions": opts,
                    "options": opts,
                    "selectedResponse": c["selected_response"],
                    "severity": c["severity"] or "MEDIUM"
                })

            # Requirements Cache
            req_row = conn.execute("SELECT baseline, refined, evaluation FROM requirements_cache WHERE meeting_id = ?", (meeting_id,)).fetchone()
            baseline = json.loads(req_row["baseline"]) if (req_row and req_row["baseline"]) else {"frs": [], "nfrs": []}
            refined = json.loads(req_row["refined"]) if (req_row and req_row["refined"]) else {"frs": [], "nfrs": []}
            evaluation = json.loads(req_row["evaluation"]) if (req_row and req_row["evaluation"]) else {}

            return {
                "id": m_dict["id"],
                "title": m_dict["title"],
                "domain": m_dict["domain"],
                "isActive": bool(m_dict["is_active"]),
                "isFinalized": bool(m_dict["is_finalized"]),
                "createdAt": m_dict["created_at"],
                "updatedAt": m_dict["updated_at"],
                "transcript": transcript,
                "clarifications": clarifications,
                "baseline": baseline,
                "refined": refined,
                "evaluation": evaluation
            }

    def add_utterance(self, meeting_id: str, speaker: str, text: str, timestamp: str, is_ambiguous: bool, ambiguity_score: int, flags: List[Dict[str, Any]]) -> int:
        """Appends an utterance to the meeting in SQLite."""
        now = datetime.now().isoformat()
        flags_json = json.dumps(flags)
        with self._get_connection() as conn:
            cur = conn.execute(
                """INSERT INTO utterances (meeting_id, speaker, text, timestamp, is_ambiguous, ambiguity_score, detected_flags, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (meeting_id, speaker, text, timestamp, 1 if is_ambiguous else 0, ambiguity_score, flags_json, now)
            )
            conn.execute("UPDATE meetings SET updated_at = ? WHERE id = ?", (now, meeting_id))
            return cur.lastrowid

    def add_clarification(self, meeting_id: str, q_id: str, category: str, question: str, triggered_by: str, options: List[str], severity: str = "MEDIUM") -> None:
        """Saves a clarification question for this meeting."""
        now = datetime.now().isoformat()
        opts_json = json.dumps(options)
        with self._get_connection() as conn:
            conn.execute(
                """INSERT OR REPLACE INTO clarifications (id, meeting_id, category, question, triggered_by, suggested_options, selected_response, severity, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)""",
                (q_id, meeting_id, category, question, triggered_by, opts_json, severity, now)
            )
            conn.execute("UPDATE meetings SET updated_at = ? WHERE id = ?", (now, meeting_id))

    def update_clarification_response(self, meeting_id: str, q_id: str, response: str) -> None:
        """Records a stakeholder response for a clarification."""
        now = datetime.now().isoformat()
        with self._get_connection() as conn:
            conn.execute(
                "UPDATE clarifications SET selected_response = ? WHERE id = ? AND meeting_id = ?",
                (response.strip(), q_id, meeting_id)
            )
            conn.execute("UPDATE meetings SET updated_at = ? WHERE id = ?", (now, meeting_id))

    def save_requirements_cache(self, meeting_id: str, baseline: Dict[str, Any], refined: Dict[str, Any], evaluation: Dict[str, Any]) -> None:
        """Caches computed requirements and quality scorecard in SQLite."""
        now = datetime.now().isoformat()
        b_json = json.dumps(baseline)
        r_json = json.dumps(refined)
        e_json = json.dumps(evaluation)
        with self._get_connection() as conn:
            conn.execute(
                """INSERT OR REPLACE INTO requirements_cache (meeting_id, baseline, refined, evaluation, updated_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (meeting_id, b_json, r_json, e_json, now)
            )

    def delete_meeting(self, meeting_id: str) -> bool:
        """Deletes meeting and all associated data."""
        with self._get_connection() as conn:
            cur = conn.execute("DELETE FROM meetings WHERE id = ?", (meeting_id,))
            return cur.rowcount > 0

    def finalize_meeting(self, meeting_id: str) -> None:
        now = datetime.now().isoformat()
        with self._get_connection() as conn:
            conn.execute("UPDATE meetings SET is_finalized = 1, updated_at = ? WHERE id = ?", (now, meeting_id))

db_manager = DatabaseManager()
