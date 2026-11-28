import { HStack, ScrollView, Text, VStack } from "scripting"
import { statColumns, type BoxScore } from "./runtime/boxscore"
import { PlayerButton, type PlayerIdentity } from "./player-ui"
import { colors } from "./ui"

export function StatsTable({ box, teamId, onPlayer }: { box: BoxScore; teamId: string; onPlayer: (player: PlayerIdentity) => void }) {
  const c = colors()
  const team = box.teams.find(item => item.id === teamId)
  if (!team?.players.length) return <Text foregroundStyle={c.secondary}>暂无技术统计</Text>
  const height = 34 + (team.players.length + 1) * 48
  const width = statColumns.reduce((n, column) => n + column.width, 0)
  function cells(values: Record<string, string>, dnp = false, bold = false) {
    return <HStack spacing={0} frame={{ height: 48 }}>{statColumns.map(column => <Text key={column.key} font="caption" fontWeight={bold ? "semibold" : "regular"} monospacedDigit foregroundStyle={column.key === "pts" ? c.accent : c.primary} lineLimit={1} frame={{ width: column.width, alignment: "center" }}>{dnp ? (column.key === "mins" ? "未上场" : "—") : values[column.key]}</Text>)}</HStack>
  }
  return <HStack alignment="top" spacing={0} frame={{ height }}>
    <VStack alignment="leading" spacing={0} frame={{ width: 112 }}>
      <Text font="caption2" foregroundStyle={c.secondary} frame={{ width: 112, height: 34, alignment: "leading" }}>球员</Text>
      {team.players.map((player, i) => <VStack key={player.id} alignment="leading" padding={{ horizontal: 3 }} frame={{ width: 112, height: 48, alignment: "leading" }} background={i % 2 === 0 ? c.surface : c.background}>
        <PlayerButton player={player} compact onOpen={onPlayer} subtitle={`#${player.number}${player.starter ? " · 先发" : ""}`} />
      </VStack>)}
      <Text font="caption" fontWeight="semibold" foregroundStyle={c.primary} frame={{ width: 112, height: 48, alignment: "leading" }} background={c.surface}>{team.totalsLabel}</Text>
    </VStack>
    <ScrollView axes="horizontal" frame={{ maxWidth: "infinity", height }}>
      <VStack spacing={0} frame={{ width }}>
        <HStack spacing={0} frame={{ height: 34 }}>{statColumns.map(column => <Text key={column.key} font="caption2" foregroundStyle={c.secondary} frame={{ width: column.width }}>{column.title}</Text>)}</HStack>
        {team.players.map((player, i) => <VStack key={player.id} spacing={0} background={i % 2 === 0 ? c.surface : c.background}>{cells(player.values, player.dnp)}</VStack>)}
        <VStack spacing={0} background={c.surface}>{cells(team.totals, false, true)}</VStack>
      </VStack>
    </ScrollView>
  </HStack>
}
