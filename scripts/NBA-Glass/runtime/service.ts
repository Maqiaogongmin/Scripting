import { api } from "./client"
import { readCache, saveCache, type Snapshot } from "./cache"
import { beijingDate, mergeSchedule, type Game, type Season } from "./hupu"

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
function currentSeasonGames(games: Game[], year = expectedYear()): Game[] {
  return games.filter(game => game.date >= `${year}-09-01` && game.date < `${year + 1}-08-01`)
}
export async function cachedRecent(): Promise<Snapshot<Game[]> | null> {
  const snapshot = await readCache<Game[]>("recent")
  if (!snapshot) return null
  const games = currentSeasonGames(snapshot.value)
  return games.length ? { ...snapshot, value: games } : null
}
export async function refreshRecent(): Promise<Snapshot<Game[]>> {
  const games = currentSeasonGames(await api.recent())
  if (!games.length) throw new Error("虎扑暂无本赛季近期比赛")
  return saveCache("recent", games)
}
export async function rememberMatch(game: Game): Promise<void> {
  const full = await cachedSeason()
  if (full?.games.some(item => item.id === game.id)) {
    await saveCache(seasonKey(), { ...full, games: full.games.map(item => item.id === game.id ? game : item) }, full.fetchedAt)
  }
  const recent = await readCache<Game[]>("recent")
  if (recent?.value.some(item => item.id === game.id)) {
    // Updating one match must not make every other cached game appear fresh.
    await saveCache("recent", recent.value.map(item => item.id === game.id ? game : item), recent.fetchedAt)
  }
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
  return result
}
export async function widgetData(): Promise<{ games: Game[]; fetchedAt: number; cached: boolean; error: string }> {
  const [full, snapshot] = await Promise.all([cachedSeason(), cachedRecent()])
  let recent = snapshot?.value ?? []
  let fetchedAt = snapshot?.fetchedAt ?? full?.fetchedAt ?? 0
  let cached = true
  let error = ""
  if (!snapshot || Date.now() - snapshot.fetchedAt > 5 * 60 * 1000) {
    try {
      const updated = await refreshRecent()
      recent = updated.value
      fetchedAt = updated.fetchedAt
      cached = false
    } catch (e) { error = String(e) }
  }
  return { games: mergeSchedule(full?.games ?? [], recent), fetchedAt, cached, error }
}
