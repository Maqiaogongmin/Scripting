import { Device, HStack, Image, Text, VStack, ZStack, useColorScheme, type VirtualNode } from "scripting"
import { beijingTime, type Game, type Team, type Comment } from "./runtime/hupu"

export const palette = {
  light: { background: "#F2F4F7", surface: "#E8EDF3", primary: "#17212B", secondary: "#526174", accent: "#245AA6" },
  dark: { background: "#111820", surface: "#1E2935", primary: "#F1F5F9", secondary: "#B3BFCD", accent: "#8FB9F5" },
} as const
export function colors() { return palette[useColorScheme() === "dark" ? "dark" : "light"] }
export function Surface({ children }: { children?: VirtualNode | VirtualNode[] }) {
  const c = colors()
  // Neutral material under the text keeps the background from washing out glyphs.
  const glass = Number.parseInt(Device.systemVersion, 10) >= 26 && typeof UIGlass !== "undefined"
    ? { glass: UIGlass.regular().interactive(false), shape: { type: "rect" as const, cornerRadius: 16 } } : false
  return <ZStack background={c.surface} clipShape={{ type: "rect", cornerRadius: 16 }} glassEffect={glass}>
    <VStack alignment="leading" spacing={10} padding={14} frame={{ maxWidth: "infinity", alignment: "leading" }}>{children}</VStack>
  </ZStack>
}
export function Avatar({ url, name, size = 28 }: { url: string; name: string; size?: number }) {
  const c = colors()
  const fallback = <ZStack background={c.surface} frame={{ width: size, height: size }} clipShape="circle"><Text font="caption2" fontWeight="semibold" foregroundStyle={c.secondary}>{name.slice(0, 1)}</Text></ZStack>
  return url ? <Image imageUrl={url} placeholder={fallback} resizable scaleToFit frame={{ width: size, height: size }} clipShape="circle" accessibilityLabel={name} /> : fallback
}
export function TeamLabel({ team }: { team: Team }) {
  const c = colors()
  return <HStack spacing={6}><Avatar url={team.logo} name={team.name} size={24} /><Text font="subheadline" fontWeight="semibold" foregroundStyle={c.primary} lineLimit={1}>{team.name}</Text></HStack>
}
export function MatchRow({ game, compact = false }: { game: Game; compact?: boolean }) {
  const c = colors()
  const [a, b] = game.teams
  const score = a.score != null && b.score != null && game.status !== "NOTSTARTED" ? `${a.score} : ${b.score}` : beijingTime(game.time)
  return <HStack spacing={8} frame={{ maxWidth: "infinity" }}>
    <VStack alignment="leading" spacing={3} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      {compact ? <HStack spacing={4}><Avatar url={a.logo} name={a.name} size={18} /><Text font="caption" foregroundStyle={c.primary} lineLimit={1}>{a.name}</Text><Text font="caption2" foregroundStyle={c.secondary}>·</Text><Avatar url={b.logo} name={b.name} size={18} /><Text font="caption" foregroundStyle={c.primary} lineLimit={1}>{b.name}</Text></HStack> : <HStack spacing={5}><TeamLabel team={a} /><Text font="caption" foregroundStyle={c.secondary}>·</Text><TeamLabel team={b} /></HStack>}
      {!compact ? <Text font="caption" foregroundStyle={c.secondary}>{game.phase}</Text> : null}
    </VStack>
    <VStack alignment="trailing" spacing={3}>
      <Text font={compact ? "caption" : "headline"} fontWeight="semibold" foregroundStyle={c.primary}>{score}</Text>
      <Text font="caption2" foregroundStyle={c.secondary}>{game.statusText}</Text>
    </VStack>
  </HStack>
}
export function CommentCard({ comment }: { comment: Comment }) {
  const c = colors()
  return <VStack alignment="leading" spacing={6} padding={{ vertical: 8 }}>
    <HStack><Text font="caption" foregroundStyle={c.secondary}>{comment.user}</Text><Text font="caption2" foregroundStyle={c.secondary}>{` · ${comment.likes} 赞${comment.date ? " · " + comment.date : ""}`}</Text></HStack>
    <Text font="subheadline" foregroundStyle={c.primary}>{comment.text || "图片或附件评论，请打开原文查看"}</Text>
  </VStack>
}
