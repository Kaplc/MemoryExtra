<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { streamViewModel } from './StreamViewModel'
import StoreStreamItem from './StoreStreamItem.vue'
import SearchStreamItem from './SearchStreamItem.vue'
import DeleteStreamItem from './DeleteStreamItem.vue'

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

function getItemComponent(action: string) {
  if (action === 'store') return StoreStreamItem
  if (action === 'search') return SearchStreamItem
  if (action === 'delete') return DeleteStreamItem
  return StoreStreamItem
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

          <component
            :is="getItemComponent(item.action)"
            v-for="item in stream.items.value"
            :key="item.id"
            :item="item"
            :is-expanded="isExpanded(item.id)"
            :is-new="streamViewModel.isNew(item.id)"
            @toggle="toggleExpand"
          />
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

.steam-empty {
  text-align: center;
  color: #475569;
  padding: 40px 0;
  font-size: 13px;
}
</style>
