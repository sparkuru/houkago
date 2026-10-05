import { t } from "houkago-kyoushitsu-core/i18n"
import type { RoomState } from "./room-runtime"

export function roomConnectionLabel(connection: RoomState["connection"]): string {
  switch (connection) {
    case "open":
      return t("roomStatusNormal")
    case "closed":
      return t("roomStatusClosed")
    case "error":
      return t("roomStatusError")
    case "connecting":
      return t("roomStatusConnecting")
  }
}
