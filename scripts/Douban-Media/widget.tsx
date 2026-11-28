import {
  Button, EnvironmentValuesReader, HStack, Image, Rectangle, RoundedRectangle,
  Script, Spacer, Text, VStack, Widget, ZStack, type Color, type WidgetFamily,
} from "scripting"
import { NextCoverIntent } from "./app_intents"
import { readCovers, readThumbnail } from "./covers"
import { typeName, type CoverEntry } from "./douban"

const homeUrl = Script.createRunURLScheme(Script.name)
const switchIcon = "arrow.triangle.2.circlepath"
const full = { maxWidth: "infinity", maxHeight: "infinity" } as const
const titleFont = "STSongti-SC-Regular"
const largeFamilies: readonly WidgetFamily[] = ["systemLarge", "systemExtraLarge", "systemExtraLargePortrait"]

type Theme = {
  readingPaper: UIImage
  primary: Color
  secondary: Color
  accent: Color
  stroke: Color
}
type CoverCard = {
  entry: CoverEntry
  image?: UIImage
  coverNumber: number
  count: number
  theme: Theme
  detailUrl: string
}

function Poster({ image, width, height, radius, theme }: {
  image?: UIImage; width: number; height: number; radius: number; theme: Theme
}) {
  const frame = { width, height }
  return <ZStack frame={frame}
    clipShape={{ type: "rect", cornerRadius: radius }}
    overlay={<RoundedRectangle cornerRadius={radius} stroke={{ shapeStyle: theme.stroke, strokeStyle: { lineWidth: 0.5 } }}
      allowsHitTesting={false} />} accessibilityHidden>
    {image
      ? <Image image={image} resizable scaleToFit frame={frame} widgetAccentedRenderingMode="fullColor" />
      : <Image systemName="photo" foregroundStyle={theme.secondary} frame={frame} />}
  </ZStack>
}

function CoverFooter({ entry, coverNumber, count, theme }: Pick<CoverCard, "entry" | "coverNumber" | "count" | "theme">) {
  return <HStack alignment="firstTextBaseline" spacing={4} frame={{ height: 24 }} layoutPriority={1}>
    {entry.rating > 0 ? <>
      <Text font="caption2" monospacedDigit fontWeight="semibold"
        foregroundStyle={theme.secondary}>{entry.rating.toFixed(1)}</Text>
      <Text font="caption2" foregroundStyle={theme.secondary}>豆瓣</Text>
    </> : <Text font="caption2" foregroundStyle={theme.secondary}>暂无评分</Text>}
    <Text font="caption2" foregroundStyle={theme.secondary} opacity={0.65}
      monospacedDigit>{`· ${coverNumber}/${count}`}</Text>
  </HStack>
}

function CoverIntro({ intro, lines, theme }: { intro?: string; lines: number; theme: Theme }) {
  const text = intro?.replace(/\s+/g, " ").trim()
  return text ? <Text font="caption" foregroundStyle={theme.primary}
    lineLimit={lines} truncationMode="tail">{text}</Text> : null
}

function NextButton({ theme }: { theme: Theme }) {
  return <Button intent={NextCoverIntent(undefined)} buttonStyle="bordered"
    buttonBorderShape="capsule" controlSize="small" tint={theme.accent}>
    <HStack spacing={4} accessibilityLabel="换一张">
      <Image systemName={switchIcon} font="caption2" foregroundStyle={theme.accent} accessibilityHidden />
      <Text font="caption2" fontWeight="semibold" foregroundStyle={theme.accent}>换一张</Text>
    </HStack>
  </Button>
}

function BlurredCover({ image, width, height }: { image: UIImage; width: number; height: number }) {
  return <ZStack frame={{ width, height }} clipped allowsHitTesting={false} accessibilityHidden>
    <Image image={image} resizable scaleToFill frame={{ width, height }}
      blur={{ radius: 18, opaque: true }} widgetAccentedRenderingMode="fullColor" />
    <Rectangle fill="rgba(0,0,0,0.55)" />
  </ZStack>
}

function ReadingPaper({ image, width, height }: { image: UIImage; width: number; height: number }) {
  // A container background can disappear on the desktop. Keep the paper in the content layer.
  return <Image image={image} resizable frame={{ width, height }} widgetAccentedRenderingMode="fullColor"
    allowsHitTesting={false} accessibilityHidden />
}

function SmallCard({ entry, image, count, detailUrl }: CoverCard) {
  const { width, height } = Widget.displaySize
  const canSwitch = count > 1
  const switchSpace = canSwitch ? 28 : 0
  return <ZStack alignment="bottomTrailing" frame={{ width, height }} widgetURL={detailUrl} widgetBackground="#302A24">
    {image ? <BlurredCover image={image} width={width} height={height} /> : null}
    <VStack spacing={0} padding={{ top: 6 }} frame={{ width, height }}>
      <ZStack frame={{ width: width - 20, height: height - 38 }} accessibilityHidden>
        {image
          ? <Image image={image} resizable scaleToFit widgetAccentedRenderingMode="fullColor" />
          : <Image systemName="photo" font="title" foregroundStyle="#BEB2A3" />}
      </ZStack>
      <HStack alignment="firstTextBaseline" spacing={6}
        frame={{ width: width - 28 - switchSpace, height: 30 }} padding={{ trailing: switchSpace }}>
        <Text font="headline" fontWeight="bold" fontDesign="serif" lineLimit={1}
          foregroundStyle="white">{entry.title}</Text>
        <Spacer minLength={0} />
        {entry.rating > 0
          ? <Text font="title3" fontDesign="serif" monospacedDigit foregroundStyle="white"
              layoutPriority={1}
              accessibilityLabel={`豆瓣 ${entry.rating.toFixed(1)}`}>{entry.rating.toFixed(1)}</Text>
          : <Text font="caption2" foregroundStyle="rgba(255,255,255,0.8)" layoutPriority={1}>暂无评分</Text>}
      </HStack>
    </VStack>
    {canSwitch
      ? <Button intent={NextCoverIntent(undefined)} buttonStyle="plain" padding={{ trailing: 10, bottom: 4 }}
          accessibilityLabel="换一张">
          <Image systemName={switchIcon} font="caption" fontWeight="semibold" foregroundStyle="white"
            frame={{ width: 24, height: 24 }} background="rgba(0,0,0,0.44)" clipShape="circle" />
        </Button>
      : null}
  </ZStack>
}

function MediumCard({ entry, image, coverNumber, count, theme, detailUrl }: CoverCard) {
  const size = Widget.displaySize
  const height = size.height - 24
  const ratio = image ? image.width / image.height : entry.type === "music" ? 1 : 0.69
  const width = Math.min(height * ratio, (size.width - 28) * 0.46)
  const byline = [typeName[entry.type], entry.subtitle].filter(Boolean).join(" · ")
  return <ZStack alignment="bottomTrailing" frame={full} widgetURL={detailUrl} widgetBackground="clear">
    <ReadingPaper image={theme.readingPaper} width={size.width} height={size.height} />
    <HStack alignment="top" spacing={12} padding={{ horizontal: 14, vertical: 12 }}
      frame={{ ...full, alignment: "topLeading" }}>
      <Poster image={image} width={width} height={height} radius={10} theme={theme} />
      <VStack alignment="leading" spacing={5} frame={{ ...full, alignment: "topLeading" }}>
        <Text font="caption2" foregroundStyle={theme.secondary} lineLimit={1} layoutPriority={1}>{byline}</Text>
        <Text font={{ name: titleFont, size: 17 }} foregroundStyle={theme.primary}
          lineLimit={2} layoutPriority={1}>{entry.title}</Text>
        <CoverIntro intro={entry.intro} lines={4} theme={theme} />
        <Spacer minLength={0} />
        <CoverFooter entry={entry} coverNumber={coverNumber} count={count} theme={theme} />
      </VStack>
    </HStack>
    {count > 1
      ? <HStack padding={{ trailing: 14, bottom: 12 }}><NextButton theme={theme} /></HStack>
      : null}
  </ZStack>
}

function LargeCard({ entry, image, wideImage, coverNumber, count, theme, detailUrl }: CoverCard & { wideImage?: UIImage }) {
  const { width, height } = Widget.displaySize
  const art = wideImage ?? image
  const bodyHeight = entry.intro ? 144 : 96
  const maxArtHeight = Math.min(height * 0.65, height - bodyHeight)
  const naturalArtHeight = art ? width * art.height / art.width : maxArtHeight
  const artHeight = Math.min(maxArtHeight, Math.max(height * 0.5, naturalArtHeight))
  const frame = { width, height: artHeight }
  const imageFrame = wideImage ? frame : { width: width - 24, height: artHeight - 16 }
  const needsBackdrop = art && (!wideImage || Math.abs(artHeight - naturalArtHeight) > 1)
  const introLines = Widget.family === "systemExtraLargePortrait" ? 16 : 6
  return <ZStack alignment="bottomTrailing" frame={full} widgetURL={detailUrl} widgetBackground="clear">
    <ReadingPaper image={theme.readingPaper} width={width} height={height - artHeight} />
    <VStack spacing={0} frame={full}>
      <ZStack frame={frame} clipped accessibilityHidden>
        {needsBackdrop ? <BlurredCover image={art} width={width} height={artHeight} /> : null}
        {art
          ? <Image image={art} resizable scaleToFit frame={imageFrame} widgetAccentedRenderingMode="fullColor" />
          : <Image systemName="photo" font="title" foregroundStyle={theme.secondary} />}
      </ZStack>
      <VStack alignment="leading" spacing={4} padding={{ horizontal: 16, vertical: 10 }}
        frame={{ ...full, alignment: "topLeading" }}>
        <VStack alignment="leading" spacing={2} layoutPriority={1}>
          <Text font="caption2" foregroundStyle={theme.secondary} lineLimit={1}>
            {[typeName[entry.type], entry.subtitle].filter(Boolean).join(" · ")}
          </Text>
          <Text font={{ name: titleFont, size: 22 }} foregroundStyle={theme.primary}
            lineLimit={2}>{entry.title}</Text>
        </VStack>
        <CoverIntro intro={entry.intro} lines={introLines} theme={theme} />
        <Spacer minLength={0} />
        <CoverFooter entry={entry} coverNumber={coverNumber} count={count} theme={theme} />
      </VStack>
    </VStack>
    {count > 1
      ? <HStack padding={{ trailing: 16, bottom: 10 }}><NextButton theme={theme} /></HStack>
      : null}
  </ZStack>
}

function CoverWidget({ entry, image, wideImage, coverNumber, count }: {
  entry?: CoverEntry; image?: UIImage; wideImage?: UIImage; coverNumber: number; count: number
}) {
  return <EnvironmentValuesReader keys={["colorScheme", "showsWidgetContainerBackground", "widgetRenderingMode"]}>{env => {
    const dark = env.colorScheme === "dark" || env.widgetRenderingMode === "accented"
    const hasBackground = env.showsWidgetContainerBackground && !Widget.isTransparentMode && !Widget.isBlurMode
    const theme: Theme = {
      readingPaper: UIImage.fromRGBA(1, 1, dark ? Uint8Array.of(24, 22, 19, 255) : Uint8Array.of(245, 240, 231, 255)),
      primary: dark ? "#F3ECE0" : "#26211D",
      secondary: dark ? "#BEB2A3" : "#655B50",
      accent: dark ? "#E1A299" : "#7A3938",
      stroke: dark ? "rgba(243,236,224,0.16)" : "rgba(38,33,29,0.12)",
    }
    if (!entry) return <VStack spacing={6} padding={12} frame={full}
      widgetBackground={hasBackground ? (dark ? "#181613" : "#F5F0E7") : "clear"} widgetURL={homeUrl}>
      <Image systemName="film" foregroundStyle={theme.secondary} accessibilityHidden />
      <Text font="headline" fontDesign="serif" foregroundStyle={theme.primary}>豆瓣书影音</Text>
      <Text font="caption" foregroundStyle={theme.secondary} multilineTextAlignment="center">
        从作品详情添加一张封面
      </Text>
    </VStack>

    const detailUrl = Script.createRunURLScheme(Script.name, { type: entry.type, id: entry.id })
    const card = { entry, image, coverNumber, count, theme, detailUrl }
    if (largeFamilies.includes(Widget.family)) return <LargeCard {...card} wideImage={wideImage} />
    switch (Widget.family) {
      case "systemSmall": return <SmallCard {...card} />
      case "systemMedium": return <MediumCard {...card} />
      default: return <Text font="caption" widgetURL={detailUrl}>{entry.title}</Text>
    }
  }}</EnvironmentValuesReader>
}

async function main() {
  const list = await readCovers()
  const entry = list.items[list.index]
  const wideImage = entry && largeFamilies.includes(Widget.family) ? await readThumbnail(entry, "wide") : undefined
  const image = entry && !wideImage ? await readThumbnail(entry) : undefined
  Widget.present(<CoverWidget entry={entry} image={image} wideImage={wideImage}
    coverNumber={list.index + 1} count={list.items.length} />,
    { policy: "never" })
}

void main().catch(() => Widget.present(<CoverWidget count={0} coverNumber={0} />, { policy: "never" }))
