import { HStack, Link, Script, Text, VStack, Widget } from "scripting"
import { beijingTime, type Game, type Team } from "./runtime/hupu"
import { widgetLayout } from "./runtime/widget-layout"
import { widgetData } from "./runtime/service"
import { Avatar, colors } from "./ui"

async function main() {
  const data = await widgetData()
  const layout = widgetLayout(data.games, Widget.family, Widget.displaySize)
  const runURL = (params: Record<string, string> = {}) => Script.createRunURLScheme(Script.name, params)
  const result = (game: Game) => game.status !== "NOTSTARTED" && game.teams.every(t => t.score != null) ? `${game.teams[0].score}:${game.teams[1].score}` : beijingTime(game.time)
  const dateLabel = (date: string) => `${date.slice(5).replace("-", "/")} ${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date(`${date}T12:00:00+08:00`).getUTCDay()]}`
  function View() {
    const c = colors()
    const first = layout.days[0]
    const game = first?.games[0]
    const empty = data.error ? "暂时无法更新" : "暂无赛程"
    const panel = { background: c.surface, clipShape: { type: "rect" as const, cornerRadius: 12 } }
    function teamLabel(team: Team, size = 18) {
      return <HStack spacing={5} frame={{ maxWidth: "infinity", alignment: "leading" }}><Avatar url={team.logo} name={team.name} size={size} /><Text font="caption" fontWeight="medium" foregroundStyle={c.primary} lineLimit={1}>{team.name}</Text></HStack>
    }
    function matchup(item: Game) {
      return <HStack spacing={6} frame={{ height: layout.rowHeight }}>{teamLabel(item.teams[0])}<Text font="caption2" foregroundStyle={c.secondary}>·</Text>{teamLabel(item.teams[1])}<Text font="caption" fontWeight="semibold" monospacedDigit foregroundStyle={c.primary} lineLimit={1} frame={{ width: 54, alignment: "trailing" }}>{result(item)}</Text></HStack>
    }
    function stackedMatch(item: Game) {
      return <VStack alignment="leading" spacing={3}>{item.teams.map(team => <HStack key={team.id} spacing={4}><Avatar url={team.logo} name={team.name} size={16} /><Text font="caption2" foregroundStyle={c.primary} lineLimit={1}>{team.name}</Text></HStack>)}<Text font="caption" fontWeight="semibold" monospacedDigit foregroundStyle={c.accent}>{result(item)}</Text></VStack>
    }
    if (layout.mode === "accessory") {
      if (Widget.family === "accessoryInline") return <Text>{game ? `${first.date.slice(5)} ${game.teams.map(t => t.name).join("·")} ${result(game)}` : `NBA · ${empty}`}</Text>
      if (Widget.family === "accessoryCircular") return <VStack spacing={2}><HStack spacing={3}>{game?.teams.map(team => <Avatar key={team.id} url={team.logo} name={team.name} size={16} />)}</HStack><Text font="caption" fontWeight="bold" monospacedDigit>{game ? result(game) : "—"}</Text><Text font="caption2">{first?.date.slice(5) ?? ""}</Text></VStack>
      return <VStack alignment="leading" spacing={3}><HStack><Text font="caption2" fontWeight="semibold">NBA</Text><Text font="caption2">{first ? dateLabel(first.date) : ""}</Text></HStack><Text font="caption" fontWeight="medium" lineLimit={1}>{game ? game.teams.map(t => t.name).join(" · ") : empty}</Text>{game ? <Text font="caption" fontWeight="bold" monospacedDigit>{result(game)}</Text> : null}</VStack>
    }
    if (layout.mode === "small") return <VStack alignment="leading" spacing={8} padding={12} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }} widgetBackground={c.background}>
      <HStack><Text font="subheadline" fontWeight="bold" foregroundStyle={c.primary} frame={{ maxWidth: "infinity", alignment: "leading" }}>NBA</Text><Text font="caption2" foregroundStyle={c.secondary}>{first?.date.slice(5).replace("-", "/") ?? ""}</Text></HStack>
      {game ? <Link url={runURL({ matchId: game.id })} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}><VStack alignment="leading" spacing={5} padding={7} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "center" }} {...panel}>{game.teams.map(team => <HStack key={team.id}>{teamLabel(team, 20)}</HStack>)}<Text font="subheadline" fontWeight="bold" monospacedDigit foregroundStyle={c.accent}>{result(game)}</Text></VStack></Link> : <Text font="caption" foregroundStyle={c.secondary}>{empty}</Text>}
      {first ? <Link url={runURL({ date: first.date })}><Text font="caption2" foregroundStyle={c.secondary}>{`${first.total} 场比赛 ›`}</Text></Link> : null}
    </VStack>
    return <VStack alignment="leading" spacing={8} padding={12} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }} widgetBackground={c.background}>
      <HStack frame={{ height: 18 }}><Text font="subheadline" fontWeight="bold" foregroundStyle={c.primary} frame={{ maxWidth: "infinity", alignment: "leading" }}>NBA</Text><Link url={runURL()}><Text font="caption2" foregroundStyle={c.secondary}>赛程 ›</Text></Link></HStack>
      {layout.mode === "medium" || layout.mode === "columns" ? <HStack alignment="top" spacing={8}>{layout.days.map(day => <VStack key={day.date} alignment="leading" spacing={5} padding={7} frame={{ maxWidth: "infinity", alignment: "topLeading" }} {...panel}>
        <Link url={runURL({ date: day.date })}><VStack alignment="leading" spacing={2}><Text font="caption" fontWeight="bold" monospacedDigit foregroundStyle={c.accent}>{day.date.slice(5).replace("-", "/")}</Text><Text font="caption2" foregroundStyle={c.secondary}>{`${day.total} 场 ›`}</Text></VStack></Link>
        {day.games.map(item => <Link key={item.id} url={runURL({ matchId: item.id })}>{stackedMatch(item)}</Link>)}
      </VStack>)}</HStack> : <VStack alignment="leading" spacing={8} frame={{ maxWidth: "infinity", alignment: "topLeading" }}>{layout.days.map(day => <VStack key={day.date} alignment="leading" spacing={0} padding={{ horizontal: 9, vertical: 6 }} frame={{ maxWidth: "infinity", alignment: "topLeading" }} {...panel}>
        <Link url={runURL({ date: day.date })}><HStack frame={{ height: 22 }}><Text font="caption" fontWeight="bold" foregroundStyle={c.accent} frame={{ maxWidth: "infinity", alignment: "leading" }}>{dateLabel(day.date)}</Text><Text font="caption2" foregroundStyle={c.secondary}>{`${day.total} 场${day.hidden ? ` · +${day.hidden}` : ""} ›`}</Text></HStack></Link>
        {day.games.map(item => <Link key={item.id} url={runURL({ matchId: item.id })}>{matchup(item)}</Link>)}
      </VStack>)}</VStack>}
      {!layout.days.length ? <Text font="caption" foregroundStyle={c.secondary}>{empty}</Text> : null}
    </VStack>
  }
  Widget.present(<View />, { policy: "after", date: new Date(Date.now() + 15 * 60000) })
}
main().catch(() => Widget.present(<VStack padding={12}><Text>NBA</Text><Text font="caption">暂时无法更新</Text></VStack>))
