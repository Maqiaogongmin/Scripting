import type { Hupu, Json } from "./hupu"

const endpoint = "https://games.mobileapi.hupu.com/1/8.0.32/basketballapi/"
export type PlayerBio = {
  name: string; avatar: string; team: string; position: string; height: string; weight: string; draft: string
  age?: string; birthday?: string; country?: string; school?: string; number?: string; englishName?: string
}
export type PlayerMetric = { title: string; value: string; rank?: number; group?: "advanced" | "highs" }
export type PlayerTrend = { label: string; detail: string; pts: number; reb: number; ast: number }
export type PlayerProfileData = {
  bio?: PlayerBio | null; season?: PlayerMetric[]; career?: PlayerMetric[]; recent?: PlayerTrend[]; history?: PlayerTrend[]
}

function playerResult(payload: Json, playerId: string): Json | null {
  const result = payload.result
  if (result == null) return null
  if (String(result.playerId) !== playerId) throw new Error("球员资料归属不匹配")
  return result
}

export async function playerBio(api: Hupu, playerId: string): Promise<PlayerBio | null> {
  const player = playerResult(await api.get(endpoint + "playerInfo", { playerId, leagueType: "NBA" }), playerId)
  if (!player) return null
  const height = Number(player.height)
  const weight = Number(player.weight)
  const draft = [player.draft_year, player.draftRound, player.draftPick].every(value => Number(value) > 0)
    ? `${player.draft_year} 年第 ${player.draftRound} 轮第 ${player.draftPick} 顺位`
    : "—"
  return {
    name: player.name || "", avatar: String(player.big_photo || player.photo || "").replace(/^http:\/\//, "https://"),
    team: player.teamName || "", position: player.position || "",
    height: height > 0 ? `${Math.round(height * 100)} cm` : "—", weight: weight > 0 ? `${weight} kg` : "—", draft,
    age: player.age ? `${player.age} 岁` : undefined, birthday: player.birth_date || undefined,
    country: player.country || undefined, school: player.college_school || player.high_school || undefined,
    number: player.number == null ? undefined : String(player.number), englishName: player.eng_name || undefined,
  }
}

const seasonColumns = [
  ["ptsAvg", "场均得分"], ["rebAvg", "场均篮板"], ["astAvg", "场均助攻"],
  ["fgp", "投篮命中率"], ["tpp", "三分命中率"], ["ftp", "罚球命中率"],
  ["minAvg", "场均时间（分钟）"], ["stlAvg", "场均抢断"], ["blkAvg", "场均盖帽"],
  ["toAvg", "场均失误"], ["orebAvg", "场均前场篮板"], ["drebAvg", "场均后场篮板"],
  ["tpmAvg", "场均三分命中"], ["plusMinusAvg", "场均正负值"], ["pfAvg", "场均犯规"],
  ["dd", "两双"], ["td", "三双"],
  ["tpm", "三分总命中数"], ["ptsOffTovAvg", "场均利用失误得分"], ["ptsInPaintsAvg", "场均内线得分"],
  ["fgpInPaints", "内线命中率"], ["ptsSecondChanceAvg", "场均二次进攻得分"], ["fgpSecondChance", "二次进攻命中率"],
  ["ptsFastBreakAvg", "场均快攻得分"], ["fgpFastBreak", "快攻命中率"], ["seasonHigh", "赛季最高分"],
  ["foulout", "犯满离场"], ["ejections", "驱逐出场"], ["tf", "技术犯规"], ["ff", "恶意犯规"],
] as const
const careerColumns = [
  ["pts", "总得分"], ["reb", "总篮板"], ["ast", "总助攻"], ["tpm", "三分命中数"],
  ["games", "出场数"], ["min", "总时间（分钟）"], ["stl", "总抢断"], ["blk", "总盖帽"],
  ["to", "总失误"], ["oreb", "总前场篮板"], ["dreb", "总后场篮板"],
  ["fgm", "投篮命中数"], ["ftm", "罚球命中数"], ["dd", "两双"], ["td", "三双"],
  ["pf", "总犯规"], ["fga", "投篮出手数"], ["noFgm", "投篮未中数"], ["tpa", "三分出手数"],
  ["noTpa", "三分未中数"], ["fta", "罚球出手数"], ["noFtm", "罚球未中数"], ["fiftyPlus", "单场50+次数"],
] as const
const advancedColumns = [
  ["ortg", "进攻效率"], ["drtg", "防守效率"], ["nrtg", "净效率"],
  ["tsp", "真实命中率"], ["efgp", "有效命中率"], ["usgp", "回合占有率"],
  ["astp", "助攻率"], ["astTo", "助攻失误比"], ["pie", "比赛贡献值"],
  ["astRatio", "助攻比率"], ["orebp", "前场篮板率"], ["drebp", "后场篮板率"],
  ["rebp", "篮板率"], ["pace", "回合数"],
] as const
const highColumns = [
  ["maxPts", "单场得分"], ["maxReb", "单场篮板"], ["maxAsts", "单场助攻"],
  ["maxStl", "单场抢断"], ["maxBlk", "单场盖帽"], ["maxTpm", "单场三分命中"],
  ["maxOreb", "单场前场篮板"], ["maxDreb", "单场后场篮板"], ["maxFga", "单场投篮出手"],
  ["maxFgm", "单场投篮命中"], ["maxTpa", "单场三分出手"], ["maxFta", "单场罚球出手"],
  ["maxFtm", "单场罚球命中"], ["maxPf", "单场犯规"], ["maxTo", "单场失误"],
] as const
const nba = { competitionLeagueType: "NBA", competitionType: "NBA" } as const

export async function playerNumbers(api: Hupu, playerId: string, year: number, career: boolean): Promise<PlayerMetric[]> {
  const params = { playerId, ...nba }
  const result = playerResult(await api.get(endpoint + (career ? "playerCareerStats" : "playerSeasonStats"), params), playerId)
  if (!result) return []
  if (!career && result.season !== `${year}-${year + 1}`) return []
  const pack = career ? "competitionStageTypePackListMap" : "competitionStagePackListMap"
  const rows = result.dataDimensionMap?.basic?.[pack]?.REGULAR
  if (!Array.isArray(rows) || !rows.length) return []
  const byName = new Map(rows.map((row: Json) => [row.name, row]))
  function metric(name: string, title: string): PlayerMetric {
    const row = byName.get(name)
    const quota = row?.quota
    const value = quota == null || quota === "" || quota === "-" ? "—" : String(quota)
    return { title, value, rank: Number.isInteger(row?.rank) && row!.rank > 0 ? row!.rank : undefined }
  }
  const metrics = (career ? careerColumns : seasonColumns).map(([name, title]) => metric(name, title))
  if (career) {
    for (const [made, attempts, title] of [["fgm", "fga", "投篮命中率"], ["tpm", "tpa", "三分命中率"], ["ftm", "fta", "罚球命中率"]]) {
      const m = Number(metric(made, "").value)
      const a = Number(metric(attempts, "").value)
      metrics.push({ title, value: Number.isFinite(m) && m >= 0 && m <= a && a > 0 ? `${(100 * m / a).toFixed(1)}%` : "—" })
    }
  }
  const group = career ? "highs" : "advanced"
  const extra = result.dataDimensionMap?.[career ? "max" : "advanced"]?.[pack]?.REGULAR
  if (Array.isArray(extra)) {
    const titles = new Map<string, string>(career ? highColumns : advancedColumns)
    for (const row of extra) {
      const title = titles.get(row.name)
      if (!title) continue
      byName.set(row.name, row)
      metrics.push({ ...metric(row.name, title), group })
    }
  }
  return metrics
}

function tableRows(table: Json | undefined): Record<string, string>[] {
  if (!Array.isArray(table?.tableHeaderFieldList) || !Array.isArray(table.statsRowList)) return []
  const fields = table.tableHeaderFieldList.map((field: Json) => field.navigationPath)
  return table.statsRowList.flatMap((row: Json) => Array.isArray(row.quotaList)
    ? [Object.fromEntries(fields.map((field, i) => [field, String(row.quotaList[i] ?? "")]))] : [])
}
function number(value?: string): number {
  return value?.trim() ? Number(value) : NaN
}

export async function recentPlayerGames(api: Hupu, playerId: string, year: number): Promise<PlayerTrend[]> {
  const season = `${year}-${year + 1}`
  const result = playerResult(await api.get(endpoint + "playerAllMatchStats", { playerId, season, ...nba }), playerId)
  if (result?.season !== season || !Array.isArray(result.statsClassifyList)) return []
  const table = result.statsClassifyList.find((item: Json) => item.classify === "REGULAR")
  return tableRows(table).filter(row => number(row.preciseMins) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.matchTime))
    .sort((a, b) => a.matchTime.localeCompare(b.matchTime))
    .map(row => ({ label: row.matchTime.slice(5), detail: row.opponentTeamName, pts: number(row["model.pts"]), reb: number(row["model.reb"]), ast: number(row["model.asts"]) }))
    .filter(row => [row.pts, row.reb, row.ast].every(Number.isFinite))
    .slice(-10)
}

export async function careerPlayerSeasons(api: Hupu, playerId: string): Promise<PlayerTrend[]> {
  const result = playerResult(await api.get(endpoint + "playerAllSeasonStats", { playerId, ...nba }), playerId)
  const table = result?.competitionStageMap?.REGULAR?.statsClassifyMap?.SUM
  const totals = new Map<string, { games: number; pts: number; reb: number; ast: number }>()
  for (const row of tableRows(table)) {
    const season = row.seasonWrapper
    if (!/^\d{2}-\d{2}$/.test(season)) continue
    const games = number(row.gamesPack?.split("/").at(-1))
    const pts = number(row["model.basic.pts"]), reb = number(row["model.basic.reb"]), ast = number(row["model.basic.ast"])
    if (games <= 0 || ![games, pts, reb, ast].every(Number.isFinite)) continue
    const current = totals.get(season) ?? { games: 0, pts: 0, reb: 0, ast: 0 }
    totals.set(season, { games: current.games + games, pts: current.pts + pts, reb: current.reb + reb, ast: current.ast + ast })
  }
  // The source orders seasons from newest to oldest and supplies one row per team stint.
  return [...totals].reverse().map(([label, row]) => ({
    label, detail: `${row.games} 场`, pts: row.pts / row.games, reb: row.reb / row.games, ast: row.ast / row.games,
  }))
}
