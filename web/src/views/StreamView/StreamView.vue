<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { streamViewModel } from './StreamViewModel'

onMounted(() => streamViewModel.onMounted())
onUnmounted(() => streamViewModel.onUnmounted())

const expandedIds = ref(new Set<number>())

function toggleExpand(id: number) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
  expandedIds.value = new Set(expandedIds.value)
}

function isExpanded(id: number): boolean {
  return expandedIds.value.has(id)
}
</script>

<template>
  <div class="steam-wrap">
    <div class="steam-header">
      <div class="steam-title">记忆流</div>
      <div class="steam-count">{{ streamViewModel.totalCount.value }}</div>
    </div>

    <div class="steam-columns">
      <div
        v-for="stream in streamViewModel.streams"
        :key="stream.title"
        class="steam-column"
      >
        <!-- 列标题 -->
        <div class="steam-column-header">
          <div class="steam-column-dot" :class="stream.columnDotClass"></div>
          <span>{{ stream.title }}</span>
          <span class="steam-column-count">{{ stream.countText.value }}</span>
        </div>

        <!-- 列表 -->
        <div class="steam-list">
          <div v-if="stream.items.value.length === 0" class="steam-empty">
            {{ stream.emptyText }}
          </div>

          <div
            v-for="item in stream.items.value"
            :key="item.id"
            :data-id="item.id"
            class="steam-item"
            :class="{ new: streamViewModel.isNew(item.id) }"
          >
            <div class="steam-dot" :class="item.dotClass"></div>

            <div class="steam-body">
              <span class="steam-action-label" :class="item.labelClass">{{ item.actionLabel }}</span>
              <span
                class="steam-text"
                :class="{ 'steam-text--expanded': isExpanded(item.id) }"
              >{{ item.displayText }}</span>

              <!-- 展开/折叠箭头 -->
              <button
                class="steam-expand-btn"
                :class="{ 'steam-expand-btn--open': isExpanded(item.id) }"
                @click.stop="toggleExpand(item.id)"
              >▶</button>

              <!-- 状态图标 -->
              <div v-if="item.statusIcon === 'pending'" class="steam-status-icon">
                <div class="steam-spinner"></div>
              </div>
              <div v-else-if="item.statusIcon === 'done'" class="steam-status-icon">
                <span class="steam-check">&#10003;</span>
              </div>
              <div v-else-if="item.statusIcon === 'error'" class="steam-status-icon">
                <span class="steam-error">&#10007;</span>
              </div>
            </div>

            <div class="steam-time">{{ item.displayTime }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.steam-wrap {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  gap: 16px;
  box-sizing: border-box;
  height: 100%;
}

.steam-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.steam-title {
  font-size: 16px;
  font-weight: 700;
  color: #e2e8f0;
}

.steam-count {
  font-size: 12px;
  color: #64748b;
}

.steam-columns {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.steam-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  overflow: hidden;
  height: 100%;
}

.steam-column-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  padding-bottom: 8px;
  border-bottom: 1px solid #2d3149;
}

.steam-column-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.steam-column-dot.store  { background: #22c55e; box-shadow: 0 0 6px #22c55e66; }
.steam-column-dot.search { background: #3b82f6; box-shadow: 0 0 6px #3b82f666; }
.steam-column-dot.delete { background: #ef4444; box-shadow: 0 0 6px #ef444466; }

.steam-column-count {
  margin-left: auto;
  font-size: 11px;
  color: #64748b;
  font-weight: 400;
}

.steam-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.steam-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #1a1d27;
  border: 1px solid #2d3149;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px;
  color: #94a3b8;
}

.steam-item.new {
  animation: slideIn 0.3s ease-out both;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-12px);
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    border-width: 0;
    margin-bottom: -6px;
  }
  to {
    opacity: 1;
    transform: translateY(0);
    max-height: 200px;
    padding-top: 10px;
    padding-bottom: 10px;
    border-width: 1px;
    margin-bottom: 6px;
  }
}

.steam-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
}

.steam-dot.store  { background: #22c55e; box-shadow: 0 0 6px #22c55e66; }
.steam-dot.search { background: #3b82f6; box-shadow: 0 0 6px #3b82f666; }
.steam-dot.delete { background: #ef4444; box-shadow: 0 0 6px #ef444466; }

.steam-body {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.steam-action-label {
  font-weight: 600;
  color: #a78bfa;
  flex-shrink: 0;
}

.steam-action-label.delete-label { color: #f87171; }

/* 默认单行截断 */
.steam-text {
  color: #cbd5e1;
  line-height: 1.5;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 展开后全文显示 */
.steam-text--expanded {
  white-space: pre-wrap;
  word-break: break-word;
  overflow: visible;
}

/* 展开箭头按钮 */
.steam-expand-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #475569;
  font-size: 9px;
  padding: 0;
  flex-shrink: 0;
  line-height: 1;
  margin-top: 3px;
  transform: rotate(0deg);
  transition: transform 0.2s ease, color 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
}

.steam-expand-btn:hover {
  color: #94a3b8;
}

.steam-expand-btn--open {
  transform: rotate(90deg);
  color: #a78bfa;
}

.steam-time {
  font-size: 10px;
  color: #475569;
  white-space: nowrap;
  flex-shrink: 0;
  margin-top: 2px;
}

.steam-empty {
  text-align: center;
  color: #475569;
  padding: 40px 0;
  font-size: 13px;
}

.steam-status-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.steam-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #475569;
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: steamSpin 0.8s linear infinite;
}

@keyframes steamSpin {
  to { transform: rotate(360deg); }
}

.steam-check { font-size: 13px; font-weight: 700; color: #22c55e; }
.steam-error { font-size: 12px; font-weight: 700; color: #ef4444; }
</style>
