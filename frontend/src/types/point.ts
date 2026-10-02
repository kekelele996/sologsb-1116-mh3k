/** 植被类型 */
export const VEGETATIONS = ['常绿阔叶林', '针阔混交林', '针叶林', '灌丛', '草坡'] as const
export type Vegetation = (typeof VEGETATIONS)[number]

/** 基物 */
export const SUBSTRATES = ['腐木', '落叶层', '土壤', '粪生'] as const
export type Substrate = (typeof SUBSTRATES)[number]

/** 野外读数来源（野外组登记新读数时可选） */
export const COORD_SOURCES = ['定位仪读数', '地图描点', '向导口述'] as const
export type CoordSource = (typeof COORD_SOURCES)[number]

/** 升级迁移回填标记：v3 之前未分来源的历史坐标 */
export const LEGACY_COORD_SOURCE = '历史回填'

/** CoordReading 野外组坐标原始读数：各来源分开保存，改一条不冲掉其他来源 */
export interface CoordReading {
  id: string
  pointId: string
  source: CoordSource | typeof LEGACY_COORD_SOURCE
  longitude: number
  latitude: number
  altitude: number
  /** 读数人 */
  reader: string
  /** 读数日期 */
  readAt: string
  note: string
}

/** CollectPoint 采集点：整理组维护采用坐标与点位说明；野外组原始读数另存 CoordReading */
export interface CollectPoint {
  id: string
  name: string
  /** 整理组采用坐标（未采用为 null），统计只认这一份 */
  adoptedLongitude: number | null
  adoptedLatitude: number | null
  adoptedAltitude: number | null
  /** 采用来源：读数 id，或 'manual' 表示整理组手工定值 */
  adoptedFrom: string | null
  /** 点位说明（仅整理组维护，野外补读数不覆盖） */
  siteNote: string
  /** 采用坐标定下后野外组又补读数：待重新采用 */
  pendingReadopt: boolean
  vegetation: Vegetation
  substrate: Substrate
  /** 伴生树种 */
  companionTrees: string
  collectDate: string
  collector: string
}
