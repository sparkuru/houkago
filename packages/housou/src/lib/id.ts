// App-generated string ids, stable across the eventual Postgres move
// (database-guidelines: PKs are string ids, not autoincrement).
export function newId(): string {
  return crypto.randomUUID()
}
