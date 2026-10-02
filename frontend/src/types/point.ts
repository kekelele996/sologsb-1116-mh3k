/** 植被类型 */
export const VEGETATIONS = ['常绿阔叶林', '针阔混交林', '针叶林', '灌丛', '草坡'] as const
export type Vegetation = (typeof VEGETATIONS)[number]

/** 基物 */
export const SUBSTRATES = ['腐木', '落叶层', '土壤', '粪生'] as const
export type Substrate = (typeof SUBSTRATES)[number]

/** 野外读数来源（野外组用定位仪读、队员照地图描、向导按地形说） */
export const READING_SOURCES = ['定位仪', '地图', '向导', '历史回填'] as const
export type ReadingSource = (typeof READING_SOURCES)[number]

/** 采用状态：未采用 / 已采用 / 待重新采用 */
export type AdoptStatus = 'unadopted' | 'adopted' | 'pending'

/** 野外组原始读数（各来源各一条，追加式，只增不改） */
export interface FieldReading {
  id: string
  /** 来源：定位仪 / 地图 / 向导 / 历史回填 */
  source: string
  longitude: number
  latitude: number
  altitude: number
  /** 读数日期（YYYY-MM-DD） */
  recordedAt: string
  /** 备注（如 信号弱、阴天） */
  note: string
}

/** CollectPoint 采集点：野外组读数 与 整理组采用坐标/点位说明 两边分开 */
export interface CollectPoint {
  id: string
  name: string
  // —— 整理组管：点位说明 ——
  vegetation: Vegetation
  substrate: Substrate
  companionTrees: string
  collectDate: string
  collector: string
  /** 点位说明（整理组维护的补充描述，野外补读数不冲掉它） */
  locationNote: string
  // —— 整理组管：采用坐标 ——
  adoptedLongitude: number | null
  adoptedLatitude: number | null
  adoptedAltitude: number | null
  /** 采用时的读数条数（高水位标记；此后野外再补读数即待重新采用） */
  adoptedReadingsCount: number
  // —— 野外组管：各来源原始读数 ——
  readings: FieldReading[]
}
