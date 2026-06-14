<script setup lang="ts">
import { useBushitsuStore } from "@/stores/bushitsu"
import { ref } from "vue"

// B-station-live-style chat side panel (scaffold shell). Emits the romaji domain
// verb so the parent decides how to send; this component does not own the WS.
const bushitsu = useBushitsuStore()
// toggle：折叠要求。親（BushitsuView）が chatHiraku を畳む。ChatPanel は WS も
// 折叠態も自管せず emit で親へ委ねる（component-guidelines）。
const emit = defineEmits<{ oshaberi: [content: string]; toggle: [] }>()

const draft = ref("")

function send() {
  const content = draft.value.trim()
  if (!content) return
  emit("oshaberi", content)
  draft.value = ""
}
</script>

<template>
  <aside class="chat-panel">
    <header class="chat-head">
      <span>出席 {{ bushitsu.shusseki }}</span>
      <button
        type="button"
        class="chat-collapse"
        aria-label="聊天室を畳む"
        @click="emit('toggle')"
      >
        ›
      </button>
    </header>
    <ul class="chat-log">
      <li v-for="(line, i) in bushitsu.chat" :key="i">
        <span class="sender">{{ bushitsu.nicknameOf(line.senderId) }}</span>: {{ line.content }}
      </li>
    </ul>
    <form class="chat-input" @submit.prevent="send">
      <input v-model="draft" aria-label="お喋り" placeholder="メッセージ..." />
      <button type="submit">送信</button>
    </form>
  </aside>
</template>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  width: 320px;
  border-left: 1px solid #ddd;
  /* 实底色：网页全屏黑底下右侧聊天栏仍是可读的白底深字（普通模式白底本就合理） */
  background: #fff;
  color: #222;
}
.chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  font-weight: bold;
  border-bottom: 1px solid #eee;
}
/* header 右端の小さな折叠ボタン（prd #4 展开態）。中間の粗竖条は廃止。 */
.chat-collapse {
  padding: 0 6px;
  font-size: 16px;
  line-height: 1;
  color: #888;
  background: transparent;
  border: none;
  cursor: pointer;
}
.chat-collapse:hover {
  color: #222;
}
.chat-log {
  flex: 1;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 8px;
}
.sender {
  color: #888;
}
.chat-input {
  display: flex;
  gap: 4px;
  padding: 8px;
  border-top: 1px solid #eee;
}
.chat-input input {
  flex: 1;
}
</style>
