<template>
  <div class="stream-item store-item" :class="{ new: isNew }">
    <div class="stream-dot"></div>

    <div class="stream-content">
      <div class="stream-body">
        <div class="stream-left">
          <span class="stream-action-label" :class="item.labelClass">{{ item.actionLabel }}</span>
          <span
            v-for="tag in item.entityTags"
            :key="tag"
            class="stream-entity-tag-inline"
          >{{ tag }}</span>
        </div>
        <div class="stream-right">
          <div v-if="item.statusIcon === 'pending'" class="stream-status-icon">
            <div class="stream-spinner"></div>
          </div>
          <div v-else-if="item.statusIcon === 'done'" class="stream-status-icon">
            <span class="stream-check">✓</span>
          </div>
          <div v-else-if="item.statusIcon === 'error'" class="stream-status-icon">
            <span class="stream-error">✗</span>
          </div>
          <span class="stream-time">{{ item.displayTime }}</span>
        </div>
      </div>

      <div class="stream-text-wrap">
        <span
          class="stream-text"
          :class="{ 'stream-text--expanded': isExpanded }"
        >{{ item.displayText }}</span>
        <button
          class="stream-expand-btn"
          :class="{ 'stream-expand-btn--open': isExpanded }"
          @click.stop="$emit('toggle', item.id)"
        >▶</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StreamItemData } from './types'

const props = defineProps<{
  item: StreamItemData & { entityTags: string[]; actionLabel: string; dotClass: string; labelClass: string; statusIcon: string; displayText: string; displayTime: string }
  isExpanded: boolean
  isNew?: boolean
}>()

defineEmits<{
  toggle: [id: number]
}>()
</script>

<style scoped>
.store-item {
  position: relative;
}

.stream-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #1a1d27;
  border: 1px solid #2d3149;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px;
  color: #94a3b8;
  position: relative;
}

.stream-item.new {
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

.stream-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e66;
  flex-shrink: 0;
  margin-top: 4px;
}

.stream-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stream-body {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.stream-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.stream-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.stream-action-label {
  font-weight: 600;
  color: #a78bfa;
  flex-shrink: 0;
}

.stream-entity-tag-inline {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #2d3149;
  color: #a78bfa;
  border: 1px solid #3d3f5a;
  flex-shrink: 0;
}

.stream-text-wrap {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding-left: 0;
}

.stream-text-wrap .stream-expand-btn {
  margin-left: auto;
}

.stream-text {
  color: #cbd5e1;
  line-height: 1.5;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stream-text--expanded {
  white-space: pre-wrap;
  word-break: break-word;
  overflow: visible;
}

.stream-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
  padding-right: 20px;
}

.stream-expand-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #475569;
  font-size: 9px;
  padding: 0;
  line-height: 1;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 4px;
}

.stream-expand-btn:hover {
  color: #94a3b8;
}

.stream-expand-btn--open {
  transform: rotate(90deg);
  color: #a78bfa;
}

.stream-time {
  font-size: 10px;
  color: #475569;
  white-space: nowrap;
  flex-shrink: 0;
  margin-top: 2px;
}

.stream-status-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stream-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #475569;
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.stream-check { font-size: 13px; font-weight: 700; color: #22c55e; }
.stream-error { font-size: 12px; font-weight: 700; color: #ef4444; }
</style>