import type { Hupu, Json } from "./hupu"

const endpoint = "https://games.mobileapi.hupu.com/1/8.0.32/basketballapi/"
export type PlayerBio = { name: string; avatar: string; team: string; position: string; height: string; weight: string; draft: string }
export type PlayerMetric = { title: string; value: string; rank?: number }
export type PlayerProfileData = { bio?: PlayerBio | null; season?: PlayerMetric[]; career?: PlayerMetric[] }

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
  }
}

const seasonColumns = [
  ["ptsAvg", "场均得分"], ["rebAvg", "场均篮板"], ["astAvg", "场均助攻"],
  ["fgp", "投篮命中率"], ["tpp", "三分命中率"], ["ftp", "罚球命中率"],
] as const
const careerColumns = [
  ["pts", "总得分"], ["reb", "总篮板"], ["ast", "总助攻"], ["tpm", "三分命中数"],
] as const

export async function playerNumbers(api: Hupu, playerId: string, year: number, career: boolean): Promise<PlayerMetric[]> {
  const params = { playerId, competitionLeagueType: "NBA", competitionType: "NBA" }
  const result = playerResult(await api.get(endpoint + (career ? "playerCareerStats" : "playerSeasonStats"), params), playerId)
  if (!result) return []
  if (!career && result.season !== `${year}-${year + 1}`) return []
  const basic = result.dataDimensionMap?.basic
  const rows = (career ? basic?.competitionStageTypePackListMap : basic?.competitionStagePackListMap)?.REGULAR
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
  return metrics
}
