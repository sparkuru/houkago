import type { Enmoku } from "houkago-kousoku"

type UserHeldPermitDependencies = {
  permit: (sourceId: string, bushitsuId: string, upstreamHandle: string) => Promise<void>
  rollback: (enmokuId: string) => Promise<unknown>
}

export async function permitCreatedUserHeldSource(
  enmoku: Enmoku,
  bushitsuId: string,
  upstreamHandle: string,
  dependencies: UserHeldPermitDependencies,
): Promise<void> {
  if (enmoku.provider?.kind !== "baidu") throw new Error("Expected a Baidu source")
  try {
    await dependencies.permit(enmoku.provider.sourceId, bushitsuId, upstreamHandle)
  } catch (error) {
    try {
      await dependencies.rollback(enmoku.id)
    } catch {
      // Rollback is best-effort; preserve the extension failure shown to the user.
    }
    throw error
  }
}
