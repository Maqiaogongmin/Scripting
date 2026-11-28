import { Button, HStack, List, NavigationLink, Picker, ProgressView, Section, Text, VStack, useEffect, useRef, useState } from "scripting"
import { api } from "./runtime/client"
import { readCache, saveCache } from "./runtime/cache"
import { expectedYear } from "./runtime/service"
import { playerBio, playerNumbers, type PlayerProfileData } from "./runtime/player"
import { Avatar, colors, Surface } from "./ui"

type Identity = { id: string; name: string; avatar: string }

export function PlayerLink({ player, subtitle, compact = false }: { player: Identity; subtitle: string; compact?: boolean }) {
  const c = colors()
  return <NavigationLink destination={<PlayerProfile player={player} />} buttonStyle="plain" accessibilityLabel={`查看${player.name}的资料`}>
    <HStack spacing={compact ? 5 : 12} frame={{ minHeight: 44, alignment: "leading" }}>
      <Avatar url={player.avatar} name={player.name} size={compact ? 22 : 44} />
      <VStack alignment="leading" spacing={1}>
        <Text font={compact ? "caption" : "headline"} foregroundStyle={c.primary} lineLimit={2}>{player.name}</Text>
        {subtitle ? <Text font={compact ? "caption2" : "caption"} foregroundStyle={c.secondary} lineLimit={compact ? 1 : 2}>{subtitle}</Text> : null}
      </VStack>
    </HStack>
  </NavigationLink>
}

export function PlayerProfile({ player }: { player: Identity }) {
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
      const [bio, season, career] = await Promise.allSettled([
        playerBio(api, player.id), playerNumbers(api, player.id, year, false), playerNumbers(api, player.id, year, true),
      ])
      const updated = { ...previous }
      if (bio.status === "fulfilled") updated.bio = bio.value
      if (season.status === "fulfilled") updated.season = season.value
      if (career.status === "fulfilled") updated.career = career.value
      setData(updated)
      if (bio.status === "fulfilled" || season.status === "fulfilled" || career.status === "fulfilled") {
        await saveCache(key, updated)
      }
      if (bio.status === "rejected" || season.status === "rejected" || career.status === "rejected") {
        setError(updated.bio || updated.season || updated.career ? "部分资料更新失败" : "球员资料加载失败")
      }
    } catch { setError("球员资料更新失败") }
    finally { loading.current = false; setBusy(false) }
  }

  useEffect(() => { void load() }, [player.id])
  const bio = data.bio
  const stats = mode === "生涯" ? data.career : data.season
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
      <Section header={<Text foregroundStyle={c.secondary}>{mode === "生涯" ? "生涯常规赛" : `${year}–${String(year + 1).slice(-2)} 常规赛`}</Text>}>
        {stats?.map(stat => <HStack key={stat.title} spacing={10}>
          <Text foregroundStyle={c.primary} frame={{ maxWidth: "infinity", alignment: "leading" }}>{stat.title}</Text>
          <Text foregroundStyle={c.primary} fontWeight="semibold" monospacedDigit>{stat.value}</Text>
          {stat.rank ? <Text font="caption" foregroundStyle={c.accent} frame={{ minWidth: 62, alignment: "trailing" }}>{`${mode === "生涯" ? "历史" : "联盟"}第 ${stat.rank}`}</Text> : null}
        </HStack>)}
        {!busy && (stats?.length === 0 || (!stats && !error)) ? <Text foregroundStyle={c.secondary}>暂无统计</Text> : null}
      </Section>
      <Text font="caption" foregroundStyle={c.secondary}>来源：虎扑</Text>
    </List>
  </VStack>
}
