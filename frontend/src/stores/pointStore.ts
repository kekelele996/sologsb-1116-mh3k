import { createStore } from 'zustand/vanilla'
import type { CollectPoint } from '@/types'
import { db, syncAll, syncDelete, syncPut } from '@/hooks/usePersistentStore'

/** 整理组采用结果：采用坐标 + 采用来源 + 点位说明 */
export interface PointAdoption {
  longitude: number
  latitude: number
  altitude: number
  /** 采用来源：读数 id，或 'manual' 表示整理组手工定值 */
  from: string
  siteNote: string
}

export interface PointState {
  points: CollectPoint[]
  loaded: boolean
  hydrate: () => Promise<void>
  save: (point: CollectPoint) => Promise<void>
  /** 整理组落采用坐标与点位说明：只写本侧字段并清除「待重新采用」，保存失败按本侧重试一次 */
  adopt: (pointId: string, adoption: PointAdoption) => Promise<void>
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
    await syncPut<CollectPoint>(db.points, point)
    await get().hydrate()
  },
  adopt: async (pointId, adoption) => {
    const point = get().points.find((item) => item.id === pointId)
    if (!point) throw new Error(`采集点不存在：${pointId}`)
    const next: CollectPoint = {
      ...point,
      adoptedLongitude: adoption.longitude,
      adoptedLatitude: adoption.latitude,
      adoptedAltitude: adoption.altitude,
      adoptedFrom: adoption.from,
      siteNote: adoption.siteNote,
      pendingReadopt: false
    }
    try {
      await syncPut<CollectPoint>(db.points, next)
    } catch {
      // 整理组侧保存失败：按本侧重试一次，仍失败则抛给页面提示
      await syncPut<CollectPoint>(db.points, next)
    }
    await get().hydrate()
  },
  remove: async (id) => {
    await syncDelete<CollectPoint>(db.points, id)
    await get().hydrate()
  }
}))
