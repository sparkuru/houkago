-- v1 idempotent schema (database-guidelines): applied on startup.
-- snake_case columns, string ids, epoch-ms timestamps. Media bytes never stored.

CREATE TABLE IF NOT EXISTS bushitsu (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  buchou_id  TEXT NOT NULL,
  created_at INTEGER NOT NULL
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
  FOREIGN KEY (bushitsu_id) REFERENCES bushitsu(id)
);
