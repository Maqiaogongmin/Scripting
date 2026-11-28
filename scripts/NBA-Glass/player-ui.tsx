import { Button, Chart, Divider, HStack, LineChart, ScrollView, Picker, ProgressView, Text, VStack, useEffect, useRef, useState } from "scripting"
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

function StatValue({ stat, career, prominent = false }: { stat: PlayerMetric; career: boolean; prominent?: boolean }) {
  const c = colors()
  return <VStack alignment="leading" spacing={4} frame={{ maxWidth: "infinity", alignment: "leading" }}>
    <Text font={prominent ? "title" : "title3"} fontWeight="semibold" foregroundStyle={c.primary} monospacedDigit>{stat.value}</Text>
    <Text font="caption" foregroundStyle={c.secondary} fixedSize={{ horizontal: false, vertical: true }}>{stat.title.replace(/^场均|^总|^单场/, "")}</Text>
    {stat.rank ? <Text font="caption2" foregroundStyle={c.accent}>{`${career ? "历史" : "联盟"}第 ${stat.rank}`}</Text> : null}
  </VStack>
}

function StatList({ title, metrics, career }: { title: string; metrics: PlayerMetric[]; career: boolean }) {
  const c = colors()
  return metrics.length ? <Surface><VStack alignment="leading" spacing={0} fixedSize={{ horizontal: false, vertical: true }}>
    <Text font="headline" foregroundStyle={c.primary} padding={{ bottom: 10 }}>{title}</Text>
    {metrics.map((stat, i) => <VStack key={stat.title} spacing={0}>
      {i ? <Divider /> : null}
      <HStack spacing={12} padding={{ vertical: 10 }}>
        <Text font="subheadline" foregroundStyle={c.secondary} fixedSize={{ horizontal: false, vertical: true }} frame={{ maxWidth: "infinity", alignment: "leading" }}>{stat.title}</Text>
        <VStack alignment="trailing" spacing={2}>
          <Text font="headline" foregroundStyle={c.primary} monospacedDigit>{stat.value}</Text>
          {stat.rank ? <Text font="caption2" foregroundStyle={c.accent}>{`${career ? "历史" : "联盟"}第 ${stat.rank}`}</Text> : null}
        </VStack>
      </HStack>
    </VStack>)}
  </VStack></Surface> : null
}

function Shooting({ metrics, career }: { metrics: PlayerMetric[]; career: boolean }) {
  const c = colors()
  const marks = metrics.filter(metric => metric.value.endsWith("%"))
  return marks.length ? <Surface><VStack alignment="leading" spacing={18} fixedSize={{ horizontal: false, vertical: true }}>
    <Text font="headline" foregroundStyle={c.primary}>{career ? "生涯投篮表现" : "本赛季投篮表现"}</Text>
    {marks.map(stat => <VStack key={stat.title} spacing={7}>
      <HStack spacing={12}>
        <Text font="subheadline" foregroundStyle={c.secondary} frame={{ maxWidth: "infinity", alignment: "leading" }}>{stat.title.replace("命中率", "")}</Text>
        <Text font="headline" foregroundStyle={c.primary} monospacedDigit>{stat.value}</Text>
        {stat.rank ? <Text font="caption2" foregroundStyle={c.accent}>{`第 ${stat.rank}`}</Text> : null}
      </HStack>
      <ProgressView value={Number.parseFloat(stat.value)} total={100} progressViewStyle="linear" tint={c.accent} />
    </VStack>)}
  </VStack></Surface> : null
}

function Trend({ rows, career }: { rows: PlayerTrend[]; career: boolean }) {
  const c = colors()
  const [stat, setStat] = useState("pts")
  const metric = stat === "reb" ? "reb" : stat === "ast" ? "ast" : "pts"
  const labels = rows.map(row => row.label)
  return <Surface><VStack alignment="leading" spacing={16} fixedSize={{ horizontal: false, vertical: true }}>
    <Text font="headline" foregroundStyle={c.primary}>{career ? "历季场均" : "近十次出场"}</Text>
    <Picker title="走势指标" pickerStyle="segmented" value={stat} onChanged={setStat}>
      <Text tag="pts">得分</Text><Text tag="reb">篮板</Text><Text tag="ast">助攻</Text>
    </Picker>
    <Chart frame={{ height: 210 }} chartXScale={labels} chartXAxis="hidden" chartLegend="hidden">
      <LineChart marks={rows.map(row => ({ label: row.label, value: row[metric], foregroundStyle: c.accent, symbol: "circle" }))} />
    </Chart>
    <HStack>
      <Text font="caption2" foregroundStyle={c.secondary} frame={{ maxWidth: "infinity", alignment: "leading" }}>{labels[0]}</Text>
      <Text font="caption2" foregroundStyle={c.secondary}>{labels.at(-1) ?? ""}</Text>
    </HStack>
    <Divider />
    <HStack spacing={6}>
      <Text font="caption" foregroundStyle={c.secondary} frame={{ maxWidth: "infinity", alignment: "leading" }}>{career ? "赛季 · 出场" : "日期 · 对手"}</Text>
      {["得分", "篮板", "助攻"].map(label => <Text key={label} font="caption" foregroundStyle={c.secondary} frame={{ width: 38, alignment: "trailing" }}>{label}</Text>)}
    </HStack>
    {[...rows].reverse().map(row => <HStack key={row.label} spacing={6}>
      <Text font="caption" foregroundStyle={c.primary} fixedSize={{ horizontal: false, vertical: true }} frame={{ maxWidth: "infinity", alignment: "leading" }}>{`${row.label} · ${row.detail}`}</Text>
      {(["pts", "reb", "ast"] as const).map(key => <Text key={key} font="caption" foregroundStyle={key === metric ? c.accent : c.primary} monospacedDigit frame={{ width: 38, alignment: "trailing" }}>{career ? row[key].toFixed(1) : String(row[key])}</Text>)}
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
  const base = stats.filter(stat => !stat.group)
  const extra = stats.filter(stat => stat.group)
  const shooting = base.filter(stat => ["投篮命中率", "三分命中率", "罚球命中率"].includes(stat.title))
  const trend = career ? data.history : data.recent
  const headline = base.filter(stat => (career ? ["总得分", "总篮板", "总助攻"] : ["场均得分", "场均篮板", "场均助攻"]).includes(stat.title))
  const other = base.filter(stat => !headline.includes(stat) && !shooting.includes(stat))
  return <ScrollView navigationTitle="球员资料" navigationBarTitleDisplayMode="inline" navigationContainerBackground={c.background}
    toolbar={{ primaryAction: <Button title="刷新" action={load} disabled={busy} /> }}>
    <VStack spacing={16} padding={{ horizontal: 16, top: 12, bottom: 36 }} frame={{ maxWidth: 760 }}>
      <Surface><VStack alignment="leading" spacing={16} fixedSize={{ horizontal: false, vertical: true }}>
        <HStack spacing={14}>
          <Avatar url={bio?.avatar || player.avatar} name={player.name} size={64} />
          <VStack alignment="leading" spacing={5} frame={{ maxWidth: "infinity", alignment: "leading" }}>
            <Text font="title2" fontWeight="bold" foregroundStyle={c.primary} fixedSize={{ horizontal: false, vertical: true }}>{bio?.name || player.name}</Text>
            {bio?.englishName ? <Text font="caption" foregroundStyle={c.secondary}>{bio.englishName}</Text> : null}
            {bio ? <Text font="subheadline" foregroundStyle={c.secondary} fixedSize={{ horizontal: false, vertical: true }}>{[bio.team, bio.position, bio.number ? `${bio.number} 号` : ""].filter(Boolean).join(" · ")}</Text> : null}
          </VStack>
        </HStack>
        {bio ? <VStack alignment="leading" spacing={8}>
          <Text font="subheadline" foregroundStyle={c.primary}>{[bio.age, bio.height, bio.weight].filter(Boolean).join(" · ")}</Text>
          <Text font="caption" foregroundStyle={c.secondary} fixedSize={{ horizontal: false, vertical: true }}>{`选秀 ${bio.draft}`}</Text>
          {[bio.birthday ? `生日 ${bio.birthday}` : "", bio.country ? `国籍 ${bio.country}` : "", bio.school ? `学校 ${bio.school}` : ""].filter(Boolean).map(text => <Text key={text} font="caption" foregroundStyle={c.secondary} fixedSize={{ horizontal: false, vertical: true }}>{text}</Text>)}
        </VStack> : null}
      </VStack></Surface>
      <Picker title="统计范围" value={mode} onChanged={setMode} pickerStyle="segmented"><Text tag="本赛季">本赛季</Text><Text tag="生涯">生涯</Text></Picker>
      {busy ? <ProgressView /> : null}
      {error ? <Text font="caption" foregroundStyle={c.secondary}>{error}</Text> : null}
      {headline.length ? <Surface><VStack alignment="leading" spacing={16} fixedSize={{ horizontal: false, vertical: true }}>
        <Text font="headline" foregroundStyle={c.primary}>{career ? "生涯累计 · 常规赛" : `${year}–${String(year + 1).slice(-2)} 常规赛 · 场均`}</Text>
        <HStack alignment="top" spacing={12}>{headline.map(stat => <StatValue key={stat.title} stat={stat} career={career} prominent />)}</HStack>
      </VStack></Surface> : null}
      {shooting.length ? <Shooting metrics={shooting} career={career} /> : null}
      {trend?.length ? <Trend key={mode} rows={trend} career={career} /> : null}
      <StatList title={career ? "生涯累计 · 常规赛" : "基础数据 · 常规赛"} metrics={other} career={career} />
      <StatList title={career ? "生涯单场最高 · 常规赛" : "进阶数据 · 常规赛"} metrics={extra} career={career} />
      {!busy && !base.length && !trend?.length && !error ? <Text foregroundStyle={c.secondary}>暂无统计</Text> : null}
      <Text font="caption2" foregroundStyle={c.secondary}>虎扑</Text>
    </VStack>
  </ScrollView>
}
