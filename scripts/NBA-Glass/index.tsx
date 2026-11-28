import { Button, Divider, HStack, Link, List, Navigation, NavigationLink, NavigationStack, Picker, ProgressView, Script, Section, Tab, TabView, Text, VStack, Widget, useEffect, useObservable, useState, useRef, type VirtualNode, type WidgetFamily } from "scripting"
import { api } from "./runtime/client"
import { readCache, saveCache } from "./runtime/cache"
import { cachedRecent, cachedSeason, refreshRecent, refreshSeason, rememberMatch } from "./runtime/service"
import { initialSelection } from "./runtime/selection"
import { beijingDate, mergeSchedule, nextDays, type Board, type Comment, type Game, type Player, type Season } from "./runtime/hupu"
import { parseBoxScore, type BoxScore } from "./runtime/boxscore"
import { StatsTable } from "./boxscore-ui"
import { PlayerButton, PlayerProfile, type PlayerIdentity } from "./player-ui"
import { StandingsPage } from "./standings-ui"
import { colors, CommentCard, MatchRow, Surface } from "./ui"

function PlayerComments({ player }: { player: Player }) {
  const c = colors()
  const [comments, setComments] = useState<Comment[]>([])
  const [cursor, setCursor] = useState<number | undefined>(undefined)
  const [hasMore, setHasMore] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function more() {
    if (busy) return
    setBusy(true); setError("")
    try {
      const page = await api.comments(player, cursor)
      setComments(previous => [...new Map([...previous, ...page.comments].map(comment => [comment.id, comment])).values()])
      setCursor(page.cursor); setHasMore(page.hasMore)
    } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  useEffect(() => { void more() }, [])
  return <List navigationTitle={`${player.name} · 最新评论`} navigationContainerBackground={c.background}>
    {comments.map(comment => <CommentCard key={comment.id} comment={comment} />)}
    {error ? <Text foregroundStyle={c.secondary}>加载失败</Text> : null}
    {busy ? <ProgressView /> : hasMore ? <Button title={error ? "重试" : "加载更多"} action={more} buttonStyle="bordered" frame={{ minHeight: 44 }} /> : <Text>没有更多了</Text>}
    {!busy && !error && !comments.length ? <Text>暂无评论</Text> : null}
    <Link url={`https://m.hupu.com/score-item/${player.key.outBizType}/${player.key.outBizNo}`}>查看原文</Link>
  </List>
}

function Detail({ game, onUpdated }: { game: Game; onUpdated?: (game: Game) => void }) {
  const c = colors()
  const [board, setBoard] = useState<Board | null>(null)
  const [team, setTeam] = useState(game.teams[0].id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [current, setCurrent] = useState(game)
  const [mode, setMode] = useState("评分")
  const [box, setBox] = useState<BoxScore | null>(null)
  const [statsBusy, setStatsBusy] = useState(false)
  const [statsError, setStatsError] = useState("")
  const loading = useRef(false)
  const statsLoading = useRef(false)
  const [destination, setDestination] = useState<{ kind: "profile"; player: PlayerIdentity } | { kind: "comments"; player: Player } | null>(null)
  function openPlayer(player: PlayerIdentity) { setDestination({ kind: "profile", player }) }
  async function loadStats(match: Game) {
    if (statsLoading.current) return
    statsLoading.current = true; setStatsBusy(true); setStatsError("")
    try {
      if (!box) {
        const prior = await readCache<BoxScore>(`box-${match.id}`)
        if (prior?.value.matchId === match.id) setBox(prior.value)
      }
      const result = parseBoxScore(await api.playerStats(match), match)
      setBox(result)
      if (result) await saveCache(`box-${match.id}`, result)
    } catch { setStatsError("统计更新失败") }
    finally { statsLoading.current = false; setStatsBusy(false) }
  }
  async function load() {
    if (loading.current) return
    loading.current = true; setBusy(true); setError("")
    let match = current
    const errors: string[] = []
    try {
      try {
        match = await api.match(current)
        setCurrent(match); onUpdated?.(match)
        try { await rememberMatch(match); Widget.reloadAll() } catch { errors.push("缓存未保存") }
      } catch { errors.push("比分更新失败") }
      if (!board) {
        const prior = await readCache<Board>(`board-${match.id}`)
        if (prior?.value.matchId === match.id) setBoard(prior.value)
      }
      try {
        const result = await api.board(match)
        setBoard(result)
        if (result) await saveCache(`board-${match.id}`, result)
      } catch { errors.push("评分更新失败") }
      if (mode === "技术统计" || box) await loadStats(match)
    } catch { errors.push("加载失败") }
    finally { setError(errors.join(" · ")); loading.current = false; setBusy(false) }
  }
  useEffect(() => { void load() }, [game.id])
  const players = board?.players.filter(p => p.teamId === team).sort((a, b) => b.raters - a.raters) ?? []
  return <VStack spacing={8} navigationTitle="比赛详情" navigationBarTitleDisplayMode="inline" navigationContainerBackground={c.background} toolbar={{ primaryAction: <Button title="刷新" action={load} disabled={busy || statsBusy} /> }}>
    <Picker title="内容" value={mode} onChanged={(value: string) => { setMode(value); if (value === "技术统计" && !box) void loadStats(current) }} pickerStyle="segmented" padding={{ horizontal: 20 }}><Text tag="评分">评分</Text><Text tag="技术统计">技术统计</Text></Picker>
    <Picker title="球队" value={team} onChanged={setTeam} pickerStyle="segmented" padding={{ horizontal: 20 }}>{current.teams.map(t => <Text key={t.id} tag={t.id}>{t.name}</Text>)}</Picker>
    <List listStyle="plain" scrollContentBackground="hidden" navigationDestination={{
      isPresented: destination !== null,
      onChanged: visible => { if (!visible) setDestination(null) },
      content: destination?.kind === "profile" ? <PlayerProfile player={destination.player} />
        : destination?.kind === "comments" ? <PlayerComments player={destination.player} /> : <Text>球员资料</Text>,
    }}>
      <Surface><Text font="caption" foregroundStyle={c.secondary}>{current.date}</Text><MatchRow game={current} /></Surface>
      {busy ? <ProgressView /> : null}
      {error ? <Text font="caption" foregroundStyle={c.secondary}>{error}</Text> : null}
      {mode === "技术统计" ? <VStack spacing={8}>
        {statsBusy ? <ProgressView /> : null}
        {statsError ? <VStack><Text font="caption" foregroundStyle={c.secondary}>{statsError}</Text><Button title="重试统计" buttonStyle="bordered" action={() => loadStats(current)} /></VStack> : null}
        {box ? <StatsTable box={box} teamId={team} onPlayer={openPlayer} /> : !statsBusy && !statsError ? <Text foregroundStyle={c.secondary}>暂无技术统计</Text> : null}
      </VStack> : <Section>
        {!busy && !board && !error ? <Text foregroundStyle={c.secondary}>暂无评分</Text> : null}
        {players.map(player => <Surface key={player.key.outBizNo}>
          <HStack spacing={12} frame={{ maxWidth: "infinity" }}>
            <VStack alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
              <PlayerButton player={player} subtitle={player.stats} onOpen={openPlayer} />
            </VStack>
            <VStack alignment="trailing"><Text font="title2" fontWeight="bold" foregroundStyle={c.accent}>{player.rating == null ? "待评分" : player.rating.toFixed(1)}</Text><Text font="caption2" foregroundStyle={c.secondary}>{`${player.raters.toLocaleString()} 人评分`}</Text></VStack>
          </HStack>
          <VStack alignment="leading">{player.hotComments.map(comment => <CommentCard key={comment.id} comment={comment} />)}</VStack>
          <Button action={() => setDestination({ kind: "comments", player })} buttonStyle="plain"><Text foregroundStyle={c.accent}>{`最新评论（${player.commentCount.toLocaleString()}）`}</Text></Button>
        </Surface>)}
        {board && !busy && !players.length ? <Text>暂无球员评分</Text> : null}
      </Section>}
    </List>
  </VStack>
}

function App() {
  const c = colors()
  const dismiss = Navigation.useDismiss()
  const tab = useObservable<number>(Script.queryParameters.matchId || Script.queryParameters.date ? 1 : 0)
  const [recent, setRecent] = useState("赛程")
  const [previewError, setPreviewError] = useState("")
  const [season, setSeason] = useState<Season | null>(null)
  const [seasonBusy, setSeasonBusy] = useState(false)
  const [progress, setProgress] = useState("")
  const [seasonError, setSeasonError] = useState("")
  const [recentGames, setRecentGames] = useState<Game[]>([])
  const [recentBusy, setRecentBusy] = useState(true)
  const [recentError, setRecentError] = useState("")
  const recentLoading = useRef(false)
  const seasonLoading = useRef(false)
  const [phase, setPhase] = useState("NBA常规赛")
  const [team, setTeam] = useState("")
  const [month, setMonth] = useState("")
  const [day, setDay] = useState("")
  const [focus, setFocus] = useState(String(Script.queryParameters.matchId ?? ""))
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  function locate(games: Game[]) {
    if (!Script.queryParameters.matchId && !Script.queryParameters.date) return
    const selection = initialSelection(games, Script.queryParameters)
    setMonth(selection.month); setDay(selection.day); setPhase(selection.phase)
  }
  async function loadRecent(initial = false) {
    if (recentLoading.current) return
    recentLoading.current = true
    setRecentBusy(true); setRecentError("")
    try {
      let full: Game[] = []
      let cachedMatch = false
      if (initial) {
        const [cachedFull, cachedWindow] = await Promise.all([cachedSeason(), cachedRecent()])
        full = cachedFull?.games ?? []
        const window = cachedWindow?.value ?? []
        setSeason(cachedFull)
        setRecentGames(window)
        const cached = mergeSchedule(full, window)
        cachedMatch = cached.some(game => game.id === focus)
        locate(cached)
      }
      const fresh = await refreshRecent()
      setRecentGames(fresh.value)
      if (initial && focus && !cachedMatch) locate(mergeSchedule(full, fresh.value))
      Widget.reloadAll()
    } catch { setRecentError("近期比赛更新失败") }
    finally { recentLoading.current = false; setRecentBusy(false) }
  }
  async function syncSeason() {
    if (seasonLoading.current) return
    seasonLoading.current = true
    setSeasonBusy(true); setSeasonError("")
    try {
      const full = await refreshSeason((done, total) => setProgress(`同步球队 ${done}/${total}`))
      setSeason(full)
      Widget.reloadAll()
    } catch { setSeasonError("完整赛季同步失败") }
    finally { seasonLoading.current = false; setSeasonBusy(false); setProgress("") }
  }
  useEffect(() => { void loadRecent(true) }, [])
  const schedule = mergeSchedule(season?.games ?? [], recentGames)
  const focused = focus ? schedule.find(g => g.id === focus) : undefined
  const months = [...new Set(schedule.map(g => g.date.slice(0, 7)))].sort()
  const dates = [...new Set(schedule.filter(g => !month || g.date.startsWith(month)).map(g => g.date))].sort()
  const games = schedule.filter(g => (!phase || g.phase === phase) && (!team || g.teams.some(t => t.id === team)) && (!month || g.date.startsWith(month)) && (!day || g.date === day))
  const groups = [...new Set(games.map(g => g.date))]
  const completed = recent === "赛果" ? schedule.filter(g => g.status === "COMPLETED" && g.time <= Date.now()) : []
  const recentGroups = recent === "赛程" ? nextDays(schedule) : [...new Set(completed.map(g => g.date))].sort().reverse().slice(0, 3).map(date => ({ date, games: completed.filter(g => g.date === date) }))
  const close = <Button title="关闭" action={dismiss} />
  const toolbar = { cancellationAction: close, primaryAction: <Button title="刷新" action={() => loadRecent()} disabled={recentBusy} /> }
  const seasonToolbar = { cancellationAction: close, primaryAction: <Button title="同步完整赛季" action={syncSeason} disabled={seasonBusy || (recentBusy && !schedule.length)} /> }
  const switcher = <Picker title="查看" value={recent} onChanged={setRecent} pickerStyle="segmented" padding={{ horizontal: 20 }}>
    <Text tag="赛程">赛程</Text><Text tag="赛果">赛果</Text><Text tag="排行">排行</Text>
  </Picker>
  function updateGame(game: Game) {
    setSeason(prior => prior ? { ...prior, games: prior.games.map(item => item.id === game.id ? game : item) } : prior)
    setRecentGames(prior => prior.map(item => item.id === game.id ? game : item))
  }
  function matchSection(date: string, items: Game[]) {
    return <Section key={date} header={<Text font="headline" foregroundStyle={c.secondary}>{date}</Text>}>
      {items.map(game => <NavigationLink key={game.id} destination={<Detail game={game} onUpdated={updateGame} />} buttonStyle="plain" listRowSeparator="hidden"><Surface><MatchRow game={game} /></Surface></NavigationLink>)}
    </Section>
  }
  function filterRow(title: string, picker: VirtualNode) {
    return <HStack spacing={12} frame={{ minHeight: 44 }}><Text font="subheadline" foregroundStyle={c.secondary} frame={{ width: 44, alignment: "leading" }}>{title}</Text>{picker}</HStack>
  }
  return <TabView selection={tab}>
    <Tab title="近日" systemImage="basketball" value={0}><NavigationStack>{recent === "排行"
      ? <StandingsPage active={tab.value === 0} switcher={switcher} close={dismiss} />
      : <VStack spacing={12} navigationTitle="近日赛程" navigationBarTitleDisplayMode="inline" navigationContainerBackground={c.background} toolbar={toolbar}>
        {switcher}
        {recentBusy && !recentGroups.length ? <ProgressView title="正在刷新比赛" /> : null}
        {recentError ? <Text font="caption" foregroundStyle={c.secondary}>{recentGroups.length ? "更新失败，显示上次比赛数据" : recentError}</Text> : null}
        <List listStyle="plain" scrollContentBackground="hidden">
          {recentGroups.map(group => matchSection(group.date, group.games))}
          {!recentBusy && !recentError && !recentGroups.length ? <Text foregroundStyle={c.secondary}>暂无可用比赛</Text> : null}
        </List>
      </VStack>}</NavigationStack></Tab>
    <Tab title="赛季" systemImage="calendar" value={1}><NavigationStack>{focused ? <VStack><Button title="返回赛程" action={() => { locate(schedule); setFocus("") }} buttonStyle="bordered" frame={{ minHeight: 44 }} /><Detail game={focused} onUpdated={updateGame} /></VStack> : <VStack spacing={8} navigationTitle="赛季赛程" navigationBarTitleDisplayMode="inline" navigationContainerBackground={c.background} toolbar={seasonToolbar}>
      {season ? <HStack spacing={12} padding={{ horizontal: 20 }}><Button title={filtersExpanded ? "收起筛选 ↑" : "展开筛选 ↓"} buttonStyle="bordered" frame={{ minHeight: 44 }} action={() => setFiltersExpanded(value => !value)} /><Text font="caption" foregroundStyle={c.secondary} lineLimit={1} frame={{ maxWidth: "infinity", alignment: "trailing" }}>{[phase.replace("NBA", "") || "全部阶段", season.teams.find(t => t.id === team)?.name, day || month].filter(Boolean).join(" · ")}</Text></HStack> : null}
      {season && filtersExpanded ? <VStack spacing={0} padding={{ horizontal: 20 }}>
        {filterRow("阶段", <Picker title="阶段" labelsHidden value={phase} onChanged={(value: string) => { setPhase(value); setDay("") }} pickerStyle="menu" frame={{ maxWidth: "infinity", alignment: "trailing" }}><Text tag="">全部阶段</Text>{[...new Set(season.games.map(g => g.phase))].map(p => <Text key={p} tag={p}>{p}</Text>)}</Picker>)}<Divider />
        {filterRow("球队", <Picker title="球队" labelsHidden value={team} onChanged={setTeam} pickerStyle="menu" frame={{ maxWidth: "infinity", alignment: "trailing" }}><Text tag="">全部球队</Text>{season.teams.map(t => <Text key={t.id} tag={t.id}>{t.name}</Text>)}</Picker>)}<Divider />
        {filterRow("月份", <Picker title="月份" labelsHidden value={month} onChanged={(value: string) => { setMonth(value); setDay("") }} pickerStyle="menu" frame={{ maxWidth: "infinity", alignment: "trailing" }}><Text tag="">整个赛季</Text>{months.map(m => <Text key={m} tag={m}>{m}</Text>)}</Picker>)}<Divider />
        {filterRow("日期", <Picker title="日期" labelsHidden value={day} onChanged={setDay} pickerStyle="menu" frame={{ maxWidth: "infinity", alignment: "trailing" }}><Text tag="">全部日期</Text>{dates.map(d => <Text key={d} tag={d}>{d}</Text>)}</Picker>)}
        <HStack spacing={12} padding={{ top: 8 }}><Button title="回到今天" buttonStyle="bordered" frame={{ maxWidth: "infinity", minHeight: 44 }} action={() => { const today = beijingDate(Date.now()); setPhase(""); setTeam(""); setMonth(today.slice(0, 7)); setDay(today) }} /><Button title="完整赛季" buttonStyle="bordered" frame={{ maxWidth: "infinity", minHeight: 44 }} action={() => { setMonth(""); setDay(""); setTeam(""); setPhase("") }} /></HStack>
      </VStack> : null}
      {seasonBusy ? <ProgressView title={progress || "正在同步完整赛季"} /> : null}
      {seasonError ? <Text font="caption" foregroundStyle={c.secondary}>{seasonError}</Text> : null}
      {!season && !seasonBusy && schedule.length ? <Text font="caption" foregroundStyle={c.secondary}>当前显示近期比赛</Text> : null}
      <List listStyle="plain" scrollContentBackground="hidden">
        {groups.map(date => matchSection(date, games.filter(g => g.date === date)))}
        {season && !seasonBusy && !games.length ? <VStack><Text>所选范围暂无比赛</Text><Button title="查看未来比赛日" buttonStyle="bordered" action={() => { const next = nextDays(schedule)[0]; setPhase(""); setTeam(""); setDay(next?.date ?? ""); setMonth(next?.date.slice(0, 7) ?? "") }} /></VStack> : null}
        {focus && !focused && !recentBusy && !seasonBusy ? <Text>找不到指定比赛</Text> : null}
      </List>
    </VStack>}</NavigationStack></Tab>
    <Tab title="组件" systemImage="square.grid.2x2" value={2}><NavigationStack><VStack alignment="leading" spacing={24} padding={24} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }} navigationTitle="桌面组件" navigationBarTitleDisplayMode="inline" navigationContainerBackground={c.background} toolbar={{ cancellationAction: close }}>
      {([{ title: "小号", family: "systemSmall" }, { title: "中号", family: "systemMedium" }, { title: "大号", family: "systemLarge" }, { title: "超大号", family: "systemExtraLarge" }] as { title: string; family: WidgetFamily }[]).map(size => <Button key={size.family} title={`预览${size.title}组件`} buttonStyle="bordered" frame={{ maxWidth: "infinity", minHeight: 44 }} action={async () => { setPreviewError(""); try { await Widget.preview({ family: size.family }) } catch (e) { setPreviewError(String(e)) } }} />)}
      {previewError ? <Text foregroundStyle={c.secondary}>预览暂时不可用</Text> : null}
    </VStack></NavigationStack></Tab>
  </TabView>
}

async function main() {
  try { await Navigation.present(<App />) }
  finally { Script.exit() }
}
main()
