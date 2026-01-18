-- D1 schema for Pulse feedback storage
CREATE TABLE IF NOT EXISTS feedback (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	text TEXT NOT NULL,
	source TEXT,
	sentiment TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for efficient querying by created_at (for GET /feedback sorting)
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
