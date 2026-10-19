import { api } from "./client"
import { readCache, saveCache } from "./cache"
import { beijingDate, type Game, type Season } from "./hupu"

export function expectedYear(): number {
  const date = beijingDate(Date.now())
  const year = Number(date.slice(0, 4))
  return Number(date.slice(5, 7)) >= 9 ? year : year - 1
}
export const seasonKey = () => `season-${expectedYear()}`
export async function cachedSeason(): Promise<Season | null> {
  const snapshot = await readCache<Season>(seasonKey())
  return snapshot?.value.season === `${expectedYear()}-${expectedYear() + 1}` ? snapshot.value : null
}
export async function refreshSeason(progress?: (done: number, total: number) => void): Promise<Season> {
  const recent = await api.recent()
  const latest = recent.filter(g => g.status === "COMPLETED" && (g.ratingKey || g.itemKey)).sort((a, b) => b.time - a.time)[0]
  if (!latest) throw new Error("来源尚未提供可核对的当前赛季标识")
  const board = await api.board(latest)
  const sourceYear = Number(board?.season.split("-")[0])
  if (!Number.isInteger(sourceYear) || sourceYear !== expectedYear()) throw new Error("来源赛季与当前日期不符，未替换缓存")
  const result = await api.season(sourceYear, recent, progress)
  await saveCache(seasonKey(), result)
  await saveCache("recent", recent)
  return result
}
export async function widgetData(): Promise<{ games: Game[]; fetchedAt: number; cached: boolean; error: string }> {
  const full = await cachedSeason()
  const snapshot = await readCache<Game[]>("recent")
  let recent = snapshot?.value ?? []
  let fetchedAt = snapshot?.fetchedAt ?? full?.fetchedAt ?? 0
  let cached = true
  let error = ""
  if (!snapshot || Date.now() - snapshot.fetchedAt > 5 * 60 * 1000) {
    try {
      recent = await api.recent()
      fetchedAt = (await saveCache("recent", recent)).fetchedAt
      cached = false
    } catch (e) { error = String(e) }
  }
  const games = new Map((full?.games ?? []).map(g => [g.id, g]))
  for (const game of recent) if (game.date >= `${expectedYear()}-09-01` && game.date < `${expectedYear() + 1}-08-01`) games.set(game.id, game)
  return { games: [...games.values()], fetchedAt, cached, error }
}
