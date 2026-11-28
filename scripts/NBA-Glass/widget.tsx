import { AnimatedFrames, EnvironmentValuesReader, GeometryReader, HStack, Image, Link, PathShape, RoundedRectangle, Script, Text, VStack, Widget, ZStack, gradient, type Color, type WidgetRenderingMode } from "scripting"
import { beijingTime, type Game, type Team } from "./runtime/hupu"
import { widgetLayout } from "./runtime/widget-layout"
import { widgetData } from "./runtime/service"

// NBA identity colors decorate the matchup; no extra requests or schedule fields.
const teamColors: Record<string, Color> = {
  "老鹰": "#C8102E", "篮网": "#343C48", "凯尔特人": "#007A33", "黄蜂": "#00788C", "公牛": "#CE1141",
  "骑士": "#860038", "活塞": "#C8102E", "步行者": "#002D62", "热火": "#98002E", "雄鹿": "#00471B",
  "尼克斯": "#006BB6", "魔术": "#0077C0", "76人": "#006BB6", "猛龙": "#CE1141", "奇才": "#002B5C",
  "独行侠": "#00538C", "掘金": "#0E2240", "勇士": "#1D428A", "火箭": "#CE1141", "快船": "#1D428A",
  "湖人": "#552583", "灰熊": "#5D76A9", "森林狼": "#0C2340", "鹈鹕": "#0C2340", "雷霆": "#007AC1",
  "太阳": "#E56020", "开拓者": "#E03A3E", "马刺": "#535B62", "国王": "#5A2D81", "爵士": "#3D5374",
}
const teamColor = (team: Team) => teamColors[team.name] ?? "#314E76"
const result = (game: Game) => game.status !== "NOTSTARTED" && game.teams.every(t => t.score != null)
  ? `${game.teams[0].score} : ${game.teams[1].score}` : beijingTime(game.time)
const runURL = (params: Record<string, string> = {}) => Script.createRunURLScheme(Script.name, params)

function Logo({ team, size }: { team: Team; size: number }) {
  return team.logo ? <Image imageUrl={team.logo} resizable scaleToFit renderingMode="original" widgetAccentedRenderingMode="desaturated" frame={{ width: size, height: size }} accessibilityLabel={team.name} />
    : <Text font="caption2" fontWeight="bold" foregroundStyle="white" frame={{ width: size, height: size }}>{team.name.slice(0, 2)}</Text>
}

function DuelBackdrop({ game, fullColor, diagonal = false, animated = false }: { game: Game; fullColor: boolean; diagonal?: boolean; animated?: boolean }) {
  const [a, b] = game.teams
  const opacity = Widget.isTransparentMode || Widget.isBlurMode || Widget.isTransparentBackground ? 0.30 : 0.94
  const left = diagonal ? 1 : 0.56
  const right = diagonal ? 0 : 0.44
  return <ZStack>
    <PathShape fill={gradient("linear", { colors: [teamColor(a), "#111D30"], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } })} opacity={fullColor ? opacity : 0.10} draw={(p, s) => {
      p.move({ x: 0, y: 0 }); p.addLine({ x: s.width * left, y: 0 }); p.addLine({ x: s.width * right, y: s.height }); p.addLine({ x: 0, y: s.height }); p.closeSubpath()
    }} />
    <PathShape fill={gradient("linear", { colors: ["#111D30", teamColor(b)], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } })} opacity={fullColor ? opacity : 0.16} draw={(p, s) => {
      p.move({ x: s.width * left, y: 0 }); p.addLine({ x: s.width, y: 0 }); p.addLine({ x: s.width, y: s.height }); p.addLine({ x: s.width * right, y: s.height }); p.closeSubpath()
    }} />
    {diagonal ? <PathShape stroke={{ shapeStyle: "white", strokeStyle: { lineWidth: 1 } }} opacity={0.24} draw={(p, s) => { p.move({ x: s.width, y: 0 }); p.addLine({ x: 0, y: s.height }) }} /> : null}
    {animated && fullColor ? <AnimatedFrames duration={6}>{[0.12, 0.20, 0.32, 0.44, 0.32, 0.20].map((opacity, i) => <PathShape key={i} stroke={{ shapeStyle: "white", strokeStyle: { lineWidth: 2 } }} opacity={opacity} draw={(p, s) => { p.move({ x: s.width, y: 0 }); p.addLine({ x: 0, y: s.height }) }} />)}</AnimatedFrames> : null}
  </ZStack>
}

function DuelTile({ game, fullColor, hero = false }: { game: Game; fullColor: boolean; hero?: boolean }) {
  return <GeometryReader>{proxy => {
    const { width, height } = proxy.size
    const size = hero ? Math.min(52, width * 0.26) : Math.min(34, width * 0.31)
    return <ZStack frame={{ width, height }}>
      <DuelBackdrop game={game} fullColor={fullColor} diagonal animated={hero} />
      <ZStack offset={{ x: -width * 0.27, y: -height * (hero ? 0.17 : 0.22) }}><Logo team={game.teams[0]} size={size} /></ZStack>
      <ZStack offset={{ x: width * 0.27, y: height * (hero ? 0.17 : 0.22) }}><Logo team={game.teams[1]} size={size} /></ZStack>
      <ZStack frame={{ width: hero ? 48 : 29, height: hero ? 36 : 23 }}>
        <RoundedRectangle cornerRadius={hero ? 14 : 9} fill={{ color: "white", opacity: fullColor ? 0.12 : 0.08 }} stroke={{ shapeStyle: { color: "white", opacity: 0.35 }, strokeStyle: { lineWidth: 0.7 } }} />
        <Text font={hero ? 22 : 12} fontWeight="heavy" italic foregroundStyle="white">VS</Text>
      </ZStack>
    </ZStack>
  }}</GeometryReader>
}

async function main() {
  const data = await widgetData()
  const layout = widgetLayout(data.games, Widget.family, Widget.displaySize)
  function View({ mode }: { mode: WidgetRenderingMode }) {
    const fullColor = mode === "fullColor"
    const first = layout.days[0]
    const game = first?.games[0]
    const empty = data.error ? "暂时无法更新" : "暂无赛程"
    const ink = "#F5F8FF"
    const subtle = fullColor ? "#C4D0E2" : { color: "white" as const, opacity: 0.72 }
    function teamSide(team: Team, trailing: boolean) {
      return layout.mode === "columns"
        ? <VStack spacing={1} frame={{ maxWidth: "infinity" }}><Logo team={team} size={18} /><Text font={9} foregroundStyle={ink} lineLimit={1} minScaleFactor={0.7}>{team.name}</Text></VStack>
        : <HStack spacing={4} frame={{ maxWidth: "infinity", alignment: trailing ? "trailing" : "leading" }}>{!trailing ? <Logo team={team} size={20} /> : null}<Text font="caption2" foregroundStyle={ink} lineLimit={1}>{team.name}</Text>{trailing ? <Logo team={team} size={20} /> : null}</HStack>
    }
    function matchup(item: Game) {
      return <Link url={runURL({ matchId: item.id })}>
        <ZStack frame={{ height: layout.rowHeight }} clipShape={{ type: "rect", cornerRadius: 9 }}>
          <DuelBackdrop game={item} fullColor={fullColor} />
          <HStack spacing={4} padding={{ horizontal: 7 }}>
            {teamSide(item.teams[0], false)}
            <VStack spacing={0} frame={{ width: 64 }}><Text font={8} fontWeight="bold" foregroundStyle={subtle}>VS</Text><Text font="caption" fontWeight="bold" monospacedDigit foregroundStyle={ink} lineLimit={1} minScaleFactor={0.8}>{result(item)}</Text></VStack>
            {teamSide(item.teams[1], true)}
          </HStack>
        </ZStack>
      </Link>
    }
    function dayHeading(day: typeof layout.days[number]) {
      return <Link url={runURL({ date: day.date })}><HStack frame={{ height: 20 }}><Text font="caption" fontWeight="bold" monospacedDigit foregroundStyle={ink} frame={{ maxWidth: "infinity", alignment: "leading" }}>{day.date.slice(5).replace("-", "/")}</Text><Text font={10} foregroundStyle={subtle}>{`${day.total}场${day.hidden ? ` · +${day.hidden}` : ""} ›`}</Text></HStack></Link>
    }
    if (layout.mode === "accessory") {
      if (Widget.family === "accessoryInline") return <Text>{game ? `${first.date.slice(5)} ${game.teams.map(t => t.name).join("·")} ${result(game)}` : `NBA · ${empty}`}</Text>
      return <VStack spacing={2}><HStack spacing={4}>{game?.teams.map(team => <Logo key={team.id} team={team} size={18} />)}</HStack><Text font="caption" fontWeight="bold" monospacedDigit>{game ? result(game) : "—"}</Text><Text font="caption2" lineLimit={1}>{game ? Widget.family === "accessoryCircular" ? first.date.slice(5) : game.teams.map(t => t.name).join(" · ") : empty}</Text></VStack>
    }
    if (layout.mode === "small") return <ZStack widgetURL={runURL(game ? { matchId: game.id } : {})} widgetBackground="#101B2D" frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
      {game ? <DuelTile game={game} fullColor={fullColor} hero /> : null}
      <VStack spacing={0} padding={12} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
        <HStack><Text font="caption" fontWeight="heavy" foregroundStyle={ink} frame={{ maxWidth: "infinity", alignment: "leading" }}>NBA</Text><Text font={10} monospacedDigit foregroundStyle={subtle}>{first?.date.slice(5).replace("-", "/") ?? ""}</Text></HStack>
        <VStack frame={{ maxHeight: "infinity" }} />
        <Text font={game ? 14 : 11} fontWeight="bold" monospacedDigit foregroundStyle={ink}>{game ? result(game) : empty}</Text>
      </VStack>
    </ZStack>
    return <VStack alignment="leading" spacing={6} padding={10} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }} widgetBackground="#101B2D">
      <HStack frame={{ height: 16 }}><Text font="caption" fontWeight="heavy" foregroundStyle={ink} frame={{ maxWidth: "infinity", alignment: "leading" }}>NBA</Text><Link url={runURL()}><Text font={10} foregroundStyle={subtle}>赛程 ›</Text></Link></HStack>
      {layout.mode === "medium" ? <HStack alignment="top" spacing={8}>{layout.days.map(day => <VStack key={day.date} spacing={4} frame={{ maxWidth: "infinity" }}>
        <Link url={runURL({ date: day.date })}><Text font={10} fontWeight="semibold" foregroundStyle={subtle}>{`${day.date.slice(5).replace("-", "/")} · ${day.total}场`}</Text></Link>
        <Link url={runURL({ matchId: day.games[0].id })}><VStack spacing={3}>
          <ZStack frame={{ height: Math.max(48, Math.min(90, Widget.displaySize.height - 98)) }} clipShape={{ type: "rect", cornerRadius: 12 }}><DuelTile game={day.games[0]} fullColor={fullColor} /></ZStack>
          <Text font={9} foregroundStyle={subtle} lineLimit={1}>{day.games[0].teams.map(t => t.name).join(" · ")}</Text>
          <Text font="caption" fontWeight="bold" monospacedDigit foregroundStyle={ink}>{result(day.games[0])}</Text>
        </VStack></Link>
      </VStack>)}</HStack> : layout.mode === "columns" ? <HStack alignment="top" spacing={10}>{layout.days.map(day => <VStack key={day.date} spacing={6} frame={{ maxWidth: "infinity" }}>{dayHeading(day)}{day.games.map(item => <VStack key={item.id}>{matchup(item)}</VStack>)}</VStack>)}</HStack>
        : <VStack spacing={8}>{layout.days.map(day => <VStack key={day.date} spacing={4}>{dayHeading(day)}<VStack spacing={4}>{day.games.map(item => <VStack key={item.id}>{matchup(item)}</VStack>)}</VStack></VStack>)}</VStack>}
      {!layout.days.length ? <Text font="caption" foregroundStyle={subtle}>{empty}</Text> : null}
    </VStack>
  }
  Widget.present(<EnvironmentValuesReader keys={["widgetRenderingMode"]}>{env => <View mode={env.widgetRenderingMode} />}</EnvironmentValuesReader>, { policy: "after", date: new Date(Date.now() + 15 * 60000) })
}
main().catch(() => Widget.present(<VStack padding={12}><Text>NBA</Text><Text font="caption">暂时无法更新</Text></VStack>))
