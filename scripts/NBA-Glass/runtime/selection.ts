import { beijingDate, nextDays, type Game } from "./hupu"

export function initialSelection(games: Game[], parameters: Record<string, unknown>, now = Date.now()) {
  const requestedId = typeof parameters.matchId === "string" && /^\d{1,32}$/.test(parameters.matchId) ? parameters.matchId : ""
  const match = games.find(game => game.id === requestedId)
  const requestedDate = typeof parameters.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parameters.date) ? parameters.date : ""
  const day = match?.date || requestedDate || nextDays(games.filter(game => game.phase === "NBA常规赛"), now)[0]?.date || nextDays(games, now)[0]?.date || beijingDate(now)
  // A widget date/match link covers every phase, including preseason and playoffs.
  return { day, month: day.slice(0, 7), phase: match || requestedDate ? "" : "NBA常规赛", focus: match?.id ?? "", missingMatch: Boolean(requestedId && !match) }
}
