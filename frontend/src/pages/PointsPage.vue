<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { CollectPoint, FieldReading } from '@/types'
import { READING_SOURCES } from '@/types'
import PointTwoSides from '@/components/common/PointTwoSides.vue'
import { useStore } from '@/hooks/usePersistentStore'
import { pointStore } from '@/stores/pointStore'
import { recordStore } from '@/stores/recordStore'
import { adoptionStats, adoptStatus, adjudicationPoints, adoptedCoord, createPoint } from '@/utils/point'

const pointState = useStore(pointStore)
const recordState = useStore(recordStore)

/** 统计按采用坐标算；待重新采用的点单列 */
const stats = computed(() => adoptionStats(pointState.points))
/** 两边对不齐的点：按采集点摆出来等裁定 */
const pendingPoints = computed(() => adjudicationPoints(pointState.points))

const filter = ref<'all' | 'pending' | 'adopted'>('all')
const filteredPoints = computed(() => {
  if (filter.value === 'pending') return pendingPoints.value
  if (filter.value === 'adopted') {
    return pointState.points.filter((point) => adoptStatus(point) === 'adopted')
  }
  return pointState.points
})

/* ---------- 编辑对话框（两边分开） ---------- */
const editingId = ref<string | null>(null)
const dialogVisible = ref(false)
const editingPoint = computed(
  () => pointState.points.find((point) => point.id === editingId.value) ?? null
)

function openEdit(point: CollectPoint): void {
  editingId.value = point.id
  dialogVisible.value = true
}

async function handleSave(point: CollectPoint): Promise<void> {
  try {
    await pointStore.getState().save(point)
    ElMessage.success('采用坐标与点位说明已保存')
  } catch {
    ElMessage.error('保存失败，已按本侧重试仍未写入，请稍后再试')
  }
}

async function handleAddReading(pointId: string, reading: Omit<FieldReading, 'id'>): Promise<void> {
  try {
    await pointStore.getState().addReading(pointId, reading)
    ElMessage.success('读数已补登，该点标记为待重新采用')
  } catch {
    ElMessage.error('读数保存失败，请重试')
  }
}

async function handleAdoptReading(pointId: string, readingId: string): Promise<void> {
  try {
    await pointStore.getState().adoptReading(pointId, readingId)
    ElMessage.success('已采用该组读数')
  } catch {
    ElMessage.error('采用失败，请重试')
  }
}

/* ---------- 新增采集点 ---------- */
const createVisible = ref(false)
const createForm = reactive({
  name: '',
  withReading: true,
  source: '定位仪' as string,
  longitude: 116.4,
  latitude: 39.9,
  altitude: 800
})

function openCreate(): void {
  createForm.name = ''
  createForm.withReading = true
  createForm.source = '定位仪'
  createForm.longitude = 116.4
  createForm.latitude = 39.9
  createForm.altitude = 800
  createVisible.value = true
}

async function submitCreate(): Promise<void> {
  if (!createForm.name.trim()) {
    ElMessage.warning('请填写采集点名称')
    return
  }
  let firstReading: Omit<FieldReading, 'id'> | undefined
  if (createForm.withReading) {
    if (createForm.longitude < -180 || createForm.longitude > 180) {
      ElMessage.warning('经度必须在 -180 ~ 180 之间')
      return
    }
    if (createForm.latitude < -90 || createForm.latitude > 90) {
      ElMessage.warning('纬度必须在 -90 ~ 90 之间')
      return
    }
    firstReading = {
      source: createForm.source,
      longitude: Number(createForm.longitude) || 0,
      latitude: Number(createForm.latitude) || 0,
      altitude: Number(createForm.altitude) || 0,
      recordedAt: new Date().toISOString().slice(0, 10),
      note: '建点时首组读数'
    }
  }
  const point = createPoint(createForm.name, firstReading)
  try {
    await pointStore.getState().save(point)
    ElMessage.success('采集点已建立')
    createVisible.value = false
  } catch {
    ElMessage.error('保存失败，请重试')
  }
}

function recordsOf(pointId: string): number {
  return recordState.records.filter((record) => record.pointId === pointId).length
}

async function remove(point: CollectPoint): Promise<void> {
  const count = recordsOf(point.id)
  if (count > 0) {
    ElMessage.error(`「${point.name}」下仍有 ${count} 条菌物条目，请先清理条目`)
    return
  }
  await ElMessageBox.confirm(`确认删除采集点「${point.name}」？`, '删除确认', { type: 'warning' })
  await pointStore.getState().remove(point.id)
  ElMessage.success('采集点已删除')
}

function statusTag(point: CollectPoint): { label: string; type: 'success' | 'warning' | 'info' } {
  const status = adoptStatus(point)
  if (status === 'adopted') return { label: '已采用', type: 'success' }
  if (status === 'pending') return { label: '待重新采用', type: 'warning' }
  return { label: '未采用', type: 'info' }
}

function coordText(point: CollectPoint): string {
  const coord = adoptedCoord(point)
  return coord
    ? `${coord.longitude.toFixed(4)}, ${coord.latitude.toFixed(4)} · ${coord.altitude} m`
    : '未采用坐标'
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">采集点管理</h2>
        <p class="page-sub">
          野外组保存各来源原始读数，整理组管采用坐标与点位说明；统计按采用坐标算，待重新采用的点单列。
        </p>
      </div>
      <el-button type="primary" @click="openCreate">新增采集点</el-button>
    </div>

    <div class="stats-strip">
      <div class="stat"><b>{{ stats.total }}</b><span>采集点</span></div>
      <div class="stat"><b>{{ stats.adopted }}</b><span>已采用</span></div>
      <div class="stat"><b>{{ stats.pending }}</b><span>待重新采用</span></div>
      <div class="stat"><b>{{ stats.unadopted }}</b><span>未采用</span></div>
    </div>

    <template v-if="pendingPoints.length">
      <h3 class="section-title">待裁定（两边对不齐，按采集点摆出）</h3>
      <div class="adjudication-list">
        <el-card v-for="point in pendingPoints" :key="point.id" shadow="never" class="adj-card">
          <template #header>
            <div class="adj-head">
              <span class="point-name">{{ point.name }}</span>
              <el-tag :type="statusTag(point).type" size="small" effect="dark">
                {{ statusTag(point).label }}
              </el-tag>
            </div>
          </template>
          <PointTwoSides
            :point="point"
            @save="handleSave"
            @add-reading="handleAddReading"
            @adopt-reading="handleAdoptReading"
          />
        </el-card>
      </div>
    </template>

    <div class="list-head">
      <h3 class="section-title">全部采集点（{{ filteredPoints.length }}）</h3>
      <el-radio-group v-model="filter" size="small">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="pending">待裁定</el-radio-button>
        <el-radio-button value="adopted">已采用</el-radio-button>
      </el-radio-group>
    </div>

    <div class="card-grid">
      <el-card v-for="point in filteredPoints" :key="point.id" shadow="hover" class="point-card">
        <div class="point-head">
          <div>
            <div class="point-name">{{ point.name }}</div>
            <div class="muted">{{ coordText(point) }}</div>
          </div>
          <el-tag :type="statusTag(point).type" size="small" effect="plain">
            {{ statusTag(point).label }}
          </el-tag>
        </div>
        <el-descriptions :column="1" size="small" border class="desc">
          <el-descriptions-item label="植被类型">{{ point.vegetation }}</el-descriptions-item>
          <el-descriptions-item label="基物">{{ point.substrate }}</el-descriptions-item>
          <el-descriptions-item label="伴生树种">{{ point.companionTrees || '—' }}</el-descriptions-item>
          <el-descriptions-item label="点位说明">{{ point.locationNote || '—' }}</el-descriptions-item>
          <el-descriptions-item label="读数">{{ point.readings.length }} 组</el-descriptions-item>
        </el-descriptions>
        <div class="point-actions">
          <el-button size="small" @click="openEdit(point)">编辑</el-button>
          <el-button size="small" type="danger" plain @click="remove(point)">删除</el-button>
        </div>
      </el-card>
      <el-empty v-if="filteredPoints.length === 0" description="暂无采集点" />
    </div>

    <el-dialog v-model="dialogVisible" title="编辑采集点（野外读数与整理采用两边分开）" width="960px" top="5vh">
      <PointTwoSides
        v-if="editingPoint"
        :point="editingPoint"
        @save="handleSave"
        @add-reading="handleAddReading"
        @adopt-reading="handleAdoptReading"
      />
    </el-dialog>

    <el-dialog v-model="createVisible" title="新增采集点" width="520px">
      <el-form label-width="92px">
        <el-form-item label="名称" required>
          <el-input v-model="createForm.name" placeholder="如 百花山栎树林样线" />
        </el-form-item>
        <el-form-item label="首组读数">
          <el-switch v-model="createForm.withReading" />
          <span class="muted switch-hint">建点时补登一组野外读数</span>
        </el-form-item>
        <template v-if="createForm.withReading">
          <el-form-item label="来源">
            <el-select v-model="createForm.source" style="width: 100%">
              <el-option v-for="item in READING_SOURCES" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="经度">
            <el-input-number
              v-model="createForm.longitude"
              :precision="4"
              :step="0.0001"
              :controls="false"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="纬度">
            <el-input-number
              v-model="createForm.latitude"
              :precision="4"
              :step="0.0001"
              :controls="false"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="海拔(m)">
            <el-input-number v-model="createForm.altitude" :controls="false" style="width: 100%" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">建立</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.stats-strip {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.stat {
  flex: 1 1 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #e8e2d6;
}
.stat b {
  font-size: 22px;
  color: #3b2a1d;
}
.stat span {
  font-size: 12px;
  color: #7f8d82;
}
.section-title {
  margin: 18px 0 10px;
  font-size: 15px;
  font-weight: 600;
  color: #3b2a1d;
}
.adjudication-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.adj-card {
  border-radius: 12px;
  border-color: #e6c39a;
}
.adj-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 18px;
}
.list-head .section-title {
  margin: 0;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
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
.desc {
  margin-bottom: 10px;
}
.point-actions {
  display: flex;
  gap: 8px;
}
.switch-hint {
  margin-left: 8px;
  font-size: 12px;
}
</style>
