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
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  buchou_id   TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  kengen_json TEXT,
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

-- Queue placement is intentionally separate from playable-source metadata.
-- One entry per source today leaves the ordered mutation boundary extensible
-- for a later collaboration policy without changing Enmoku or BANGUMI.
CREATE TABLE IF NOT EXISTS bangumi_entry (
  enmoku_id   TEXT PRIMARY KEY,
  bushitsu_id TEXT NOT NULL,
  sort_key    INTEGER NOT NULL,
  FOREIGN KEY (enmoku_id) REFERENCES enmoku(id) ON DELETE CASCADE,
  FOREIGN KEY (bushitsu_id) REFERENCES bushitsu(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS bangumi_entry_room_order
  ON bangumi_entry(bushitsu_id, sort_key, enmoku_id);

CREATE TABLE IF NOT EXISTS baidu_connection (
  seito_id               TEXT PRIMARY KEY,
  authorization_id       TEXT NOT NULL,
  retention_mode         TEXT NOT NULL CHECK (retention_mode IN ('server-saved', 'user-held')),
  account_name           TEXT NOT NULL,
  adaptor_device_id      TEXT,
  encrypted_token_bundle TEXT,
  key_version            INTEGER,
  token_expires_at       INTEGER,
  needs_reconnect        INTEGER NOT NULL DEFAULT 0,
  created_at             INTEGER NOT NULL,
  updated_at             INTEGER NOT NULL,
  FOREIGN KEY (seito_id) REFERENCES seito(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS baidu_source (
  id                    TEXT PRIMARY KEY,
  owner_seito_id        TEXT NOT NULL,
  authorization_id      TEXT NOT NULL,
  bushitsu_id           TEXT NOT NULL,
  enmoku_id             TEXT NOT NULL UNIQUE,
  file_name             TEXT NOT NULL,
  size                  INTEGER,
  retention_mode        TEXT NOT NULL CHECK (retention_mode IN ('server-saved', 'user-held')),
  adaptor_device_id     TEXT,
  encrypted_fsid        TEXT,
  upstream_handle       TEXT,
  created_at            INTEGER NOT NULL,
  FOREIGN KEY (owner_seito_id) REFERENCES seito(id) ON DELETE CASCADE,
  FOREIGN KEY (bushitsu_id) REFERENCES bushitsu(id) ON DELETE CASCADE,
  FOREIGN KEY (enmoku_id) REFERENCES enmoku(id) ON DELETE CASCADE,
  CHECK (
    (retention_mode = 'server-saved' AND encrypted_fsid IS NOT NULL
      AND upstream_handle IS NULL AND adaptor_device_id IS NULL)
    OR
    (retention_mode = 'user-held' AND encrypted_fsid IS NULL
      AND upstream_handle IS NOT NULL AND adaptor_device_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS baidu_source_room ON baidu_source(bushitsu_id, id);
CREATE INDEX IF NOT EXISTS baidu_source_owner ON baidu_source(owner_seito_id, id);

CREATE TABLE IF NOT EXISTS baidu_adaptor_session (
  token_digest TEXT PRIMARY KEY,
  seito_id     TEXT NOT NULL,
  device_id    TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at   INTEGER,
  FOREIGN KEY (seito_id) REFERENCES seito(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS baidu_adaptor_session_owner
  ON baidu_adaptor_session(seito_id, device_id, expires_at);
