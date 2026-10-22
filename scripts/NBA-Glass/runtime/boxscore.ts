import type { Game, Json } from "./hupu"

export const statColumns = [
  { key: "mins", title: "时间", width: 56 }, { key: "pts", title: "得分", width: 44 },
  { key: "reb", title: "篮板", width: 44 }, { key: "asts", title: "助攻", width: 44 },
  { key: "twoPoints", title: "投篮", width: 62 }, { key: "threePoints", title: "三分", width: 62 },
  { key: "ft", title: "罚球", width: 62 }, { key: "stl", title: "抢断", width: 44 },
  { key: "blk", title: "盖帽", width: 44 }, { key: "to", title: "失误", width: 44 },
  { key: "pf", title: "犯规", width: 44 }, { key: "plusMinus", title: "+/−", width: 48 },
] as const
export type StatPlayer = { id: string; name: string; avatar: string; number: string; starter: boolean; dnp: boolean; values: Record<string, string> }
export type BoxScore = { matchId: string; teams: { id: string; players: StatPlayer[]; totals: Record<string, string>; totalsLabel: string }[] }
function display(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return typeof value === "string" && value.trim() ? value.trim() : "—"
}
export function parseBoxScore(payload: Json, game: Game): BoxScore | null {
  if (payload.success === false) throw new Error("统计请求失败")
  const data = payload.result
  if (!data) throw new Error("统计响应缺失")
  if (String(data.matchId) !== game.id) throw new Error("技术统计不是本场比赛")
  const ids = [String(data.homeTeamId), String(data.awayTeamId)]
  if (ids.slice().sort().join() !== game.teams.map(t => t.id).sort().join()) throw new Error("统计球队不匹配")
  const teams = ids.map((teamId, index) => {
    const rows = data[index === 0 ? "homePlayers" : "awayPlayers"]
    if (!Array.isArray(rows)) throw new Error("球员统计结构变化")
    const seen = new Set<string>()
    for (const raw of rows) {
      if (String(raw.matchId) !== game.id || String(raw.teamId) !== teamId) throw new Error("球员统计归属错误")
    }
    const aggregate = rows.find((raw: Json) => raw.playerId === `${teamId}-team-stats`)
    const players: StatPlayer[] = rows.filter((raw: Json) => raw.playerId !== `${teamId}-team-stats` && raw.playerId !== `${teamId}-team-shooting`).map((raw: Json) => {
      if (String(raw.matchId) !== game.id || String(raw.teamId) !== teamId) throw new Error("球员统计归属错误")
      if (typeof raw.playerId !== "string" || !/^\d+$/.test(raw.playerId) || seen.has(raw.playerId)) throw new Error("球员统计 ID 缺失或重复")
      seen.add(raw.playerId)
      const values = Object.fromEntries(statColumns.map(col => [col.key, display(raw[col.key])]))
      const dnp = raw.dnp === 1 || raw.dnp === "1"
      return { id: raw.playerId, name: String(raw.alias || raw.name || "球员"), avatar: String(raw.logoUrl || raw.photo || "").replace(/^http:\/\//, "https://"), number: display(raw.number), starter: raw.starter === 1 || raw.starter === "1", dnp, values }
    })
    const played = players.filter(player => !player.dnp)
    const totals: Record<string, string> = {}
    for (const col of statColumns) {
      if (!played.length || col.key === "mins" || col.key === "plusMinus") { totals[col.key] = "—"; continue }
      const values = played.map(player => player.values[col.key])
      if (["twoPoints", "threePoints", "ft"].includes(col.key)) {
        const pairs = values.map(value => /^(\d+)[-\/](\d+)$/.exec(value))
        totals[col.key] = pairs.every(Boolean) ? `${pairs.reduce((n, pair) => n + Number(pair![1]), 0)}/${pairs.reduce((n, pair) => n + Number(pair![2]), 0)}` : "—"
      } else totals[col.key] = values.every(value => /^\d+$/.test(value)) ? String(values.reduce((n, value) => n + Number(value), 0)) : "—"
    }
    if (aggregate) for (const column of statColumns) totals[column.key] = display(aggregate[column.key])
    return { id: teamId, players, totals, totalsLabel: aggregate ? "球队总计" : "球员合计" }
  })
  return teams.every(team => !team.players.length) ? null : { matchId: game.id, teams }
}
