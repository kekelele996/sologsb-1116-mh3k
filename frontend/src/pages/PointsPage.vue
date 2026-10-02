<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { COORD_SOURCES } from '@/types'
import type { CollectPoint, CoordReading, CoordSource } from '@/types'
import CoordInput from '@/components/common/CoordInput.vue'
import PointBaseForm from '@/components/common/PointBaseForm.vue'
import { useStore } from '@/hooks/usePersistentStore'
import { pointStore } from '@/stores/pointStore'
import { readingStore } from '@/stores/readingStore'
import { recordStore } from '@/stores/recordStore'
import { uid } from '@/utils/id'
import {
  READING_DISAGREE_M,
  adoptedCoordText,
  adoptedFromText,
  coordError,
  hasAdoptedCoord,
  pointCoordStatus,
  readingsSpreadMeters
} from '@/utils/geo'

const pointState = useStore(pointStore)
const readingState = useStore(readingStore)
const recordState = useStore(recordStore)

const today = new Date().toISOString().slice(0, 10)

function emptyPoint(): CollectPoint {
  return {
    id: '',
    name: '',
    adoptedLongitude: null,
    adoptedLatitude: null,
    adoptedAltitude: null,
    adoptedFrom: null,
    siteNote: '',
    pendingReadopt: false,
    vegetation: '针阔混交林',
    substrate: '落叶层',
    companionTrees: '',
    collectDate: today,
    collector: ''
  }
}

/* ---------- 采集点基本信息（不含坐标） ---------- */

const editingId = ref<string | null>(null)
const draft = reactive<CollectPoint>(emptyPoint())

function resetDraft(): void {
  editingId.value = null
  Object.assign(draft, emptyPoint())
}

function edit(point: CollectPoint): void {
  editingId.value = point.id
  Object.assign(draft, point)
}

async function submit(): Promise<void> {
  if (!draft.name.trim()) {
    ElMessage.warning('请填写采集点名称')
    return
  }
  const row: CollectPoint = {
    ...draft,
    id: editingId.value ?? uid('pt'),
    name: draft.name.trim(),
    companionTrees: draft.companionTrees.trim(),
    collector: draft.collector.trim()
  }
  await pointStore.getState().save(row)
  ElMessage.success(editingId.value ? '采集点信息已更新' : '采集点已建立，等待野外组读数与整理组采用')
  resetDraft()
}

/* ---------- 野外组：坐标读数登记 ---------- */

const readingDraft = reactive({
  pointId: '',
  source: '定位仪读数' as CoordSource,
  coord: { longitude: 116.4, latitude: 39.9, altitude: 800 },
  reader: '',
  readAt: today,
  note: ''
})

async function submitReading(): Promise<void> {
  const point = pointState.points.find((item) => item.id === readingDraft.pointId)
  if (!point) {
    ElMessage.warning('请选择采集点')
    return
  }
  const err = coordError(readingDraft.coord.longitude, readingDraft.coord.latitude)
  if (err) {
    ElMessage.warning(err)
    return
  }
  const wasAdopted = hasAdoptedCoord(point)
  const reading: CoordReading = {
    id: uid('rdg'),
    pointId: point.id,
    source: readingDraft.source,
    longitude: readingDraft.coord.longitude,
    latitude: readingDraft.coord.latitude,
    altitude: readingDraft.coord.altitude,
    reader: readingDraft.reader.trim(),
    readAt: readingDraft.readAt,
    note: readingDraft.note.trim()
  }
  await readingStore.getState().add(reading)
  if (wasAdopted) {
    ElMessage.success(`读数已补录；「${point.name}」已标记为待重新采用，采用坐标仍以整理组为准`)
  } else {
    ElMessage.success('读数已补录')
  }
  readingDraft.note = ''
}

/* ---------- 整理组：采用坐标与点位说明 ---------- */

const adoptDraft = reactive({
  pointId: '',
  mode: 'reading' as 'reading' | 'manual',
  readingId: '',
  coord: { longitude: 0, latitude: 0, altitude: 0 },
  siteNote: ''
})

const adoptPoint = computed(() => pointState.points.find((item) => item.id === adoptDraft.pointId) ?? null)
const adoptReadings = computed(() => readingsOf(adoptDraft.pointId))

/** 把采集点（及其当前采用情况）带入整理组表单；传 readingId 表示直接采用该读数 */
function prepareAdopt(pointId: string, readingId?: string): void {
  const point = pointState.points.find((item) => item.id === pointId)
  if (!point) return
  adoptDraft.pointId = pointId
  adoptDraft.siteNote = point.siteNote
  const readings = readingsOf(pointId)
  const picked = readings.find((item) => item.id === (readingId ?? point.adoptedFrom)) ?? readings[0] ?? null
  if (readingId || !hasAdoptedCoord(point)) {
    if (picked) {
      adoptDraft.mode = 'reading'
      adoptDraft.readingId = picked.id
      adoptDraft.coord = { longitude: picked.longitude, latitude: picked.latitude, altitude: picked.altitude }
    } else {
      adoptDraft.mode = 'manual'
      adoptDraft.readingId = ''
      adoptDraft.coord = { longitude: 116.4, latitude: 39.9, altitude: 800 }
    }
  } else {
    adoptDraft.mode = point.adoptedFrom === 'manual' ? 'manual' : 'reading'
    adoptDraft.readingId = point.adoptedFrom === 'manual' ? '' : (point.adoptedFrom ?? '')
    adoptDraft.coord = {
      longitude: point.adoptedLongitude as number,
      latitude: point.adoptedLatitude as number,
      altitude: point.adoptedAltitude ?? 0
    }
  }
}

/** 切换采用读数时把坐标带入表单 */
function syncAdoptCoord(): void {
  const reading = readingState.readings.find((item) => item.id === adoptDraft.readingId)
  if (reading) {
    adoptDraft.coord = { longitude: reading.longitude, latitude: reading.latitude, altitude: reading.altitude }
  }
}

async function submitAdopt(): Promise<void> {
  const point = adoptPoint.value
  if (!point) {
    ElMessage.warning('请选择采集点')
    return
  }
  if (adoptDraft.mode === 'reading' && !adoptDraft.readingId) {
    ElMessage.warning('请选择要采用的读数')
    return
  }
  const err = coordError(adoptDraft.coord.longitude, adoptDraft.coord.latitude)
  if (err) {
    ElMessage.warning(err)
    return
  }
  try {
    await pointStore.getState().adopt(point.id, {
      longitude: adoptDraft.coord.longitude,
      latitude: adoptDraft.coord.latitude,
      altitude: adoptDraft.coord.altitude,
      from: adoptDraft.mode === 'reading' ? adoptDraft.readingId : 'manual',
      siteNote: adoptDraft.siteNote.trim()
    })
    ElMessage.success(`「${point.name}」采用坐标已保存，统计按此坐标计算`)
  } catch {
    ElMessage.error('采用坐标保存失败，整理组侧已自动重试一次仍未成功，请稍后再试')
  }
}

/* ---------- 坐标裁定：两边对不齐的采集点 ---------- */

interface Adjudication {
  point: CollectPoint
  readings: CoordReading[]
  spread: number
  reasons: string[]
}

const adjudications = computed<Adjudication[]>(() =>
  pointState.points
    .map((point) => {
      const readings = readingsOf(point.id)
      const spread = readingsSpreadMeters(readings)
      const reasons: string[] = []
      if (!hasAdoptedCoord(point) && readings.length > 0) reasons.push('待采用')
      if (point.pendingReadopt && hasAdoptedCoord(point)) reasons.push('待重新采用')
      if (readings.length >= 2 && spread > READING_DISAGREE_M) reasons.push('读数不一致')
      return { point, readings, spread, reasons }
    })
    .filter((row) => row.reasons.length > 0)
)

function adoptFromReading(reading: CoordReading): void {
  prepareAdopt(reading.pointId, reading.id)
  ElMessage.info(`已带入整理组采用表单：${pointName(reading.pointId)} · ${reading.source}，确认后保存`)
}

/* ---------- 统计：只认采用坐标，待重新采用单列 ---------- */

const adoptedPoints = computed(() => pointState.points.filter(hasAdoptedCoord))
const pendingPoints = computed(() => adoptedPoints.value.filter((item) => item.pendingReadopt))

const coordStats = computed(() => {
  const list = adoptedPoints.value
  const lngs = list.map((item) => item.adoptedLongitude as number)
  const lats = list.map((item) => item.adoptedLatitude as number)
  const alts = list.map((item) => item.adoptedAltitude).filter((value): value is number => value !== null)
  const range = (values: number[]): string =>
    values.length > 0 ? `${Math.min(...values).toFixed(4)} ~ ${Math.max(...values).toFixed(4)}` : '—'
  return {
    adopted: list.length,
    pending: pendingPoints.value.length,
    unadopted: pointState.points.length - list.length,
    avgAltitude: alts.length > 0 ? `${Math.round(alts.reduce((sum, v) => sum + v, 0) / alts.length)} m` : '—',
    lngRange: range(lngs),
    latRange: range(lats)
  }
})

/* ---------- 清单与通用 ---------- */

function readingsOf(pointId: string): CoordReading[] {
  return readingState.readings.filter((item) => item.pointId === pointId)
}

function pointName(pointId: string): string {
  return pointState.points.find((item) => item.id === pointId)?.name ?? '（采集点已删除）'
}

function recordsOf(pointId: string): number {
  return recordState.records.filter((record) => record.pointId === pointId).length
}

/** 主要基物：该采集点下条目最常见的基物（采集点自身基物优先） */
function mainSubstrate(point: CollectPoint): string {
  const list = recordState.records.filter((record) => record.pointId === point.id)
  if (list.length === 0) return point.substrate
  return point.substrate
}

function statusTagType(point: CollectPoint): 'success' | 'warning' | 'info' {
  const status = pointCoordStatus(point)
  if (status === '已采用') return 'success'
  if (status === '待重新采用') return 'warning'
  return 'info'
}

async function removeReading(reading: CoordReading): Promise<void> {
  await ElMessageBox.confirm(
    `确认删除「${pointName(reading.pointId)}」的${reading.source}（${reading.reader || '未署名'}）？`,
    '删除确认',
    { type: 'warning' }
  )
  await readingStore.getState().remove(reading.id)
  ElMessage.success('读数已删除')
}

async function remove(point: CollectPoint): Promise<void> {
  const count = recordsOf(point.id)
  if (count > 0) {
    ElMessage.error(`「${point.name}」下仍有 ${count} 条菌物条目，请先清理条目`)
    return
  }
  await ElMessageBox.confirm(`确认删除采集点「${point.name}」？其全部坐标读数将一并删除。`, '删除确认', {
    type: 'warning'
  })
  await readingStore.getState().removeByPoint(point.id)
  await pointStore.getState().remove(point.id)
  ElMessage.success('采集点已删除')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">采集点管理</h2>
        <p class="page-sub">
          坐标两边分管：野外组按来源保存原始读数（定位仪读数 / 地图描点 / 向导口述），整理组维护采用坐标与点位说明；
          统计只认采用坐标，待重新采用的点单列。
        </p>
      </div>
      <el-button @click="resetDraft">清空表单</el-button>
    </div>

    <el-card shadow="never" class="form-card">
      <template #header>{{ editingId ? '编辑采集点基本信息' : '新增采集点' }}</template>
      <PointBaseForm v-model="draft" with-meta />
      <div class="actions">
        <el-button type="primary" @click="submit">{{ editingId ? '保存基本信息' : '新增采集点' }}</el-button>
        <span class="muted">坐标不在此处填写：由野外组登记读数、整理组采用。</span>
      </div>
    </el-card>

    <div class="two-col">
      <el-card shadow="never" class="form-card">
        <template #header>野外组 · 坐标读数登记</template>
        <div class="side-form">
          <label class="cell">
            <span class="lab">采集点</span>
            <el-select v-model="readingDraft.pointId" filterable placeholder="选择采集点" style="width: 100%">
              <el-option v-for="point in pointState.points" :key="point.id" :label="point.name" :value="point.id" />
            </el-select>
          </label>
          <label class="cell">
            <span class="lab">读数来源</span>
            <el-select v-model="readingDraft.source" style="width: 100%">
              <el-option v-for="source in COORD_SOURCES" :key="source" :label="source" :value="source" />
            </el-select>
          </label>
          <CoordInput v-model="readingDraft.coord" />
          <div class="meta-grid">
            <label class="cell">
              <span class="lab">读数人</span>
              <el-input v-model="readingDraft.reader" placeholder="如 沈禾" />
            </label>
            <label class="cell">
              <span class="lab">读数日期</span>
              <el-date-picker v-model="readingDraft.readAt" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </label>
          </div>
          <label class="cell">
            <span class="lab">备注</span>
            <el-input v-model="readingDraft.note" type="textarea" :rows="2" placeholder="如 定位仪定点，信号稳定" />
          </label>
          <div class="actions">
            <el-button type="primary" @click="submitReading">补录读数</el-button>
            <span class="muted">只新增本来源读数，不覆盖其他来源，也不动采用坐标与点位说明。</span>
          </div>
        </div>
      </el-card>

      <el-card shadow="never" class="form-card">
        <template #header>整理组 · 采用坐标与点位说明</template>
        <div class="side-form">
          <label class="cell">
            <span class="lab">采集点</span>
            <el-select
              :model-value="adoptDraft.pointId"
              filterable
              placeholder="选择采集点"
              style="width: 100%"
              @update:model-value="(value: string) => prepareAdopt(value)"
            >
              <el-option v-for="point in pointState.points" :key="point.id" :label="point.name" :value="point.id" />
            </el-select>
          </label>
          <template v-if="adoptPoint">
            <div class="cell">
              <span class="lab">采用方式</span>
              <el-radio-group v-model="adoptDraft.mode">
                <el-radio-button value="reading" :disabled="adoptReadings.length === 0">从读数采用</el-radio-button>
                <el-radio-button value="manual">手工定值</el-radio-button>
              </el-radio-group>
            </div>
            <label v-if="adoptDraft.mode === 'reading'" class="cell">
              <span class="lab">采用读数</span>
              <el-select v-model="adoptDraft.readingId" style="width: 100%" @change="syncAdoptCoord">
                <el-option
                  v-for="reading in adoptReadings"
                  :key="reading.id"
                  :label="`${reading.source} · ${reading.longitude.toFixed(4)}, ${reading.latitude.toFixed(4)}（${reading.reader || '未署名'}）`"
                  :value="reading.id"
                />
              </el-select>
            </label>
            <CoordInput v-model="adoptDraft.coord" :disabled="adoptDraft.mode === 'reading'" />
            <label class="cell">
              <span class="lab">点位说明</span>
              <el-input
                v-model="adoptDraft.siteNote"
                type="textarea"
                :rows="2"
                placeholder="如 样线起点在栎树林北侧路口，沿等高线向西约 200 m"
              />
            </label>
            <div class="actions">
              <el-button type="primary" @click="submitAdopt">保存采用坐标</el-button>
              <span class="muted">保存后清除「待重新采用」；保存失败会在整理组侧自动重试一次。</span>
            </div>
          </template>
          <el-empty v-else description="先选择采集点" :image-size="60" />
        </div>
      </el-card>
    </div>

    <h3 class="section-title">坐标裁定（待办 {{ adjudications.length }}）</h3>
    <p class="muted adjudication-tip">
      两边对不齐的采集点按点摆出来等裁定：读数两两相距超过 {{ READING_DISAGREE_M }} m 记为「读数不一致」；
      采用后野外组又补读数的记为「待重新采用」；有读数但尚未采用的记为「待采用」。
    </p>
    <el-card v-for="row in adjudications" :key="row.point.id" shadow="never" class="adjudication-card">
      <div class="adjudication-head">
        <div>
          <span class="point-name">{{ row.point.name }}</span>
          <el-tag v-for="reason in row.reasons" :key="reason" size="small" type="warning" effect="dark" class="reason-tag">
            {{ reason }}
          </el-tag>
        </div>
        <span class="muted">读数最大偏差 {{ Math.round(row.spread) }} m</span>
      </div>
      <el-table :data="row.readings" size="small" border>
        <el-table-column prop="source" label="来源" width="110" />
        <el-table-column label="经纬度" min-width="150">
          <template #default="{ row: reading }: { row: CoordReading }">
            {{ reading.longitude.toFixed(4) }}, {{ reading.latitude.toFixed(4) }}
          </template>
        </el-table-column>
        <el-table-column prop="altitude" label="海拔(m)" width="90" />
        <el-table-column label="读数人" width="110">
          <template #default="{ row: reading }: { row: CoordReading }">{{ reading.reader || '—' }}</template>
        </el-table-column>
        <el-table-column prop="readAt" label="读数日期" width="110" />
        <el-table-column label="备注" min-width="140">
          <template #default="{ row: reading }: { row: CoordReading }">{{ reading.note || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row: reading }: { row: CoordReading }">
            <el-button size="small" type="primary" plain @click="adoptFromReading(reading)">采用这条</el-button>
          </template>
        </el-table-column>
      </el-table>
      <p class="adopted-line">
        当前采用：<b>{{ adoptedCoordText(row.point) }}</b>
        <span class="muted">（{{ adoptedFromText(row.point, readingState.readings) }}）</span>
        <span v-if="row.point.siteNote" class="muted"> · 点位说明：{{ row.point.siteNote }}</span>
      </p>
    </el-card>
    <el-empty v-if="adjudications.length === 0" description="暂无待裁定的采集点" />

    <h3 class="section-title">读数记录（{{ readingState.readings.length }}）</h3>
    <el-table :data="readingState.readings" border stripe>
      <el-table-column label="采集点" min-width="150">
        <template #default="{ row }: { row: CoordReading }">{{ pointName(row.pointId) }}</template>
      </el-table-column>
      <el-table-column label="来源" width="110">
        <template #default="{ row }: { row: CoordReading }">
          <el-tag size="small" :type="row.source === '历史回填' ? 'info' : 'primary'" effect="plain">{{ row.source }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="经纬度" min-width="150">
        <template #default="{ row }: { row: CoordReading }">
          {{ row.longitude.toFixed(4) }}, {{ row.latitude.toFixed(4) }}
        </template>
      </el-table-column>
      <el-table-column prop="altitude" label="海拔(m)" width="90" />
      <el-table-column label="读数人" width="110">
        <template #default="{ row }: { row: CoordReading }">{{ row.reader || '—' }}</template>
      </el-table-column>
      <el-table-column prop="readAt" label="读数日期" width="110" />
      <el-table-column label="备注" min-width="140">
        <template #default="{ row }: { row: CoordReading }">{{ row.note || '—' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="170" fixed="right">
        <template #default="{ row }: { row: CoordReading }">
          <el-button size="small" type="primary" plain @click="adoptFromReading(row)">采用这条</el-button>
          <el-button size="small" type="danger" plain @click="removeReading(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="readingState.readings.length === 0" description="暂无读数" />

    <h3 class="section-title">统计（按采用坐标）</h3>
    <el-card shadow="never" class="form-card">
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="已采用坐标">{{ coordStats.adopted }} 个</el-descriptions-item>
        <el-descriptions-item label="待重新采用">{{ coordStats.pending }} 个</el-descriptions-item>
        <el-descriptions-item label="待采用">{{ coordStats.unadopted }} 个</el-descriptions-item>
        <el-descriptions-item label="平均海拔">{{ coordStats.avgAltitude }}</el-descriptions-item>
        <el-descriptions-item label="经度范围">{{ coordStats.lngRange }}</el-descriptions-item>
        <el-descriptions-item label="纬度范围">{{ coordStats.latRange }}</el-descriptions-item>
      </el-descriptions>
      <div v-if="pendingPoints.length > 0" class="pending-list">
        <span class="lab">待重新采用（采用坐标仍按整理组那份计入统计，待裁定后可能调整）：</span>
        <el-tag v-for="point in pendingPoints" :key="point.id" size="small" type="warning" effect="dark" class="reason-tag">
          {{ point.name }}
        </el-tag>
      </div>
    </el-card>

    <h3 class="section-title">采集点清单（{{ pointState.points.length }}）</h3>
    <div class="card-grid">
      <el-card v-for="point in pointState.points" :key="point.id" shadow="hover" class="point-card">
        <div class="point-head">
          <div>
            <div class="point-name">{{ point.name }}</div>
            <div class="muted">{{ adoptedCoordText(point) }}</div>
          </div>
          <div class="head-tags">
            <el-tag :type="statusTagType(point)" size="small" effect="dark">{{ pointCoordStatus(point) }}</el-tag>
            <el-tag effect="plain" size="small">条目 {{ recordsOf(point.id) }}</el-tag>
            <el-tag effect="plain" size="small">读数 {{ readingsOf(point.id).length }}</el-tag>
          </div>
        </div>
        <el-descriptions :column="1" size="small" border class="desc">
          <el-descriptions-item label="采用来源">{{ adoptedFromText(point, readingState.readings) }}</el-descriptions-item>
          <el-descriptions-item label="点位说明">{{ point.siteNote || '—' }}</el-descriptions-item>
          <el-descriptions-item label="植被类型">{{ point.vegetation }}</el-descriptions-item>
          <el-descriptions-item label="主要基物">{{ mainSubstrate(point) }}</el-descriptions-item>
          <el-descriptions-item label="伴生树种">{{ point.companionTrees || '—' }}</el-descriptions-item>
          <el-descriptions-item label="采集日期">{{ point.collectDate }}</el-descriptions-item>
          <el-descriptions-item label="采集人">{{ point.collector || '—' }}</el-descriptions-item>
        </el-descriptions>
        <div class="point-actions">
          <el-button size="small" @click="edit(point)">编辑信息</el-button>
          <el-button size="small" type="primary" plain @click="prepareAdopt(point.id)">整理坐标</el-button>
          <el-button size="small" type="danger" plain @click="remove(point)">删除</el-button>
        </div>
      </el-card>
      <el-empty v-if="pointState.points.length === 0" description="暂无采集点" />
    </div>
  </div>
</template>

<style scoped>
.form-card {
  border-radius: 12px;
  margin-bottom: 16px;
}
.two-col {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}
.side-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
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
.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}
.adjudication-tip {
  margin: -6px 0 12px;
}
.adjudication-card {
  border-radius: 12px;
  margin-bottom: 12px;
}
.adjudication-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.reason-tag {
  margin-left: 8px;
}
.adopted-line {
  margin: 10px 0 0;
  font-size: 13px;
}
.pending-list {
  margin-top: 10px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.point-card {
  border-radius: 12px;
}
.point-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 10px;
}
.point-name {
  font-size: 15px;
  font-weight: 600;
}
.head-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.desc {
  margin-bottom: 10px;
}
.point-actions {
  display: flex;
  gap: 8px;
}
</style>
