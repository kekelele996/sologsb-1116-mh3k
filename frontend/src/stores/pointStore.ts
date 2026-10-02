import { createStore } from 'zustand/vanilla'
import type { CollectPoint, FieldReading } from '@/types'
import { db, retryPut, syncAll, syncDelete } from '@/hooks/usePersistentStore'
import { addReading as appendReading, adoptReading as adoptFromReading } from '@/utils/point'

export interface PointState {
  points: CollectPoint[]
  loaded: boolean
  hydrate: () => Promise<void>
  /** 整理组保存（采用坐标 + 点位说明），失败按本侧重试 */
  save: (point: CollectPoint) => Promise<void>
  /** 野外组补登一组读数：只追加读数、标记待重新采用，不动采用坐标与点位说明 */
  addReading: (pointId: string, reading: Omit<FieldReading, 'id'>) => Promise<void>
  /** 整理组采用某组读数的坐标 */
  adoptReading: (pointId: string, readingId: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const pointStore = createStore<PointState>((set, get) => ({
  points: [],
  loaded: false,
  hydrate: async () => {
    const points = await syncAll<CollectPoint>(db.points)
    points.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
    set({ points, loaded: true })
  },
  save: async (point) => {
    await retryPut<CollectPoint>(db.points, point)
    await get().hydrate()
  },
  addReading: async (pointId, reading) => {
    const target = get().points.find((item) => item.id === pointId)
    if (!target) return
    const next = appendReading(target, reading)
    await retryPut<CollectPoint>(db.points, next)
    await get().hydrate()
  },
  adoptReading: async (pointId, readingId) => {
    const target = get().points.find((item) => item.id === pointId)
    if (!target) return
    const next = adoptFromReading(target, readingId)
    await retryPut<CollectPoint>(db.points, next)
    await get().hydrate()
  },
  remove: async (id) => {
    await syncDelete<CollectPoint>(db.points, id)
    await get().hydrate()
  }
}))
