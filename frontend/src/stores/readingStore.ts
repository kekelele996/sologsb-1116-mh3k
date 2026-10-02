import { createStore } from 'zustand/vanilla'
import type { CoordReading } from '@/types'
import { db, syncAll, syncDelete, syncPut } from '@/hooks/usePersistentStore'
import { pointStore } from '@/stores/pointStore'

export interface ReadingState {
  readings: CoordReading[]
  loaded: boolean
  hydrate: () => Promise<void>
  /**
   * 野外组补录读数：只新增本侧读数，不动采用坐标与点位说明；
   * 若整理组已定采用坐标，把该点标为「待重新采用」。
   */
  add: (reading: CoordReading) => Promise<void>
  remove: (id: string) => Promise<void>
  /** 删除采集点时级联清理其全部读数 */
  removeByPoint: (pointId: string) => Promise<void>
}

export const readingStore = createStore<ReadingState>((set, get) => ({
  readings: [],
  loaded: false,
  hydrate: async () => {
    const readings = await syncAll<CoordReading>(db.readings)
    readings.sort((a, b) => a.readAt.localeCompare(b.readAt) || a.source.localeCompare(b.source, 'zh-Hans-CN'))
    set({ readings, loaded: true })
  },
  add: async (reading) => {
    await syncPut<CoordReading>(db.readings, reading)
    const point = pointStore.getState().points.find((item) => item.id === reading.pointId)
    const adopted = point && point.adoptedLongitude !== null && point.adoptedLatitude !== null
    if (point && adopted && !point.pendingReadopt) {
      await pointStore.getState().save({ ...point, pendingReadopt: true })
    }
    await get().hydrate()
  },
  remove: async (id) => {
    await syncDelete<CoordReading>(db.readings, id)
    await get().hydrate()
  },
  removeByPoint: async (pointId) => {
    await db.readings.where('pointId').equals(pointId).delete()
    await get().hydrate()
  }
}))
