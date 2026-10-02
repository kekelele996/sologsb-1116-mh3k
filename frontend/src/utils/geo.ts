import type { CollectPoint, CoordReading } from '@/types'

/** 一组坐标值（野外读数与采用坐标共用的表单形状） */
export interface CoordValue {
  longitude: number
  latitude: number
  altitude: number
}

/** 读数分歧阈值（米）：同一采集点任意两条读数相距超过该值视为对不齐，摆出来等裁定 */
export const READING_DISAGREE_M = 100

/** 经纬度格式校验，返回错误信息或 null */
export function coordError(longitude: number, latitude: number): string | null {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return '经纬度必须是数字'
  if (longitude < -180 || longitude > 180) return '经度必须在 -180 ~ 180 之间'
  if (latitude < -90 || latitude > 90) return '纬度必须在 -90 ~ 90 之间'
  if (longitude === 0 && latitude === 0) return '经纬度不能同时为 0（请填写真实坐标）'
  return null
}

/** 两点间球面距离（米，haversine） */
export function distanceMeters(a: CoordValue, b: CoordValue): number {
  const rad = Math.PI / 180
  const dLat = (b.latitude - a.latitude) * rad
  const dLng = (b.longitude - a.longitude) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

/** 一组读数的最大两两距离（米），不足两条为 0 */
export function readingsSpreadMeters(readings: CoordReading[]): number {
  let max = 0
  for (let i = 0; i < readings.length; i += 1) {
    for (let j = i + 1; j < readings.length; j += 1) {
      max = Math.max(max, distanceMeters(readings[i], readings[j]))
    }
  }
  return max
}

/** 采集点是否已有整理组采用坐标 */
export function hasAdoptedCoord(point: CollectPoint): boolean {
  return point.adoptedLongitude !== null && point.adoptedLatitude !== null
}

/** 坐标状态：待采用 / 已采用 / 待重新采用 */
export type PointCoordStatus = '待采用' | '已采用' | '待重新采用'

export function pointCoordStatus(point: CollectPoint): PointCoordStatus {
  if (!hasAdoptedCoord(point)) return '待采用'
  return point.pendingReadopt ? '待重新采用' : '已采用'
}

/** 采用坐标展示文本（未采用时返回占位符） */
export function adoptedCoordText(point: CollectPoint): string {
  if (!hasAdoptedCoord(point)) return '未采用'
  const alt = point.adoptedAltitude !== null ? ` · ${point.adoptedAltitude} m` : ''
  return `${point.adoptedLongitude?.toFixed(4)}, ${point.adoptedLatitude?.toFixed(4)}${alt}`
}

/** 采用来源展示文本：读数 id 反查来源，或整理组手工定值 */
export function adoptedFromText(point: CollectPoint, readings: CoordReading[]): string {
  if (!point.adoptedFrom) return '—'
  if (point.adoptedFrom === 'manual') return '整理组手工定值'
  const reading = readings.find((item) => item.id === point.adoptedFrom)
  return reading ? `${reading.source}（${reading.reader || '未署名'} · ${reading.readAt}）` : '来源读数已删除'
}
