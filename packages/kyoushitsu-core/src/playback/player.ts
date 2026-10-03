import type { Shinkou } from "houkago-kousoku"

// The sync boundary only knows how to describe and apply playback state. The
// component that owns ArtPlayer (and its media engines) implements this port.
// Keeping this contract in core makes it usable by another UI framework without
// importing Vue, Pinia, a browser element, or a third-party player.
export type PlayerHandle = {
  apply: (state: Shinkou) => void
  alignTransport: (state: Shinkou) => void
  setRate: (rate: number) => void
  snapshot: () => Shinkou
}
