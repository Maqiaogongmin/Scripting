import {
  Button, EnvironmentValuesReader, HStack, Image, Link, Rectangle, RoundedRectangle,
  Script, Spacer, Text, VStack, Widget, ZStack, gradient, type Color,
} from "scripting"
import { NextCoverIntent } from "./app_intents"
import { readCovers, readThumbnail } from "./covers"
import { typeName, type CoverEntry } from "./douban"

const homeUrl = Script.createRunURLScheme(Script.name)
const switchIcon = "arrow.triangle.2.circlepath"
const full = { maxWidth: "infinity", maxHeight: "infinity" } as const
const textShadow = { color: "rgba(0,0,0,0.45)", radius: 3, x: 0, y: 1 } as const
const coverShadow = { color: "rgba(0,0,0,0.18)", radius: 5, x: 0, y: 3 } as const
const shade = gradient("linear", {
  colors: ["clear", "rgba(0,0,0,0.78)"],
  startPoint: "center",
  endPoint: "bottom",
})

type Theme = {
  background: Color
  primary: Color
  secondary: Color
  accent: Color
  stroke: Color
  shadow?: typeof textShadow
}
type CoverCard = {
  entry: CoverEntry
  image?: UIImage
  position: number
  count: number
  theme: Theme
  detailUrl: string
}

function Poster({ image, width, height, radius, theme, lifted = false }: {
  image?: UIImage; width: number; height: number; radius: number; theme: Theme; lifted?: boolean
}) {
  const frame = { width, height }
  return <ZStack frame={frame}
    clipShape={{ type: "rect", cornerRadius: radius }}
    overlay={<RoundedRectangle cornerRadius={radius} stroke={{ shapeStyle: theme.stroke, strokeStyle: { lineWidth: 0.5 } }}
      allowsHitTesting={false} />}
    shadow={lifted ? coverShadow : undefined} accessibilityHidden>
    {image
      ? <Image image={image} resizable scaleToFit frame={frame} widgetAccentedRenderingMode="fullColor" />
      : <Image systemName="photo" foregroundStyle={theme.secondary} frame={frame} />}
  </ZStack>
}

function Score({ entry, theme, large }: { entry: CoverEntry; theme: Theme; large?: boolean }) {
  return entry.rating > 0
    ? <HStack alignment="firstTextBaseline" spacing={4}>
        <Text font={large ? "title" : "title2"} fontDesign="serif" monospacedDigit fontWeight="semibold"
          foregroundStyle={theme.accent} shadow={theme.shadow}>{entry.rating.toFixed(1)}</Text>
        <Text font="caption2" foregroundStyle={theme.secondary} shadow={theme.shadow}>豆瓣</Text>
      </HStack>
    : <Text font="caption2" foregroundStyle={theme.secondary} shadow={theme.shadow}>暂无评分</Text>
}

function Position({ value, count, theme }: { value: number; count: number; theme: Theme }) {
  return <Text font="caption2" foregroundStyle={theme.secondary} opacity={0.65} shadow={theme.shadow}
    monospacedDigit>{`${value}/${count}`}</Text>
}

function NextButton({ theme }: { theme: Theme }) {
  return <Button intent={NextCoverIntent(undefined)} buttonStyle="bordered"
    buttonBorderShape="capsule" controlSize="small" tint={theme.accent}>
    <HStack spacing={4} accessibilityLabel="换一张">
      <Image systemName={switchIcon} font="caption2" foregroundStyle={theme.accent}
        shadow={theme.shadow} accessibilityHidden />
      <Text font="caption2" fontWeight="semibold" foregroundStyle={theme.accent}
        shadow={theme.shadow}>换一张</Text>
    </HStack>
  </Button>
}

function SmallCard({ entry, image, count, detailUrl }: CoverCard) {
  const { width, height } = Widget.displaySize
  return <ZStack alignment="topTrailing" frame={{ width, height }} widgetURL={detailUrl} widgetBackground="#302A24">
    <ZStack alignment="bottomLeading" frame={{ width, height }}>
      {image
        ? <Image image={image} resizable scaleToFill frame={{ width, height }} clipped
            widgetAccentedRenderingMode="fullColor" accessibilityHidden />
        : <Image systemName="photo" font="title" foregroundStyle="#BEB2A3" frame={{ width, height }}
            background="#302A24" accessibilityHidden />}
      <Rectangle fill={shade} allowsHitTesting={false} accessibilityHidden />
      <VStack alignment="leading" spacing={2} padding={12}>
        <Text font="headline" fontWeight="bold" fontDesign="serif" lineLimit={2}
          foregroundStyle="white">{entry.title}</Text>
        {entry.rating > 0
          ? <Text font="title3" fontDesign="serif" monospacedDigit foregroundStyle="white"
              accessibilityLabel={`豆瓣 ${entry.rating.toFixed(1)}`}>{entry.rating.toFixed(1)}</Text>
          : <Text font="caption2" foregroundStyle="rgba(255,255,255,0.8)">暂无评分</Text>}
      </VStack>
    </ZStack>
    {count > 1
      ? <Button intent={NextCoverIntent(undefined)} buttonStyle="plain" padding={11}
          accessibilityLabel="换一张">
          <Image systemName={switchIcon} font="caption" fontWeight="semibold" foregroundStyle="white"
            frame={{ width: 28, height: 28 }} background="rgba(0,0,0,0.44)" clipShape="circle" />
        </Button>
      : null}
  </ZStack>
}

function MediumCard({ entry, image, position, count, theme, detailUrl }: CoverCard) {
  const size = Widget.displaySize
  const height = size.height - 24
  const ratio = image ? image.width / image.height : entry.type === "music" ? 1 : 0.69
  const width = Math.min(height * ratio, (size.width - 28) * 0.46)
  const byline = [typeName[entry.type], entry.subtitle].filter(Boolean).join(" · ")
  return <ZStack alignment="bottomTrailing" frame={full} padding={{ horizontal: 14, vertical: 12 }}
    widgetBackground={theme.background}>
    <Link url={detailUrl} buttonStyle="plain">
      <HStack alignment="top" spacing={12} frame={{ ...full, alignment: "topLeading" }} contentShape="rect">
        <Poster image={image} width={width} height={height} radius={10} theme={theme} />
        <VStack alignment="leading" spacing={5} frame={{ ...full, alignment: "topLeading" }}>
          <Text font="caption2" foregroundStyle={theme.secondary} shadow={theme.shadow}
            lineLimit={1}>{byline}</Text>
          <Text font="headline" fontWeight="bold" fontDesign="serif" foregroundStyle={theme.primary}
            shadow={theme.shadow} lineLimit={2}>{entry.title}</Text>
          <Spacer minLength={2} />
          <VStack alignment="leading" spacing={0}>
            <Score entry={entry} theme={theme} />
            <Position value={position} count={count} theme={theme} />
          </VStack>
        </VStack>
      </HStack>
    </Link>
    {count > 1 ? <NextButton theme={theme} /> : null}
  </ZStack>
}

function LargeCard({ entry, image, position, count, theme, detailUrl }: CoverCard) {
  const size = Widget.displaySize
  const available = size.height - 32
  const area = Math.min(available * 0.68, available - 92)
  const ratio = image ? image.width / image.height : entry.type === "music" ? 1 : 0.69
  const width = Math.min(area * ratio, size.width - 32)
  const height = width / ratio
  return <ZStack alignment="bottomTrailing" frame={full} padding={16} widgetBackground={theme.background}>
    <Link url={detailUrl} buttonStyle="plain">
      <VStack spacing={8} frame={full} contentShape="rect">
        <VStack frame={{ maxWidth: "infinity", height: area }}>
          <Poster image={image} width={width} height={height} radius={12} theme={theme} lifted />
        </VStack>
        <HStack alignment="top" spacing={10} frame={{ ...full, alignment: "topLeading" }}>
          <VStack alignment="leading" spacing={3} frame={{ maxWidth: "infinity", alignment: "leading" }}>
            <Text font="caption2" foregroundStyle={theme.secondary} shadow={theme.shadow}>{typeName[entry.type]}</Text>
            <Text font="title2" fontDesign="serif" fontWeight="bold" foregroundStyle={theme.primary}
              shadow={theme.shadow} lineLimit={2}>{entry.title}</Text>
            {entry.subtitle ? <Text font="caption" foregroundStyle={theme.secondary} shadow={theme.shadow}
                lineLimit={1}>{entry.subtitle}</Text> : null}
          </VStack>
          <VStack alignment="trailing" spacing={0}>
            <Score entry={entry} theme={theme} large />
            <Position value={position} count={count} theme={theme} />
          </VStack>
        </HStack>
      </VStack>
    </Link>
    {count > 1 ? <NextButton theme={theme} /> : null}
  </ZStack>
}

function CoverWidget({ entry, image, position, count }: {
  entry?: CoverEntry; image?: UIImage; position: number; count: number
}) {
  return <EnvironmentValuesReader keys={["colorScheme", "showsWidgetContainerBackground", "widgetRenderingMode"]}>{env => {
    const dark = env.colorScheme === "dark"
    const hasBackground = env.showsWidgetContainerBackground && !Widget.isTransparentMode && !Widget.isBlurMode
    const usePalette = hasBackground && env.widgetRenderingMode === "fullColor"
    const theme: Theme = {
      background: hasBackground ? (dark ? "#181613" : "#F5F0E7") : "clear",
      primary: usePalette ? (dark ? "#F3ECE0" : "#26211D") : "label",
      secondary: usePalette ? (dark ? "#BEB2A3" : "#655B50") : "secondaryLabel",
      accent: usePalette ? (dark ? "#E1A299" : "#7A3938") : "label",
      stroke: dark || !hasBackground ? "rgba(243,236,224,0.16)" : "rgba(38,33,29,0.12)",
      shadow: hasBackground ? undefined : textShadow,
    }
    if (!entry) return <VStack spacing={6} padding={12} frame={full}
      widgetBackground={theme.background} widgetURL={homeUrl}>
      <Image systemName="film" foregroundStyle={theme.secondary} shadow={theme.shadow} accessibilityHidden />
      <Text font="headline" fontDesign="serif" foregroundStyle={theme.primary} shadow={theme.shadow}>豆瓣书影音</Text>
      <Text font="caption" foregroundStyle={theme.secondary} shadow={theme.shadow} multilineTextAlignment="center">
        从作品详情添加一张封面
      </Text>
    </VStack>

    const detailUrl = Script.createRunURLScheme(Script.name, { type: entry.type, id: entry.id })
    const card = { entry, image, position, count, theme, detailUrl }
    switch (Widget.family) {
      case "systemSmall": return <SmallCard {...card} />
      case "systemMedium": return <MediumCard {...card} />
      case "systemLarge":
      case "systemExtraLarge":
      case "systemExtraLargePortrait": return <LargeCard {...card} />
      default: return <Text font="caption" widgetURL={detailUrl}>{entry.title}</Text>
    }
  }}</EnvironmentValuesReader>
}

async function main() {
  const list = await readCovers()
  const entry = list.items[list.index]
  const image = entry ? await readThumbnail(entry) : undefined
  Widget.present(<CoverWidget entry={entry} image={image} position={list.index + 1} count={list.items.length} />,
    { policy: "never" })
}

void main().catch(() => Widget.present(<CoverWidget count={0} position={0} />, { policy: "never" }))
