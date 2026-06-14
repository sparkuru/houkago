<script setup lang="ts">
import { useBushitsuStore } from "@/stores/bushitsu"
import { ref } from "vue"

// B-station-live-style chat side panel (scaffold shell). Emits the romaji domain
// verb so the parent decides how to send; this component does not own the WS.
const bushitsu = useBushitsuStore()
const emit = defineEmits<{ oshaberi: [content: string] }>()

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
    <header class="chat-head">出席 {{ bushitsu.shusseki }}</header>
    <ul class="chat-log">
      <li v-for="(line, i) in bushitsu.chat" :key="i">
        <span class="sender">{{ line.senderId }}</span>: {{ line.content }}
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
  padding: 8px;
  font-weight: bold;
  border-bottom: 1px solid #eee;
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
