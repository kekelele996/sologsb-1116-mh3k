<script setup lang="ts">
import { computed } from 'vue'
import { coordError, type CoordValue } from '@/utils/geo'

const props = defineProps<{
  modelValue: CoordValue
  disabled?: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: CoordValue): void
}>()

function patch(next: Partial<CoordValue>): void {
  emit('update:modelValue', { ...props.modelValue, ...next })
}

/** 经纬度格式校验 */
const error = computed<string | null>(() => coordError(props.modelValue.longitude, props.modelValue.latitude))
</script>

<template>
  <div class="coord-input">
    <div class="grid">
      <label class="cell">
        <span class="lab">经度</span>
        <el-input-number
          :model-value="modelValue.longitude"
          :disabled="disabled"
          :precision="4"
          :step="0.0001"
          :controls="false"
          style="width: 100%"
          @update:model-value="(value: number | undefined) => patch({ longitude: Number(value ?? 0) })"
        />
      </label>
      <label class="cell">
        <span class="lab">纬度</span>
        <el-input-number
          :model-value="modelValue.latitude"
          :disabled="disabled"
          :precision="4"
          :step="0.0001"
          :controls="false"
          style="width: 100%"
          @update:model-value="(value: number | undefined) => patch({ latitude: Number(value ?? 0) })"
        />
      </label>
      <label class="cell">
        <span class="lab">海拔（m）</span>
        <el-input-number
          :model-value="modelValue.altitude"
          :disabled="disabled"
          :precision="0"
          :controls="false"
          style="width: 100%"
          @update:model-value="(value: number | undefined) => patch({ altitude: Number(value ?? 0) })"
        />
      </label>
    </div>
    <p v-if="error" class="err">{{ error }}</p>
    <p v-else class="ok">
      坐标校验通过：{{ modelValue.longitude.toFixed(4) }}, {{ modelValue.latitude.toFixed(4) }}
    </p>
  </div>
</template>

<style scoped>
.coord-input {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}
.cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.lab {
  font-size: 12px;
  color: #6b7b8c;
}
.err {
  margin: 0;
  font-size: 12px;
  color: #c0392b;
}
.ok {
  margin: 0;
  font-size: 12px;
  color: #1f8a70;
}
</style>
