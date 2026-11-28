import { Button, fetch, HStack, List, Picker, ProgressView, Section, Text, VStack, useEffect, useRef, useState, type VirtualNode } from "scripting"
import { readCache, saveCache, type Snapshot } from "./runtime/cache"
import { beijingDate, beijingTime } from "./runtime/hupu"
import { expectedYear } from "./runtime/service"
import { parseStandings, type Conference, type Standings } from "./runtime/standings"
import { Avatar, colors } from "./ui"

export function StandingsPage({ active, switcher, close }: { active: boolean; switcher: VirtualNode; close: () => void }) {
  const c = colors()
  const seasonEnd = expectedYear() + 1
  const cacheKey = `standings-${seasonEnd}`
  const [conference, setConference] = useState<Conference>("East")
  const [snapshot, setSnapshot] = useState<Snapshot<Standings> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const loading = useRef(false)

  async function load(initial = false) {
    if (loading.current) return
    loading.current = true
    setBusy(true); setError("")
    try {
      if (initial) {
        const prior = await readCache<Standings>(cacheKey)
        if (prior) setSnapshot(prior)
      }
      const response = await fetch(`https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=${seasonEnd}`, { timeout: 12 })
      if (!response.ok) throw new Error("排行请求失败")
      const next = { value: parseStandings(await response.json(), seasonEnd), fetchedAt: Date.now() }
      setSnapshot(next)
      await saveCache(cacheKey, next.value, next.fetchedAt)
    } catch { setError("排行更新失败") }
    finally { loading.current = false; setBusy(false) }
  }

  useEffect(() => {
    if (!active) return
    void load(true)
    const timer = setInterval(() => { void load() }, 60_000)
    return () => clearInterval(timer)
  }, [active, seasonEnd])

  function cell(value: string, width: number, header = false) {
    return <Text font={header ? "caption2" : "subheadline"} foregroundStyle={header ? c.secondary : c.primary} monospacedDigit lineLimit={1}
      frame={{ width, alignment: "trailing" }}>{value}</Text>
  }
  const updatedAt = snapshot ? `${beijingDate(snapshot.fetchedAt).slice(5)} ${beijingTime(snapshot.fetchedAt)}` : ""
  return <VStack spacing={10} navigationTitle="球队排行" navigationBarTitleDisplayMode="inline" navigationContainerBackground={c.background}
    toolbar={{ cancellationAction: <Button title="关闭" action={close} />, primaryAction: <Button title="刷新" action={() => load()} disabled={busy} /> }}>
    {switcher}
    <Picker title="分区" value={conference} onChanged={(value: string) => { if (value === "East" || value === "West") setConference(value) }} pickerStyle="segmented" padding={{ horizontal: 20 }}>
      <Text tag="East">东部</Text><Text tag="West">西部</Text>
    </Picker>
    {busy && !snapshot ? <ProgressView /> : null}
    {error ? <Text font="caption" foregroundStyle={c.secondary}>{snapshot ? "更新失败，显示上次排行" : error}</Text> : null}
    <List listStyle="plain" scrollContentBackground="hidden">
      {snapshot ? <Section header={<VStack spacing={5}>
        <Text font="caption2" foregroundStyle={c.secondary} frame={{ maxWidth: "infinity", alignment: "leading" }}>{`ESPN · ${updatedAt} 更新（北京时间）`}</Text>
        <HStack spacing={6}>
          {cell("名次", 26, true)}
          <Text font="caption2" foregroundStyle={c.secondary} frame={{ maxWidth: "infinity", alignment: "leading" }}>球队</Text>
          {cell("胜", 22, true)}{cell("负", 22, true)}{cell("胜率", 52, true)}{cell("胜场差", 46, true)}
        </HStack>
      </VStack>}>
        {snapshot.value[conference].map(team => <HStack key={team.id} spacing={6} frame={{ minHeight: 36 }}>
          {cell(String(team.rank), 26)}
          <HStack spacing={5} frame={{ maxWidth: "infinity", alignment: "leading" }}>
            <Avatar url={team.logo} name={team.name} size={23} />
            <Text font="subheadline" fontWeight="semibold" foregroundStyle={c.primary} lineLimit={1}>{team.name}</Text>
          </HStack>
          {cell(String(team.wins), 22)}{cell(String(team.losses), 22)}
          {cell(`${(100 * team.winPercent).toFixed(1)}%`, 52)}{cell(team.gamesBehind ? String(team.gamesBehind) : "—", 46)}
        </HStack>)}
      </Section> : null}
    </List>
  </VStack>
}
