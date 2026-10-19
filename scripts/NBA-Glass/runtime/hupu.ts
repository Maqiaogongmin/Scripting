/** Original, read-only Hupu adapter. Endpoint provenance: docs/数据接入验证.md. */
export type Json = Record<string, any>
export type Transport = (url: string) => Promise<Json>
export type BizKey = { outBizType: string; outBizNo: string }
export type Team = { id: string; name: string; logo: string; score: number | null }
export type Game = {
  id: string; time: number; date: string; phase: string; status: string
  statusText: string; teams: Team[]; ratingKey: BizKey | null; itemKey: BizKey | null
}
export type Player = {
  id: string; key: BizKey; name: string; teamId: string; avatar: string
  rating: number | null; raters: number; commentCount: number; stats: string
  hotComments: Comment[]
}
export type Comment = { id: string; subjectId: string; user: string; text: string; likes: number; date: string }
export type Board = { matchId: string; season: string; title: string; homeTeamId: string; awayTeamId: string; players: Player[] }
export type Season = { season: string; games: Game[]; teams: Team[]; fetchedAt: number; reciprocal: boolean }
const SCHEDULE = "https://match-api.hupu.com/1/8.2.10/matchallapi/bff/standard/getScheduleListByTagForH5"
const TREE = "https://games.mobileapi.hupu.com/1/8.0.99/bplcommentapi/bpl/score_tree/"
const COMMENTS = "https://games.mobileapi.hupu.com/1/8.0.99/bplcommentapi/bpl/comment/list/primarySingleRow"

function url(base: string, params: Record<string, string | number>): string {
  return base + "?" + Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&")
}
function id(value: unknown, label: string): string {
  if (typeof value === "string" && value.length > 0) return value
  // IDs returned as numeric values are allowed only when no precision was lost.
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value)
  throw new Error(`来源字段 ${label} 缺失或不是安全 ID`)
}
function array(value: unknown, label: string): Json[] {
  if (!Array.isArray(value)) throw new Error(`来源字段 ${label} 结构变化`)
  return value
}
function first(info: Json, key: string): any {
  const value = info[key]
  return Array.isArray(value) ? value[0] : value
}
function key(value: any): BizKey | null {
  return value?.outBizType && value?.outBizNo ? { outBizType: String(value.outBizType), outBizNo: id(value.outBizNo, "outBizNo") } : null
}
function image(value: any): string {
  if (typeof value !== "string") return ""
  return value.replace(/^http:\/\//, "https://")
}
function count(value: any): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
export function beijingDate(time: number): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(time))
  const part = (kind: string) => parts.find(p => p.type === kind)?.value
  return `${part("year")}-${part("month")}-${part("day")}`
}
export function beijingTime(time: number): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(time))
}
export function nextDays(games: Game[], now = Date.now()): { date: string; games: Game[] }[] {
  const today = beijingDate(now)
  const grouped = new Map<string, Game[]>()
  for (const game of [...games].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))) {
    if (game.date < today) continue
    if (!grouped.has(game.date)) grouped.set(game.date, [])
    grouped.get(game.date)!.push(game)
  }
  return [...grouped].slice(0, 3).map(([date, games]) => ({ date, games }))
}
export function normalizeGame(raw: Json): Game {
  const time = Number(raw.matchStartTimeStamp)
  if (!Number.isFinite(time) || time <= 0) throw new Error("比赛开赛时间缺失")
  const date = beijingDate(time)
  if (raw.matchStartDate && date !== raw.matchStartDate) throw new Error("比赛日期与北京时间不一致")
  const teams = array(raw.againstInfo?.memberInfos, "memberInfos").map(m => ({
    id: id(m.memberId, "memberId"), name: String(m.memberName ?? ""), logo: image(m.memberLogo),
    score: typeof m.memberBaseScore === "string" && /^\d+$/.test(m.memberBaseScore) ? Number(m.memberBaseScore) : null,
  }))
  if (teams.length !== 2 || teams[0].id === teams[1].id) throw new Error("比赛双方球队结构异常")
  const summary = raw.scoreItemInfo
  return { id: id(raw.matchId, "matchId"), time, date, teams,
    phase: String(raw.matchIntroduction ?? ""), status: String(raw.matchStatus ?? "UNKNOWN"),
    statusText: String(raw.matchStatusDesc ?? "状态未知"), ratingKey: key(raw.scoreItemKey),
    itemKey: summary?.scoreOutBizType && summary?.scoreOutBizNo ? { outBizType: summary.scoreOutBizType, outBizNo: id(summary.scoreOutBizNo, "scoreOutBizNo") } : null }
}
export function parseSchedule(payload: Json): Game[] {
  if (payload.success === false || !payload.result) throw new Error("虎扑赛程请求未成功")
  const games: Game[] = []
  for (const day of array(payload.result.dayGameData, "dayGameData")) {
    for (const raw of array(day.matchData, "matchData")) {
      // H5 NBA navigation includes summer league (common_match), outside this contract.
      if (raw.businessType === "basketball") games.push(normalizeGame(raw))
    }
  }
  return games
}
function parseComment(raw: Json): Comment {
  return { id: id(raw.commentId, "commentId"), subjectId: String(raw.subjectId ?? raw.commentKey?.subjectId ?? ""), user: String(raw.commentUserName ?? "虎扑用户"), text: String(raw.commentContent ?? ""), likes: count(raw.lightCount), date: String(raw.commentDate ?? "") }
}

export class Hupu {
  transport: Transport
  constructor(transport: Transport) { this.transport = transport }
  async get(base: string, params: Record<string, string | number>): Promise<Json> {
    const data = await this.transport(url(base, params))
    if (!data || data.success === false || (data.code !== undefined && data.code !== 1)) throw new Error(`虎扑请求失败：${data?.msg ?? "响应无效"}`)
    return data
  }
  async recent(): Promise<Game[]> {
    return parseSchedule(await this.get(SCHEDULE, { businessType: "common", datasource: "navigation", businessId: "nba" }))
  }
  async season(startYear: number, recent: Game[], progress?: (done: number, total: number) => void): Promise<Season> {
    const roster = new Map<string, Team>()
    for (const game of recent.filter(g => g.phase === "NBA常规赛")) for (const team of game.teams) roster.set(team.id, { ...team, score: null })
    if (roster.size !== 30) throw new Error(`NBA 球队名录不完整（${roster.size}/30），保留原有赛程`)
    const merged = new Map<string, Game>()
    const appearances = new Map<string, Set<string>>()
    let done = 0
    // Serial requests avoid a 30-request burst on mobile; cache is owned by the caller.
    for (const team of roster.values()) {
      const games = parseSchedule(await this.get(SCHEDULE, { businessType: "team", datasource: "basketball", businessId: team.id }))
        .filter(g => g.date >= `${startYear}-09-01` && g.date < `${startYear + 1}-08-01`)
      if (!games.length) throw new Error(`${team.name}赛程为空，未替换全赛季缓存`)
      for (const game of games) {
        if (!game.teams.some(t => t.id === team.id)) throw new Error("球队赛程返回了不相关比赛")
        const old = merged.get(game.id)
        if (old && (old.time !== game.time || old.teams.map(t => t.id).sort().join() !== game.teams.map(t => t.id).sort().join())) throw new Error("球队赛程的同场比赛信息不一致，请稍后重试")
        merged.set(game.id, game)
        if (!appearances.has(game.id)) appearances.set(game.id, new Set())
        appearances.get(game.id)!.add(team.id)
      }
      progress?.(++done, roster.size)
    }
    for (const game of merged.values()) {
      const expected = game.teams.filter(t => roster.has(t.id)).length
      if (appearances.get(game.id)?.size !== expected) throw new Error("双方球队赛程未能互相印证，未替换全赛季缓存")
    }
    return { season: `${startYear}-${startYear + 1}`, games: [...merged.values()].sort((a, b) => a.time - b.time), teams: [...roster.values()], fetchedAt: Date.now(), reciprocal: true }
  }
  async resolveKey(game: Game): Promise<BizKey | null> {
    if (game.ratingKey?.outBizType === "basketball_match") return game.ratingKey
    if (!game.itemKey) return null
    const data = (await this.get(TREE + "getSelfByBizKey", game.itemKey)).data
    const parent = array(data?.linkNodes, "linkNodes").find(n => n.target === "PARENT" && n.outBizKey?.outBizType === "basketball_match")
    return key(parent?.outBizKey)
  }
  async board(game: Game): Promise<Board | null> {
    const biz = await this.resolveKey(game)
    if (!biz) return null
    let self: Json | undefined
    const nodes: Json[] = []
    const ids = new Set<string>()
    let total = 0
    for (let page = 1; page <= 20; page++) {
      const data = (await this.get(TREE + "getCurAndSubNodeByBizKey", { ...biz, relation: "CHILD", page, pageSize: 50 })).data
      if (!data?.self?.node) throw new Error("评分比赛节点缺失")
      self = data.self.node
      const info = self!.infoJson ?? {}
      if (String(first(info, "matchId")) !== game.id || Number(first(info, "matchTime")) !== game.time) throw new Error("评分不是本场比赛，已拒绝展示")
      const sideIds = [String(first(info, "homeTeamId")), String(first(info, "awayTeamId"))].sort()
      if (sideIds.join() !== game.teams.map(t => t.id).sort().join()) throw new Error("评分球队不匹配")
      total = Number(data.pageResult?.totalCount)
      if (!Number.isSafeInteger(total) || total < 0) throw new Error("评分分页总量缺失")
      const rows = array(data.pageResult?.data, "评分条目")
      const before = ids.size
      for (const row of rows) {
        const node = row.node
        if (!node) throw new Error("评分条目结构变化")
        const identity = `${node.bizType}:${id(node.bizId, "评分条目 ID")}`
        if (!ids.has(identity)) { ids.add(identity); nodes.push(node) }
      }
      if (ids.size === total) break
      if (ids.size > total || ids.size === before || page === 20) throw new Error("评分分页不完整，未展示残缺名单")
    }
    if (!self) throw new Error("评分响应缺失")
    const info = self.infoJson
    const players = nodes.filter(n => first(n.infoJson ?? {}, "type") === "player").map(n => {
      const pi = n.infoJson ?? {}
      const teamId = String(first(pi, "teamId"))
      if (String(first(pi, "matchId")) !== game.id || !game.teams.some(t => t.id === teamId)) throw new Error("球员评分归属错误")
      const raters = count(n.scorePersonCount)
      return { id: id(first(pi, "itemId"), "playerId"), key: { outBizType: n.bizType, outBizNo: id(n.bizId, "评分条目编号") }, name: String(n.name), teamId, avatar: image(n.image?.[0]), rating: raters > 0 && Number.isFinite(Number(n.scoreAvg)) ? Number(n.scoreAvg) : null, raters, commentCount: count(n.commentCount), stats: String(first(pi, "desc") ?? ""), hotComments: (n.hotCommentModels ?? []).map(parseComment) }
    })
    return { matchId: game.id, season: String(first(info, "season") ?? ""), title: String(self.name), homeTeamId: String(first(info, "homeTeamId")), awayTeamId: String(first(info, "awayTeamId")), players }
  }
  async comments(player: Player, cursor = Date.now()): Promise<{ comments: Comment[]; cursor: number; hasMore: boolean }> {
    const data = (await this.get(COMMENTS, { ...player.key, order: "desc", queryType: "latest", publishTime: cursor, page: 1, pageSize: 20, clientCode: "", cid: "" })).data
    if (!data) throw new Error("评论响应缺失")
    const comments = array(data.comments, "comments").map(parseComment)
    const next = count(data.cursor?.publishTime)
    const hasMore = data.hasMore === true
    if (hasMore && (!next || next >= cursor || !comments.length)) throw new Error("评论游标未前进")
    return { comments, cursor: next, hasMore }
  }
}
