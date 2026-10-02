<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { CollectPoint, FieldReading, ReadingSource } from '@/types'
import { READING_SOURCES, VEGETATIONS, SUBSTRATES } from '@/types'
import { adoptStatus, adoptedCoord, readingDiffers } from '@/utils/point'

const props = defineProps<{ point: CollectPoint }>()
const emit = defineEmits<{
  (e: 'save', point: CollectPoint): void
  (e: 'addReading', pointId: string, reading: Omit<FieldReading, 'id'>): void
  (e: 'adoptReading', pointId: string, readingId: string): void
}>()

/** 整理组草稿（采用坐标 + 点位说明） */
const draft = reactive<CollectPoint>({ ...props.point })
watch(
  () => props.point,
  (next) => Object.assign(draft, next),
  { deep: true }
)

/** 野外组补登读数草稿 */
const readingDraft = reactive({
  source: '定位仪' as ReadingSource,
  longitude: 0,
  latitude: 0,
  altitude: 0,
  note: ''
})

const status = computed(() => adoptStatus(props.point))
const adopted = computed(() => adoptedCoord(props.point))

/** 是否为当前采用的那组读数 */
function isAdoptedReading(reading: FieldReading): boolean {
  const coord = adopted.value
  if (!coord) return false
  return (
    reading.longitude === coord.longitude &&
    reading.latitude === coord.latitude &&
    reading.altitude === coord.altitude
  )
}

function submitReading(): void {
  if (!Number.isFinite(readingDraft.longitude) || !Number.isFinite(readingDraft.latitude)) {
    ElMessage.warning('经纬度必须是数字')
    return
  }
  if (readingDraft.longitude < -180 || readingDraft.longitude > 180) {
    ElMessage.warning('经度必须在 -180 ~ 180 之间')
    return
  }
  if (readingDraft.latitude < -90 || readingDraft.latitude > 90) {
    ElMessage.warning('纬度必须在 -90 ~ 90 之间')
    return
  }
  emit('addReading', props.point.id, {
    source: readingDraft.source,
    longitude: Number(readingDraft.longitude) || 0,
    latitude: Number(readingDraft.latitude) || 0,
    altitude: Number(readingDraft.altitude) || 0,
    recordedAt: new Date().toISOString().slice(0, 10),
    note: readingDraft.note.trim()
  })
  readingDraft.note = ''
}

function submitSave(): void {
  if (!draft.name.trim()) {
    ElMessage.warning('采集点名称不能为空')
    return
  }
  const next: CollectPoint = {
    ...draft,
    name: draft.name.trim(),
    locationNote: draft.locationNote.trim(),
    companionTrees: draft.companionTrees.trim()
  }
  // 只有采用坐标确实变动（含首次采用）才复位高水位标记；
  // 仅改点位说明不动坐标时，保留「待重新采用」状态。
  const coordChanged =
    next.adoptedLongitude !== props.point.adoptedLongitude ||
    next.adoptedLatitude !== props.point.adoptedLatitude ||
    next.adoptedAltitude !== props.point.adoptedAltitude
  if (coordChanged && next.adoptedLongitude != null && next.adoptedLatitude != null) {
    next.adoptedReadingsCount = next.readings.length
  }
  emit('save', next)
}
</script>

<template>
  <div class="two-sides">
    <section class="side field-side">
      <div class="side-head">
        <span class="side-title">野外组 · 各来源原始读数</span>
        <el-tag size="small" effect="plain" type="info">只追加，不改写</el-tag>
      </div>

      <el-table :data="point.readings" border size="small" class="readings-table">
        <el-table-column label="来源" min-width="110">
          <template #default="{ row }">
            <span>{{ row.source }}</span>
            <el-tag v-if="isAdoptedReading(row)" size="small" type="success" effect="dark" class="adopted-tag">
              已采用
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="经度" min-width="100">
          <template #default="{ row }">
            <span :class="{ mismatch: readingDiffers(point, row) }">{{ row.longitude.toFixed(4) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="纬度" min-width="100">
          <template #default="{ row }">
            <span :class="{ mismatch: readingDiffers(point, row) }">{{ row.latitude.toFixed(4) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="海拔" width="80">
          <template #default="{ row }">{{ row.altitude }} m</template>
        </el-table-column>
        <el-table-column prop="recordedAt" label="日期" width="110" />
        <el-table-column prop="note" label="备注" min-width="120" />
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              plain
              :disabled="isAdoptedReading(row)"
              @click="emit('adoptReading', point.id, row.id)"
            >
              采用
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="point.readings.length === 0" description="暂无读数" :image-size="56" />

      <div class="add-reading">
        <div class="add-title">补登读数</div>
        <div class="add-grid">
          <label class="cell">
            <span class="lab">来源</span>
            <el-select v-model="readingDraft.source" size="small">
              <el-option v-for="item in READING_SOURCES" :key="item" :label="item" :value="item" />
            </el-select>
          </label>
          <label class="cell">
            <span class="lab">经度</span>
            <el-input-number
              v-model="readingDraft.longitude"
              :precision="4"
              :step="0.0001"
              :controls="false"
              size="small"
              style="width: 100%"
            />
          </label>
          <label class="cell">
            <span class="lab">纬度</span>
            <el-input-number
              v-model="readingDraft.latitude"
              :precision="4"
              :step="0.0001"
              :controls="false"
              size="small"
              style="width: 100%"
            />
          </label>
          <label class="cell">
            <span class="lab">海拔(m)</span>
            <el-input-number v-model="readingDraft.altitude" :controls="false" size="small" style="width: 100%" />
          </label>
          <label class="cell wide">
            <span class="lab">备注</span>
            <el-input v-model="readingDraft.note" size="small" placeholder="如 信号弱、阴天" />
          </label>
        </div>
        <div class="add-actions">
          <el-button size="small" type="primary" @click="submitReading">补登读数</el-button>
          <span v-if="status === 'pending'" class="pending-hint">
            补登后标记为「待重新采用」，采用坐标仍按整理组那份算，点位说明不冲掉
          </span>
        </div>
      </div>
    </section>

    <section class="side org-side">
      <div class="side-head">
        <span class="side-title">整理组 · 采用坐标与点位说明</span>
        <el-tag v-if="status === 'adopted'" type="success" size="small" effect="dark">已采用</el-tag>
        <el-tag v-else-if="status === 'pending'" type="warning" size="small" effect="dark">待重新采用</el-tag>
        <el-tag v-else type="info" size="small" effect="plain">未采用</el-tag>
      </div>

      <div class="org-grid">
        <label class="cell">
          <span class="lab">采集点名称</span>
          <el-input v-model="draft.name" size="small" />
        </label>
        <label class="cell">
          <span class="lab">采用经度</span>
          <el-input-number
            :model-value="draft.adoptedLongitude"
            :precision="4"
            :step="0.0001"
            :controls="false"
            size="small"
            style="width: 100%"
            @update:model-value="(value: number | undefined) => (draft.adoptedLongitude = value == null ? null : Number(value))"
          />
        </label>
        <label class="cell">
          <span class="lab">采用纬度</span>
          <el-input-number
            :model-value="draft.adoptedLatitude"
            :precision="4"
            :step="0.0001"
            :controls="false"
            size="small"
            style="width: 100%"
            @update:model-value="(value: number | undefined) => (draft.adoptedLatitude = value == null ? null : Number(value))"
          />
        </label>
        <label class="cell">
          <span class="lab">采用海拔(m)</span>
          <el-input-number
            :model-value="draft.adoptedAltitude"
            :controls="false"
            size="small"
            style="width: 100%"
            @update:model-value="(value: number | undefined) => (draft.adoptedAltitude = value == null ? null : Number(value))"
          />
        </label>
        <label class="cell">
          <span class="lab">植被类型</span>
          <el-select v-model="draft.vegetation" size="small">
            <el-option v-for="item in VEGETATIONS" :key="item" :label="item" :value="item" />
          </el-select>
        </label>
        <label class="cell">
          <span class="lab">基物</span>
          <el-select v-model="draft.substrate" size="small">
            <el-option v-for="item in SUBSTRATES" :key="item" :label="item" :value="item" />
          </el-select>
        </label>
        <label class="cell wide">
          <span class="lab">伴生树种</span>
          <el-input v-model="draft.companionTrees" size="small" />
        </label>
        <label class="cell">
          <span class="lab">采集日期</span>
          <el-date-picker
            v-model="draft.collectDate"
            type="date"
            value-format="YYYY-MM-DD"
            size="small"
            style="width: 100%"
          />
        </label>
        <label class="cell">
          <span class="lab">采集人</span>
          <el-input v-model="draft.collector" size="small" />
        </label>
        <label class="cell wide">
          <span class="lab">点位说明</span>
          <el-input
            v-model="draft.locationNote"
            type="textarea"
            :rows="2"
            size="small"
            placeholder="整理组维护的点位补充描述，野外补读数不冲掉"
          />
        </label>
      </div>

      <div class="org-actions">
        <el-button size="small" type="primary" @click="submitSave">保存采用</el-button>
        <span v-if="adopted" class="muted">
          当前采用：{{ adopted.longitude.toFixed(4) }}, {{ adopted.latitude.toFixed(4) }} ·
          {{ adopted.altitude }} m
        </span>
        <span v-else class="muted">尚未采用，可在左表点「采用」或手动填写后保存</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.two-sides {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 900px) {
  .two-sides {
    grid-template-columns: 1fr;
  }
}
.side {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e8e2d6;
  border-radius: 10px;
  background: #fdfcf9;
}
.side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.side-title {
  font-size: 13px;
  font-weight: 600;
  color: #3b2a1d;
}
.readings-table {
  width: 100%;
}
.adopted-tag {
  margin-left: 6px;
}
.mismatch {
  color: #c0392b;
  font-weight: 600;
}
.add-reading {
  border-top: 1px dashed #e0d8c8;
  padding-top: 10px;
}
.add-title {
  font-size: 12px;
  font-weight: 600;
  color: #6f7d72;
  margin-bottom: 8px;
}
.add-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
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
  font-size: 11px;
  color: #6b7b8c;
}
.add-actions,
.org-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.pending-hint {
  font-size: 11px;
  color: #a45b1f;
}
.org-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.muted {
  font-size: 12px;
  color: #7f8d82;
}
</style>
