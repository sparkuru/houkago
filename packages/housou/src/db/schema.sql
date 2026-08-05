-- v2 authenticated schema (database-guidelines): applied on startup.
-- snake_case columns, string ids, epoch-ms timestamps. Media bytes never stored.

CREATE TABLE IF NOT EXISTS seito (
  id               TEXT PRIMARY KEY,
  username         TEXT NOT NULL,
  username_norm    TEXT NOT NULL UNIQUE,
  password_hash    TEXT NOT NULL,
  created_at       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS seitoshou (
  token_digest     TEXT PRIMARY KEY,
  seito_id         TEXT NOT NULL,
  created_at       INTEGER NOT NULL,
  expires_at       INTEGER NOT NULL,
  FOREIGN KEY (seito_id) REFERENCES seito(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS seitoshou_expires_at ON seitoshou(expires_at);

CREATE TABLE IF NOT EXISTS bushitsu (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  buchou_id  TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (buchou_id) REFERENCES seito(id)
);

CREATE TABLE IF NOT EXISTS bushitsu_buin (
  bushitsu_id TEXT NOT NULL,
  seito_id    TEXT NOT NULL,
  joined_at   INTEGER NOT NULL,
  PRIMARY KEY (bushitsu_id, seito_id),
  FOREIGN KEY (bushitsu_id) REFERENCES bushitsu(id) ON DELETE CASCADE,
  FOREIGN KEY (seito_id) REFERENCES seito(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS buin (
  id           TEXT PRIMARY KEY,
  bushitsu_id  TEXT NOT NULL,
  nickname     TEXT NOT NULL,
  yakuwari     TEXT NOT NULL,
  FOREIGN KEY (bushitsu_id) REFERENCES bushitsu(id)
);

CREATE TABLE IF NOT EXISTS enmoku (
  id             TEXT PRIMARY KEY,
  bushitsu_id    TEXT NOT NULL,
  title          TEXT NOT NULL,
  type           TEXT NOT NULL,
  url            TEXT NOT NULL,
  headers_json   TEXT,
  subtitles_json TEXT,
  sources_json   TEXT,
  danmaku_json   TEXT,
  provider_json  TEXT,
  live           INTEGER,
  added_by       TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  FOREIGN KEY (bushitsu_id) REFERENCES bushitsu(id),
  FOREIGN KEY (added_by) REFERENCES seito(id)
);
