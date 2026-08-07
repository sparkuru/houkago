import { expect, test } from "bun:test"

async function runBun(code: string, env: Record<string, string> = {}): Promise<string> {
  const child = Bun.spawn(["bun", "-e", code], {
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  expect(exitCode).toBe(0)
  expect(stderr).toBe("")
  return stdout.trim()
}

test("bootstrap backfills legacy queues in created_at then id order", async () => {
  const dbPath = `/tmp/houkago-queue-backfill-${crypto.randomUUID()}.sqlite`
  const legacySchema = `
    CREATE TABLE seito (id TEXT PRIMARY KEY, username TEXT, username_norm TEXT, password_hash TEXT, created_at INTEGER);
    CREATE TABLE bushitsu (id TEXT PRIMARY KEY, name TEXT, buchou_id TEXT, created_at INTEGER);
    CREATE TABLE bushitsu_buin (bushitsu_id TEXT, seito_id TEXT, joined_at INTEGER, PRIMARY KEY (bushitsu_id, seito_id));
    CREATE TABLE enmoku (
      id TEXT PRIMARY KEY, bushitsu_id TEXT, title TEXT, type TEXT, url TEXT,
      headers_json TEXT, subtitles_json TEXT, sources_json TEXT, danmaku_json TEXT,
      provider_json TEXT, live INTEGER, added_by TEXT, created_at INTEGER
    );
    INSERT INTO seito VALUES ('owner', 'owner', 'owner', 'hash', 0);
    INSERT INTO bushitsu VALUES ('room', 'Room', 'owner', 0);
    INSERT INTO enmoku (id, bushitsu_id, title, type, url, added_by, created_at) VALUES
      ('b', 'room', 'B', 'direct', 'https://example.test/b', 'owner', 10),
      ('a', 'room', 'A', 'direct', 'https://example.test/a', 'owner', 10),
      ('c', 'room', 'C', 'direct', 'https://example.test/c', 'owner', 20);
  `
  await runBun(`
    import { Database } from "bun:sqlite"
    const db = new Database(${JSON.stringify(dbPath)})
    db.exec(${JSON.stringify(legacySchema)})
    db.close()
  `)

  const clientUrl = new URL("../src/db/client.ts", import.meta.url).href
  const output = await runBun(
    `
      const { db } = await import(${JSON.stringify(clientUrl)})
      console.log(JSON.stringify({
        entries: db.query(
          "SELECT enmoku_id, sort_key FROM bangumi_entry ORDER BY sort_key ASC, enmoku_id ASC",
        ).all(),
        bushitsuColumns: db.query("PRAGMA table_info(bushitsu)").all().map((column) => column.name),
      }))
    `,
    { HOUSOU_DB: dbPath },
  )

  const bootstrap = JSON.parse(output) as { entries: unknown; bushitsuColumns: string[] }
  expect(bootstrap.entries).toEqual([
    { enmoku_id: "a", sort_key: 0 },
    { enmoku_id: "b", sort_key: 1 },
    { enmoku_id: "c", sort_key: 2 },
  ])
  expect(bootstrap.bushitsuColumns).toContain("kengen_json")
})
