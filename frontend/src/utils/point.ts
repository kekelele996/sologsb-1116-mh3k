import type { AdoptStatus, CollectPoint, FieldReading } from '@/types'
import { uid } from '@/utils/id'

/** 读数与采用坐标的偏差阈值（度），超过视为对不齐 */
export const COORD_MISMATCH_THRESHOLD = 0.001

/** 采用坐标（整理组那份）；未采用时为 null */
export function adoptedCoord(
  point: CollectPoint
): { longitude: number; latitude: number; altitude: number } | null {
  if (point.adoptedLongitude == null || point.adoptedLatitude == null) return null
  return {
    longitude: point.adoptedLongitude,
    latitude: point.adoptedLatitude,
    altitude: point.adoptedAltitude ?? 0
  }
}

/** 采用状态：未采用 / 已采用 / 待重新采用 */
export function adoptStatus(point: CollectPoint): AdoptStatus {
  const adopted = adoptedCoord(point)
  if (!adopted) return 'unadopted'
  // 采用后野外组又补了读数 → 待重新采用（采用坐标仍照整理组那份算）
  if (point.readings.length > point.adoptedReadingsCount) return 'pending'
  return 'adopted'
}

/** 读数与采用坐标是否对不齐（经纬度偏差超过阈值） */
export function readingDiffers(
  point: CollectPoint,
  reading: FieldReading,
  threshold = COORD_MISMATCH_THRESHOLD
): boolean {
  const adopted = adoptedCoord(point)
  if (!adopted) return true
  return (
    Math.abs(reading.longitude - adopted.longitude) > threshold ||
    Math.abs(reading.latitude - adopted.latitude) > threshold
  )
}

/**
 * 是否需要摆出来等裁定：
 * 未采用 / 待重新采用 / 任一读数与采用坐标对不齐。
 */
export function needsAdjudication(point: CollectPoint): boolean {
  const status = adoptStatus(point)
  if (status !== 'adopted') return true
  return point.readings.some((reading) => readingDiffers(point, reading))
}

/** 待裁定采集点：按名称排序 */
export function adjudicationPoints(points: CollectPoint[]): CollectPoint[] {
  return points
    .filter(needsAdjudication)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
}

/** 统计口径：按采用坐标算；待重新采用的点单列 */
export function adoptionStats(points: CollectPoint[]): {
  total: number
  adopted: number
  pending: number
  unadopted: number
} {
  let adopted = 0
  let pending = 0
  let unadopted = 0
  for (const point of points) {
    const status = adoptStatus(point)
    if (status === 'adopted') adopted += 1
    else if (status === 'pending') pending += 1
    else unadopted += 1
  }
  return { total: points.length, adopted, pending, unadopted }
}

/** 由读数生成采用坐标（整理组采用某组读数） */
export function adoptReading(point: CollectPoint, readingId: string): CollectPoint {
  const reading = point.readings.find((item) => item.id === readingId)
  if (!reading) return point
  return {
    ...point,
    adoptedLongitude: reading.longitude,
    adoptedLatitude: reading.latitude,
    adoptedAltitude: reading.altitude,
    adoptedReadingsCount: point.readings.length
  }
}

/** 野外组补登一组读数：只追加读数、标记待重新采用，不动采用坐标与点位说明 */
export function addReading(point: CollectPoint, reading: Omit<FieldReading, 'id'>): CollectPoint {
  const next: FieldReading = { ...reading, id: uid('frd') }
  return { ...point, readings: [...point.readings, next] }
}

/** 新建采集点（可附带首组读数）；新建时未采用 */
export function createPoint(
  name: string,
  firstReading?: Omit<FieldReading, 'id'>
): CollectPoint {
  const today = new Date().toISOString().slice(0, 10)
  const readings: FieldReading[] = firstReading ? [{ ...firstReading, id: uid('frd') }] : []
  return {
    id: uid('pt'),
    name: name.trim(),
    vegetation: '针阔混交林',
    substrate: '落叶层',
    companionTrees: '',
    collectDate: today,
    collector: '',
    locationNote: '',
    adoptedLongitude: null,
    adoptedLatitude: null,
    adoptedAltitude: null,
    adoptedReadingsCount: 0,
    readings
  }
}
