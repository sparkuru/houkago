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

-- Provider-neutral danmaku identity and storage pool. These tables are additive
-- to the legacy Enmoku.danmaku_json reference; no media bytes or provider
-- credentials are stored here.
CREATE TABLE IF NOT EXISTS komon (
  id              TEXT PRIMARY KEY,
  seito_id        TEXT NOT NULL UNIQUE,
  granted_at      INTEGER NOT NULL,
  granted_by      TEXT,
  revoked_at      INTEGER,
  FOREIGN KEY (seito_id) REFERENCES seito(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES seito(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS komon_active
  ON komon(seito_id, revoked_at);

CREATE TABLE IF NOT EXISTS danmaku_episode (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  season          INTEGER,
  episode         INTEGER,
  episode_title   TEXT,
  description     TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS danmaku_episode_search
  ON danmaku_episode(title, season, episode);

CREATE TABLE IF NOT EXISTS media_release (
  id                  TEXT PRIMARY KEY,
  provider            TEXT,
  provider_reference  TEXT,
  file_name           TEXT,
  size                INTEGER,
  duration            REAL,
  created_at          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS media_release_provider
  ON media_release(provider, provider_reference);

CREATE TABLE IF NOT EXISTS media_release_evidence (
  id              TEXT PRIMARY KEY,
  release_id      TEXT NOT NULL,
  kind            TEXT NOT NULL,
  algorithm       TEXT,
  scope           TEXT,
  digest_value    TEXT,
  evidence_json   TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (release_id) REFERENCES media_release(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS media_release_evidence_release
  ON media_release_evidence(release_id, created_at, id);

CREATE INDEX IF NOT EXISTS media_release_evidence_digest
  ON media_release_evidence(algorithm, scope, digest_value);

CREATE TABLE IF NOT EXISTS release_episode_match (
  id                TEXT PRIMARY KEY,
  release_id        TEXT NOT NULL,
  episode_id        TEXT NOT NULL,
  trust_scope       TEXT NOT NULL CHECK (trust_scope IN ('personal', 'room', 'global')),
  seito_id          TEXT,
  bushitsu_id       TEXT,
  enmoku_id         TEXT,
  reviewer_seito_id TEXT,
  confidence        TEXT NOT NULL CHECK (confidence IN ('confirmed', 'suggested', 'ambiguous', 'none')),
  evidence_json     TEXT NOT NULL,
  created_at        INTEGER NOT NULL,
  FOREIGN KEY (release_id) REFERENCES media_release(id) ON DELETE CASCADE,
  FOREIGN KEY (episode_id) REFERENCES danmaku_episode(id) ON DELETE CASCADE,
  FOREIGN KEY (seito_id) REFERENCES seito(id) ON DELETE CASCADE,
  FOREIGN KEY (bushitsu_id) REFERENCES bushitsu(id) ON DELETE CASCADE,
  FOREIGN KEY (enmoku_id) REFERENCES enmoku(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_seito_id) REFERENCES seito(id) ON DELETE SET NULL,
  CHECK (
    (trust_scope = 'personal' AND seito_id IS NOT NULL AND bushitsu_id IS NULL
      AND enmoku_id IS NULL AND reviewer_seito_id IS NULL)
    OR
    (trust_scope = 'room' AND seito_id IS NULL AND bushitsu_id IS NOT NULL
      AND reviewer_seito_id IS NULL)
    OR
    (trust_scope = 'global' AND seito_id IS NULL AND bushitsu_id IS NULL
      AND enmoku_id IS NULL AND reviewer_seito_id IS NOT NULL)
  ),
  CHECK (enmoku_id IS NULL OR bushitsu_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS release_episode_match_global
  ON release_episode_match(release_id, episode_id)
  WHERE trust_scope = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS release_episode_match_global_release
  ON release_episode_match(release_id)
  WHERE trust_scope = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS release_episode_match_personal
  ON release_episode_match(release_id, episode_id, seito_id)
  WHERE trust_scope = 'personal';

CREATE UNIQUE INDEX IF NOT EXISTS release_episode_match_room
  ON release_episode_match(release_id, episode_id, bushitsu_id, COALESCE(enmoku_id, ''))
  WHERE trust_scope = 'room';

CREATE INDEX IF NOT EXISTS release_episode_match_release
  ON release_episode_match(release_id, trust_scope, created_at);

CREATE TABLE IF NOT EXISTS danmaku_track (
  id                  TEXT PRIMARY KEY,
  episode_id          TEXT NOT NULL,
  release_id          TEXT,
  source_class        TEXT NOT NULL CHECK (source_class IN ('server-stored', 'provider-official', 'local', 'third-party')),
  name                TEXT NOT NULL,
  provenance_json     TEXT,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  active_revision_id  TEXT,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  FOREIGN KEY (episode_id) REFERENCES danmaku_episode(id) ON DELETE CASCADE,
  FOREIGN KEY (release_id) REFERENCES media_release(id) ON DELETE SET NULL,
  FOREIGN KEY (active_revision_id) REFERENCES danmaku_revision(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS danmaku_track_episode
  ON danmaku_track(episode_id, source_class, status, id);

CREATE TABLE IF NOT EXISTS danmaku_content (
  content_hash    TEXT PRIMARY KEY,
  algorithm       TEXT NOT NULL,
  scope           TEXT NOT NULL,
  canonical_json  TEXT NOT NULL,
  byte_length     INTEGER NOT NULL,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS danmaku_revision (
  id              TEXT PRIMARY KEY,
  track_id        TEXT NOT NULL,
  content_hash    TEXT,
  status          TEXT NOT NULL CHECK (status IN ('valid', 'failed')),
  fetched_at      INTEGER NOT NULL,
  error           TEXT,
  provenance_json TEXT,
  pinned          INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (track_id) REFERENCES danmaku_track(id) ON DELETE CASCADE,
  CHECK ((status = 'valid' AND content_hash IS NOT NULL AND error IS NULL)
    OR (status = 'failed' AND content_hash IS NULL))
);

CREATE INDEX IF NOT EXISTS danmaku_revision_track
  ON danmaku_revision(track_id, status, fetched_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS danmaku_revision_content
  ON danmaku_revision(content_hash, status);

-- A disabled revision is blocked without mutating the immutable revision row.
CREATE TABLE IF NOT EXISTS danmaku_revision_block (
  revision_id TEXT PRIMARY KEY,
  blocked_at  INTEGER NOT NULL,
  blocked_by  TEXT,
  reason      TEXT,
  FOREIGN KEY (revision_id) REFERENCES danmaku_revision(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_by) REFERENCES seito(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS danmaku_alignment (
  id                   TEXT PRIMARY KEY,
  release_id           TEXT NOT NULL,
  track_id             TEXT NOT NULL,
  offset_seconds       REAL NOT NULL,
  trim_start_seconds   REAL,
  trim_end_seconds     REAL,
  created_by           TEXT,
  created_at           INTEGER NOT NULL,
  FOREIGN KEY (release_id) REFERENCES media_release(id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES danmaku_track(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES seito(id) ON DELETE SET NULL,
  UNIQUE (release_id, track_id),
  CHECK (trim_start_seconds IS NULL OR trim_end_seconds IS NULL
    OR trim_end_seconds >= trim_start_seconds)
);

CREATE TABLE IF NOT EXISTS danmaku_proposal (
  id                      TEXT PRIMARY KEY,
  release_id              TEXT NOT NULL,
  target_episode_id       TEXT,
  suggested_title         TEXT,
  suggested_season        INTEGER,
  suggested_episode      INTEGER,
  suggested_description  TEXT,
  evidence_json           TEXT NOT NULL,
  submitter_seito_id      TEXT NOT NULL,
  reviewer_seito_id       TEXT,
  status                  TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
  merge_target_episode_id TEXT,
  disposition             TEXT,
  created_at              INTEGER NOT NULL,
  decided_at              INTEGER,
  FOREIGN KEY (release_id) REFERENCES media_release(id) ON DELETE CASCADE,
  FOREIGN KEY (target_episode_id) REFERENCES danmaku_episode(id) ON DELETE SET NULL,
  FOREIGN KEY (submitter_seito_id) REFERENCES seito(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_seito_id) REFERENCES seito(id) ON DELETE SET NULL,
  FOREIGN KEY (merge_target_episode_id) REFERENCES danmaku_episode(id) ON DELETE SET NULL,
  CHECK (target_episode_id IS NOT NULL OR suggested_title IS NOT NULL),
  CHECK (suggested_season IS NULL OR suggested_season >= 0),
  CHECK (suggested_episode IS NULL OR suggested_episode >= 0)
);

CREATE INDEX IF NOT EXISTS danmaku_proposal_status
  ON danmaku_proposal(status, created_at, id);

CREATE TABLE IF NOT EXISTS danmaku_audit (
  id              TEXT PRIMARY KEY,
  action          TEXT NOT NULL,
  actor_seito_id  TEXT,
  subject_type    TEXT NOT NULL,
  subject_id      TEXT NOT NULL,
  details_json    TEXT,
  dedupe_key      TEXT UNIQUE,
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (actor_seito_id) REFERENCES seito(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS danmaku_audit_subject
  ON danmaku_audit(subject_type, subject_id, created_at, id);

CREATE TABLE IF NOT EXISTS danmaku_source_policy (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  allowed_json    TEXT NOT NULL,
  order_json      TEXT NOT NULL,
  updated_at      INTEGER NOT NULL,
  updated_by      TEXT,
  FOREIGN KEY (updated_by) REFERENCES seito(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO danmaku_source_policy
  (id, allowed_json, order_json, updated_at, updated_by)
VALUES
  (1,
   '["server-stored","provider-official","local","third-party"]',
   '["server-stored","provider-official","local","third-party"]',
   0,
   NULL);

CREATE TABLE IF NOT EXISTS enmoku_danmaku_default (
  enmoku_id       TEXT PRIMARY KEY,
  bushitsu_id     TEXT NOT NULL,
  track_id        TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  FOREIGN KEY (enmoku_id) REFERENCES enmoku(id) ON DELETE CASCADE,
  FOREIGN KEY (bushitsu_id) REFERENCES bushitsu(id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES danmaku_track(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS enmoku_danmaku_default_room
  ON enmoku_danmaku_default(bushitsu_id, enmoku_id);
