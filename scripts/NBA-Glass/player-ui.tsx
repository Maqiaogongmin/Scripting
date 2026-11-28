import { BarChart, Button, Chart, HStack, LineChart, List, Picker, ProgressView, Text, VStack, useEffect, useRef, useState } from "scripting"
import { api } from "./runtime/client"
import { readCache, saveCache } from "./runtime/cache"
import { expectedYear } from "./runtime/service"
import { careerPlayerSeasons, playerBio, playerNumbers, recentPlayerGames, type PlayerMetric, type PlayerProfileData, type PlayerTrend } from "./runtime/player"
import { Avatar, colors, Surface } from "./ui"

export type PlayerIdentity = { id: string; name: string; avatar: string }

export function PlayerButton({ player, subtitle, onOpen, compact = false }: { player: PlayerIdentity; subtitle: string; onOpen: (player: PlayerIdentity) => void; compact?: boolean }) {
  const c = colors()
  return <Button action={() => onOpen(player)} buttonStyle="plain" accessibilityLabel={`查看${player.name}的资料`}>
    <HStack spacing={compact ? 5 : 12} frame={{ minHeight: 44, alignment: "leading" }} contentShape="rect">
      <Avatar url={player.avatar} name={player.name} size={compact ? 22 : 44} />
      <VStack alignment="leading" spacing={1}>
        <Text font={compact ? "caption" : "headline"} foregroundStyle={c.primary} lineLimit={2}>{player.name}</Text>
        {subtitle ? <Text font={compact ? "caption2" : "caption"} foregroundStyle={c.secondary} lineLimit={compact ? 1 : 2}>{subtitle}</Text> : null}
      </VStack>
    </HStack>
  </Button>
}

function MetricGrid({ title, metrics, career }: { title: string; metrics: PlayerMetric[]; career: boolean }) {
  const c = colors()
  const rows = Array.from({ length: Math.ceil(metrics.length / 3) }, (_, i) => metrics.slice(i * 3, i * 3 + 3))
  return <Surface><VStack alignment="leading" spacing={12}>
    <Text font="headline" foregroundStyle={c.primary}>{title}</Text>
    {rows.map((row, i) => <HStack key={i} alignment="top" spacing={6}>
      {row.map(stat => <VStack key={stat.title} alignment="leading" spacing={3} frame={{ maxWidth: "infinity", alignment: "topLeading" }}>
        <Text font="title3" fontWeight="semibold" foregroundStyle={c.primary} monospacedDigit lineLimit={1}>{stat.value}</Text>
        <Text font="caption" foregroundStyle={c.secondary} lineLimit={1}>{stat.title}</Text>
        {stat.rank ? <Text font="caption2" foregroundStyle={c.accent}>{`${career ? "历史" : "联盟"}第 ${stat.rank}`}</Text> : null}
      </VStack>)}
    </HStack>)}
  </VStack></Surface>
}

function Shooting({ metrics }: { metrics: PlayerMetric[] }) {
  const c = colors()
  const marks = metrics.flatMap(metric => {
    const value = Number.parseFloat(metric.value)
    return metric.value.endsWith("%") && value >= 0 && value <= 100
      ? [{ label: metric.title.replace("命中率", ""), value, foregroundStyle: c.accent }]
      : []
  })
  return marks.length ? <Surface><VStack alignment="leading" spacing={4}>
    <Text font="headline" foregroundStyle={c.primary}>命中率</Text>
    <Chart frame={{ height: 100 }} chartXScale={{ from: 0, to: 100 }}>
      <BarChart labelOnYAxis marks={marks} />
    </Chart>
    <Text font="caption" foregroundStyle={c.secondary}>{marks.map(mark => `${mark.label} ${mark.value.toFixed(1)}%`).join("   ·   ")}</Text>
  </VStack></Surface> : null
}

function Trend({ rows, career }: { rows: PlayerTrend[]; career: boolean }) {
  const c = colors()
  const [stat, setStat] = useState("pts")
  const metric = stat === "reb" ? "reb" : stat === "ast" ? "ast" : "pts"
  const labels = rows.map(row => row.label)
  return <Surface><VStack alignment="leading" spacing={10}>
    <Text font="headline" foregroundStyle={c.primary}>{career ? "历季场均走势" : "近十次出场走势"}</Text>
    <Picker title="走势指标" pickerStyle="segmented" value={stat} onChanged={setStat}>
      <Text tag="pts">得分</Text><Text tag="reb">篮板</Text><Text tag="ast">助攻</Text>
    </Picker>
    <Chart frame={{ height: 152 }} chartXScale={labels} chartXAxis="hidden">
      <LineChart marks={rows.map(row => ({ label: row.label, value: row[metric], foregroundStyle: c.accent, symbol: "circle" }))} />
    </Chart>
    <HStack>
      <Text font="caption2" foregroundStyle={c.secondary} frame={{ maxWidth: "infinity", alignment: "leading" }}>{labels[0]}</Text>
      <Text font="caption2" foregroundStyle={c.secondary}>{labels.at(-1) ?? ""}</Text>
    </HStack>
    <HStack spacing={4}>
      <Text font="caption2" foregroundStyle={c.secondary} frame={{ maxWidth: "infinity", alignment: "leading" }}>{career ? "赛季" : "日期 · 对手"}</Text>
      {["得分", "篮板", "助攻"].map(label => <Text key={label} font="caption2" foregroundStyle={c.secondary} frame={{ width: 42, alignment: "trailing" }}>{label}</Text>)}
    </HStack>
    {[...rows].reverse().map(row => <HStack key={row.label} spacing={4}>
      <Text font="caption" foregroundStyle={c.primary} lineLimit={1} frame={{ maxWidth: "infinity", alignment: "leading" }}>{`${row.label} · ${row.detail}`}</Text>
      {(["pts", "reb", "ast"] as const).map(key => <Text key={key} font="caption" foregroundStyle={key === metric ? c.accent : c.primary} monospacedDigit frame={{ width: 42, alignment: "trailing" }}>{career ? row[key].toFixed(1) : String(row[key])}</Text>)}
    </HStack>)}
  </VStack></Surface>
}

export function PlayerProfile({ player }: { player: PlayerIdentity }) {
  const c = colors()
  const year = expectedYear()
  const key = `player-${year}-${player.id}`
  const [data, setData] = useState<PlayerProfileData>({})
  const [mode, setMode] = useState("本赛季")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const loading = useRef(false)

  async function load() {
    if (loading.current) return
    loading.current = true
    setBusy(true); setError("")
    try {
      const prior = (await readCache<PlayerProfileData>(key))?.value ?? {}
      const previous = { ...prior, ...data }
      setData(previous)
      const [bio, season, career, recent, history] = await Promise.allSettled([
        playerBio(api, player.id), playerNumbers(api, player.id, year, false), playerNumbers(api, player.id, year, true),
        recentPlayerGames(api, player.id, year), careerPlayerSeasons(api, player.id),
      ])
      const updated = { ...previous }
      if (bio.status === "fulfilled") updated.bio = bio.value
      if (season.status === "fulfilled") updated.season = season.value
      if (career.status === "fulfilled") updated.career = career.value
      if (recent.status === "fulfilled") updated.recent = recent.value
      if (history.status === "fulfilled") updated.history = history.value
      setData(updated)
      const results = [bio, season, career, recent, history]
      if (results.some(result => result.status === "fulfilled")) {
        await saveCache(key, updated)
      }
      if (results.some(result => result.status === "rejected")) {
        setError(Object.keys(updated).length ? "部分资料更新失败" : "球员资料加载失败")
      }
    } catch { setError("球员资料更新失败") }
    finally { loading.current = false; setBusy(false) }
  }

  useEffect(() => { void load() }, [player.id])
  const bio = data.bio
  const career = mode === "生涯"
  const stats = (career ? data.career : data.season) ?? []
  const base = stats.filter(stat => !stat.group && stat.value !== "—")
  const extra = stats.filter(stat => stat.group && stat.value !== "—")
  const shooting = base.filter(stat => ["投篮命中率", "三分命中率", "罚球命中率"].includes(stat.title))
  const trend = career ? data.history : data.recent
  return <VStack spacing={8} navigationTitle="球员资料" navigationBarTitleDisplayMode="inline" navigationContainerBackground={c.background}
    toolbar={{ primaryAction: <Button title="刷新" action={load} disabled={busy} /> }}>
    <List listStyle="plain" scrollContentBackground="hidden">
      <Surface><VStack alignment="leading" spacing={10}>
        <HStack spacing={14}>
          <Avatar url={bio?.avatar || player.avatar} name={player.name} size={60} />
          <VStack alignment="leading" spacing={4}>
            <Text font="title2" fontWeight="bold" foregroundStyle={c.primary}>{bio?.name || player.name}</Text>
            {bio ? <Text font="subheadline" foregroundStyle={c.secondary}>{[bio.team, bio.position].filter(Boolean).join(" · ")}</Text> : null}
          </VStack>
        </HStack>
        {bio ? <VStack alignment="leading" spacing={5}>
          <Text font="subheadline" foregroundStyle={c.primary}>{`身高 ${bio.height}  ·  体重 ${bio.weight}`}</Text>
          <Text font="subheadline" foregroundStyle={c.primary}>{`选秀  ${bio.draft}`}</Text>
        </VStack> : null}
      </VStack></Surface>
      <Picker title="统计范围" value={mode} onChanged={setMode} pickerStyle="segmented"><Text tag="本赛季">本赛季</Text><Text tag="生涯">生涯</Text></Picker>
      {busy ? <ProgressView /> : null}
      {error ? <Text font="caption" foregroundStyle={c.secondary}>{error}</Text> : null}
      {base.length ? <MetricGrid title={career ? "生涯总计 · 常规赛" : `${year}–${String(year + 1).slice(-2)} 常规赛`} metrics={base} career={career} /> : null}
      {shooting.length ? <Shooting metrics={shooting} /> : null}
      {trend?.length ? <Trend key={mode} rows={trend} career={career} /> : null}
      {extra.length ? <MetricGrid title={career ? "生涯单场最高" : "进阶数据"} metrics={extra} career={career} /> : null}
      {!busy && !base.length && !trend?.length && !error ? <Text foregroundStyle={c.secondary}>暂无统计</Text> : null}
      <Text font="caption" foregroundStyle={c.secondary}>来源：虎扑</Text>
    </List>
  </VStack>
}
