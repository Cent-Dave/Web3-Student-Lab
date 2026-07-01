CREATE TABLE IF NOT EXISTS translation_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  locale TEXT NOT NULL,
  namespace TEXT NOT NULL DEFAULT 'platform',
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, locale, namespace, key)
);

CREATE INDEX IF NOT EXISTS idx_translation_entries_workspace_locale_namespace
  ON translation_entries (workspace_id, locale, namespace);
