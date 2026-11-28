import type { Json } from "./hupu"

export type Conference = "East" | "West"
export type Standing = {
  id: string; name: string; logo: string; rank: number
  wins: number; losses: number; winPercent: number; gamesBehind: number
}
export type Standings = Record<Conference, Standing[]>

const names: Record<string, string> = {
  ATL: "老鹰", BKN: "篮网", BOS: "凯尔特人", CHA: "黄蜂", CHI: "公牛", CLE: "骑士", DET: "活塞",
  IND: "步行者", MIA: "热火", MIL: "雄鹿", NY: "尼克斯", ORL: "魔术", PHI: "76人", TOR: "猛龙", WSH: "奇才",
  DAL: "独行侠", DEN: "掘金", GS: "勇士", HOU: "火箭", LAC: "快船", LAL: "湖人", MEM: "灰熊",
  MIN: "森林狼", NO: "鹈鹕", OKC: "雷霆", PHX: "太阳", POR: "开拓者", SA: "马刺", SAC: "国王", UTAH: "爵士",
}

export function parseStandings(payload: Json, seasonEnd: number): Standings {
  if (payload.season?.year !== seasonEnd || !Array.isArray(payload.children)) throw new Error("排行赛季不匹配")
  function conference(side: Conference): Standing[] {
    const entries = payload.children.find((entry: Json) => entry.abbreviation === side)?.standings?.entries
    if (!Array.isArray(entries) || entries.length !== 15) throw new Error("排行球队不完整")
    const teams = entries.map(({ team, stats }: Json): Standing => {
      const values = new Map(Array.isArray(stats) ? stats.map((stat: Json) => [stat.name, stat.value]) : [])
      function number(name: string): number {
        const value = values.get(name)
        if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("排行数据不完整")
        return value
      }
      if (!team?.id || !team.displayName) throw new Error("排行球队资料缺失")
      const logo = team.logos?.[0]?.href
      return {
        id: String(team.id), name: names[team.abbreviation] || team.displayName,
        logo: typeof logo === "string" && logo.startsWith("https://") ? logo : "",
        rank: number("playoffSeed"), wins: number("wins"), losses: number("losses"),
        winPercent: number("winPercent"), gamesBehind: number("gamesBehind"),
      }
    }).sort((a, b) => a.rank - b.rank)
    if (new Set(teams.map(team => team.id)).size !== teams.length || teams.some((team, i) => team.rank !== i + 1)) {
      throw new Error("排行位次不完整")
    }
    return teams
  }
  return { East: conference("East"), West: conference("West") }
}
