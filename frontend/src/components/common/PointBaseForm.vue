<script setup lang="ts">
import { SUBSTRATES, VEGETATIONS, type CollectPoint, type Substrate, type Vegetation } from '@/types'

const props = defineProps<{
  modelValue: CollectPoint
  /** 是否显示采集日期与采集人 */
  withMeta?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: CollectPoint): void
}>()

function patch(next: Partial<CollectPoint>): void {
  emit('update:modelValue', { ...props.modelValue, ...next })
}
</script>

<template>
  <div class="base-form">
    <div class="grid">
      <label class="cell">
        <span class="lab">采集点名称</span>
        <el-input
          :model-value="modelValue.name"
          :disabled="disabled"
          placeholder="如 百花山栎树林样线"
          @update:model-value="(value: string) => patch({ name: value })"
        />
      </label>
      <label class="cell">
        <span class="lab">植被类型</span>
        <el-select
          :model-value="modelValue.vegetation"
          :disabled="disabled"
          style="width: 100%"
          @update:model-value="(value: Vegetation) => patch({ vegetation: value })"
        >
          <el-option v-for="item in VEGETATIONS" :key="item" :label="item" :value="item" />
        </el-select>
      </label>
      <label class="cell">
        <span class="lab">基物</span>
        <el-select
          :model-value="modelValue.substrate"
          :disabled="disabled"
          style="width: 100%"
          @update:model-value="(value: Substrate) => patch({ substrate: value })"
        >
          <el-option v-for="item in SUBSTRATES" :key="item" :label="item" :value="item" />
        </el-select>
      </label>
      <label class="cell wide">
        <span class="lab">伴生树种</span>
        <el-input
          :model-value="modelValue.companionTrees"
          :disabled="disabled"
          placeholder="如 辽东栎、油松"
          @update:model-value="(value: string) => patch({ companionTrees: value })"
        />
      </label>
      <template v-if="withMeta">
        <label class="cell">
          <span class="lab">采集日期</span>
          <el-date-picker
            :model-value="modelValue.collectDate"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            @update:model-value="(value: string | null) => patch({ collectDate: value ?? '' })"
          />
        </label>
        <label class="cell">
          <span class="lab">采集人</span>
          <el-input
            :model-value="modelValue.collector"
            :disabled="disabled"
            @update:model-value="(value: string) => patch({ collector: value })"
          />
        </label>
      </template>
    </div>
  </div>
</template>

<style scoped>
.base-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}
.cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cell.wide {
  grid-column: span 2;
}
.lab {
  font-size: 12px;
  color: #6b7b8c;
}
</style>
