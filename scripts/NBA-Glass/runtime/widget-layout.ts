import { nextDays, type Game } from "./hupu"

/** Heights are shared with the native view so density follows available points. */
export function widgetLayout(games: Game[], family: string, size: { width: number; height: number }, now = Date.now()) {
  const days = nextDays(games, now)
  const mode = family === "systemSmall" ? "small" : family === "systemMedium" ? "medium" : family.startsWith("accessory") ? "accessory" : family === "systemExtraLarge" && size.width >= 500 ? "columns" : "large"
  const selected = mode === "small" || mode === "accessory" ? days.slice(0, 1) : days
  const counts = selected.map(day => Math.min(1, day.games.length))
  // Outer insets 24 + title/gap 26 + each panel (heading 22 + insets 12) + gaps 8.
  const overhead = 50 + selected.length * 34 + Math.max(0, selected.length - 1) * 8
  let rowHeight = 24
  if (mode === "large") {
    let remaining = Math.max(0, Math.floor((size.height - overhead) / 24) - counts.reduce((a, b) => a + b, 0))
    while (remaining > 0) {
      let allocated = false
      for (let i = 0; i < selected.length && remaining > 0; i++) {
        if (counts[i] < Math.min(6, selected[i].games.length)) { counts[i]++; remaining--; allocated = true }
      }
      if (!allocated) break
    }
    const rows = counts.reduce((a, b) => a + b, 0)
    rowHeight = Math.max(24, Math.min(32, Math.floor((size.height - overhead) / Math.max(1, rows))))
  } else if (mode === "columns") {
    const limit = Math.max(1, Math.min(5, Math.floor((size.height - 90) / 66)))
    selected.forEach((day, i) => { counts[i] = Math.min(limit, day.games.length) })
  }
  return { mode, rowHeight, overhead, days: selected.map((day, i) => ({ date: day.date, total: day.games.length, games: day.games.slice(0, counts[i]), hidden: day.games.length - counts[i] })) }
}
