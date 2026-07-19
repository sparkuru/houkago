import { housou } from "@/api"
import type { Enmoku } from "houkago-kousoku"
import { ref } from "vue"

type EnmokuPreview = {
  state: "ready"
  title: string
  type: Enmoku["type"]
  provider?: { kind: "bilibili"; ownerName?: string }
  sourceCount?: number
  subtitleCount?: number
  live?: boolean
}

type EnmokuPreviewError = "" | "sourcePreviewFailed" | "sourceAddFailed"

export function useEnmokuPreview(bushitsuId: string) {
  const sourceUrl = ref("")
  const title = ref("")
  const preview = ref<EnmokuPreview | null>(null)
  const error = ref<EnmokuPreviewError>("")
  const resolving = ref(false)
  const submitting = ref(false)

  async function resolve(): Promise<void> {
    const url = sourceUrl.value.trim()
    if (!url || resolving.value) return
    resolving.value = true
    preview.value = null
    error.value = ""
    try {
      const { data } = await housou.bushitsu({ id: bushitsuId }).enmoku.preview.post({
        sourceUrl: url,
        title: title.value.trim() || undefined,
      })
      if (!data) {
        error.value = "sourcePreviewFailed"
        return
      }
      preview.value = data
    } catch {
      error.value = "sourcePreviewFailed"
    } finally {
      resolving.value = false
    }
  }

  async function add(): Promise<Enmoku | null> {
    if (!preview.value || submitting.value) return null
    submitting.value = true
    error.value = ""
    try {
      const { data } = await housou.bushitsu({ id: bushitsuId }).enmoku.post({
        sourceUrl: sourceUrl.value.trim(),
        title: title.value.trim() || undefined,
      })
      if (!data) {
        error.value = "sourceAddFailed"
        return null
      }
      return data
    } catch {
      error.value = "sourceAddFailed"
      return null
    } finally {
      submitting.value = false
    }
  }

  function reset(): void {
    sourceUrl.value = ""
    title.value = ""
    preview.value = null
    error.value = ""
  }

  function edit(): void {
    preview.value = null
  }

  return { sourceUrl, title, preview, error, resolving, submitting, resolve, add, reset, edit }
}
