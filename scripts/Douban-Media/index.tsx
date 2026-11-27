import {
  Button, Device, EnvironmentValuesReader, GeometryReader, GlassEffectContainer, HStack, Image,
  LazyVStack, Menu, Navigation, NavigationDestination, NavigationStack, ProgressView, Rectangle, RoundedRectangle,
  Script, ScrollView, Spacer, Text, VStack,
  useColorScheme, useEffect, useObservable, useRef, useState,
  type DynamicShapeStyle,
} from "scripting"
import {
  episodeUrl, getComments, getDetail, parseSubject, search, subjectKey, typeName,
  type Comment, type CommentKind, type CoverEntry, type Detail, type Page, type Scope,
  type SearchItem, type SubjectRef,
} from "./douban"
import { addCover, loadImage, readCovers, readThumbnail, refreshCover, removeCover } from "./covers"

const paper: DynamicShapeStyle = { light: "#F5F0E7", dark: "#181613" }
const ink: DynamicShapeStyle = { light: "#26211D", dark: "#F3ECE0" }
const muted: DynamicShapeStyle = { light: "#655B50", dark: "#BEB2A3" }
const accent: DynamicShapeStyle = { light: "#7A3938", dark: "#E1A299" }
const surface: DynamicShapeStyle = { light: "#EFE8DC", dark: "#211D19" }
const hairline: DynamicShapeStyle = { light: "rgba(38,33,29,0.08)", dark: "rgba(243,236,224,0.08)" }
const coverBackground: DynamicShapeStyle = { light: "#DDD1C2", dark: "#382E26" }
const capsule = "capsule" as const
const glassAvailable = Number.parseInt(Device.systemVersion, 10) >= 26 && typeof UIGlass !== "undefined"
const retryLabel = "暂时无法读取豆瓣，点此重试"
const coverRoute = "covers"
const scopes: { value: Scope; label: string }[] = [
  { value: "movie", label: "影视" }, { value: "book", label: "图书" }, { value: "music", label: "音乐" },
]

function routeSubject(route: string) {
  const [type, id] = route.split(":")
  return parseSubject(type, id)
}

function appendUnique<T>(previous: T[], next: T[], key: (item: T) => string) {
  const keys = new Set(previous.map(key))
  return [...previous, ...next.filter(item => {
    const id = key(item)
    if (keys.has(id)) return false
    keys.add(id)
    return true
  })]
}

function usePages<T>(key: (item: T) => string) {
  const revision = useRef(0)
  const retry = useRef<() => void>(() => {})
  const [page, setPage] = useState<Page<T>>()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => () => { revision.current++ }, [])

  function clear() {
    revision.current++
    setPage(undefined)
    setBusy(false)
    setFailed(false)
  }

  function load(getPage: (start: number) => Promise<Page<T>>, start = 0) {
    const current = ++revision.current
    if (start === 0) setPage(undefined)
    setBusy(true)
    setFailed(false)
    retry.current = () => load(getPage, start)
    void getPage(start).then(received => {
      if (current !== revision.current) return
      setPage(previous => ({
        items: start === 0 ? received.items : appendUnique(previous?.items ?? [], received.items, key),
        next: received.next,
      }))
      setBusy(false)
    }, () => {
      if (current !== revision.current) return
      setBusy(false)
      setFailed(true)
    })
  }

  return { page, busy, failed, clear, load, retry: () => retry.current() }
}

function InlineStatus({ busy, failed, retry, more, empty }: {
  busy: boolean; failed: boolean; retry: () => void; more?: () => void; empty?: string
}) {
  if (busy) return <ProgressView title="读取中…" />
  if (failed) return <Button title={retryLabel} action={retry} foregroundStyle={accent} />
  return <VStack alignment="leading" spacing={8}>
    {empty ? <Text font="subheadline" foregroundStyle={muted}>{empty}</Text> : null}
    {more ? <Button title="加载更多" action={more} foregroundStyle={accent} /> : null}
  </VStack>
}

function Hairline({ height = 0.5 }: { height?: number }) {
  return <Rectangle fill={hairline} frame={{ height }} accessibilityHidden />
}

function CoverImage({ url, local, width, height, fills = false }: {
  url?: string; local?: SubjectRef; width: number; height: number; fills?: boolean
}) {
  const [image, setImage] = useState<UIImage>()
  const visible = useRef(false)
  const frame = { width, height }
  const radius = fills ? 6 : 8
  return <VStack spacing={0} onAppear={() => {
    visible.current = true
    if (image) return
    const request = local ? readThumbnail(local) : url ? loadImage(url) : undefined
    void request?.then(result => {
      if (visible.current) setImage(result)
    }, () => {})
  }} onDisappear={() => { visible.current = false }} accessibilityHidden
    clipShape={{ type: "rect", cornerRadius: radius }}
    overlay={<RoundedRectangle cornerRadius={radius}
      stroke={{ shapeStyle: hairline, strokeStyle: { lineWidth: 0.5 } }} allowsHitTesting={false} />}>
    {image
      ? <Image image={image} resizable scaleToFill={fills} scaleToFit={!fills} frame={frame} clipped={fills} />
      : <Image systemName="photo" font="caption" foregroundStyle={muted} frame={frame}
          background={coverBackground} />}
  </VStack>
}

function ScopePicker({ value, select }: { value: Scope; select: (value: Scope) => void }) {
  const mode = useColorScheme()
  const strip = <HStack spacing={4} padding={3}
    background={{ style: surface, shape: capsule }}>
    {scopes.map(scope => {
      const selected = scope.value === value
      const label = <Text font="subheadline" fontWeight={selected ? "semibold" : "regular"}
        foregroundStyle={selected ? accent : muted} frame={{ minHeight: 34, maxWidth: "infinity" }}>
        {scope.label}
      </Text>
      return <Button key={scope.value} action={() => select(scope.value)} buttonStyle="plain"
        accessibilityAddTraits={selected ? "isSelected" : undefined}
        glassEffect={selected && glassAvailable
          ? UIGlass.regular().interactive().tint(mode === "dark" ? "#503331" : "#F3DDD5") : undefined}
        background={selected && !glassAvailable ? { style: paper, shape: capsule } : undefined}>
        {label}
      </Button>
    })}
  </HStack>
  return glassAvailable ? <GlassEffectContainer spacing={4}>{strip}</GlassEffectContainer> : strip
}

const scopeGuide = {
  movie: { icon: "film", text: "搜索电影或剧集" },
  book: { icon: "book", text: "搜索书名或作者" },
  music: { icon: "music.note", text: "搜索专辑或表演者" },
}

function SearchGuide({ scope, empty }: { scope: Scope; empty: boolean }) {
  const guide = scopeGuide[scope]
  return <VStack spacing={10} padding={{ top: 72, bottom: 32 }}
    frame={{ maxWidth: "infinity", alignment: "center" }}>
    <Image systemName={empty ? "magnifyingglass" : guide.icon} font="title2" foregroundStyle={accent}
      frame={{ width: 62, height: 62 }}
      background={{ style: surface, shape: "circle" }} accessibilityHidden />
    <Text font="subheadline" foregroundStyle={muted}>{empty ? "没找到相关作品" : guide.text}</Text>
  </VStack>
}

function SearchScore({ rating }: { rating: number }) {
  return rating > 0
    ? <Text font="title3" fontDesign="serif" monospacedDigit fontWeight="semibold"
        accessibilityLabel={`豆瓣 ${rating.toFixed(1)}`} foregroundStyle={accent}>{rating.toFixed(1)}</Text>
    : <Text font="caption2" foregroundStyle={muted}>暂无评分</Text>
}

function SearchScreen({ open }: { open: (route: string) => void }) {
  const dismiss = Navigation.useDismiss()
  const [keyword, setKeyword] = useState("")
  const [scope, setScope] = useState<Scope>("movie")
  const { page, busy, failed, clear, load, retry } = usePages<SearchItem>(subjectKey)
  const retrieve = (start: number) => search(scope, keyword, start)
  return <ScrollView navigationTitle="豆瓣书影音" navigationBarTitleDisplayMode="large"
    background={paper} navigationContainerBackground={paper} scrollDismissesKeyboard="interactively"
    searchable={{ value: keyword, prompt: "作品名称、作者或表演者", onChanged: text => {
      setKeyword(text)
      if (text.trim() !== keyword.trim()) clear()
    } }}
    onSubmit={{ triggers: "search", action: () => { if (keyword.trim()) load(retrieve) } }}
    toolbar={{
      cancellationAction: <Button title="关闭" action={() => dismiss()} />,
      primaryAction: <Button title="组件封面" action={() => open(coverRoute)} />,
    }}>
    <LazyVStack alignment="leading" spacing={14} padding={{ horizontal: 20, top: 8, bottom: 32 }}>
      <ScopePicker value={scope} select={selected => {
        if (selected === scope) return
        setScope(selected)
        if (keyword.trim()) load(start => search(selected, keyword, start))
      }} />
      {page?.items.map(item => <VStack key={subjectKey(item)} alignment="leading" spacing={12}>
        <Button buttonStyle="plain" action={() => open(subjectKey(item))}>
          <HStack spacing={12} contentShape="rect">
            <CoverImage key={item.coverUrl} url={item.coverUrl} fills
              width={item.type === "music" ? 56 : 52} height={item.type === "music" ? 56 : 74} />
            <VStack alignment="leading" spacing={4} frame={{ maxWidth: "infinity", alignment: "leading" }}>
              <Text font="headline" fontDesign="serif" foregroundStyle={ink}>{item.title}</Text>
              <Text font="caption" foregroundStyle={muted} lineLimit={2}>
                {[typeName[item.type], item.subtitle].filter(Boolean).join(" · ")}
              </Text>
            </VStack>
            <SearchScore rating={item.rating} />
          </HStack>
        </Button>
        <Hairline />
      </VStack>)}
      {!busy && !failed && !page?.items.length ? <SearchGuide scope={scope} empty={!!page} /> : null}
      <InlineStatus busy={busy} failed={failed} retry={retry}
        more={page?.next === undefined ? undefined : () => load(retrieve, page.next)} />
    </LazyVStack>
  </ScrollView>
}

function openOriginal(url: string) {
  void Safari.present(url).catch(() => Dialog.alert("暂时无法打开豆瓣网页"))
}

const commentName = { interests: "短评", reviews: "长评" }
function CommentRow({ row, kind }: { row: Comment; kind: CommentKind }) {
  const review = kind === "reviews"
  const stars = Math.min(5, Math.round(row.stars ?? 0))
  return <VStack alignment="leading" spacing={8}
    padding={review ? 14 : undefined}
    background={review ? { style: surface, shape: { type: "rect", cornerRadius: 12 } } : undefined}
    frame={{ maxWidth: "infinity", alignment: "leading" }}>
    {row.title ? <Text font="headline" fontDesign="serif" foregroundStyle={ink}>{row.title}</Text> : null}
    <HStack spacing={7}>
      <Text font="subheadline" fontWeight="semibold" foregroundStyle={ink} lineLimit={1}>{row.author}</Text>
      {stars > 0
        ? <Text font="caption" foregroundStyle={accent} accessibilityLabel={`${stars} 星`}>{"★".repeat(stars)}</Text>
        : null}
      <Spacer minLength={0} />
      {row.date ? <Text font="caption2" foregroundStyle={muted} lineLimit={1}>{row.date}</Text> : null}
    </HStack>
    {row.body ? <Text font="body" lineSpacing={5} foregroundStyle={ink}
      lineLimit={review ? 6 : undefined}>{row.body}</Text> : null}
    <HStack>
      {row.votes !== undefined ? <Text font="caption2" foregroundStyle={muted}>{`有用 ${row.votes}`}</Text> : null}
      <Spacer minLength={0} />
      {review && row.url
        ? <Button title="读原文" action={() => openOriginal(row.url)} font="subheadline"
            accessibilityLabel={`读原文，${row.title}`} foregroundStyle={accent} />
        : null}
    </HStack>
    {!review ? <Hairline /> : null}
  </VStack>
}

function CommentTabs({ selection, select }: { selection: CommentKind; select: (kind: CommentKind) => void }) {
  const kinds: CommentKind[] = ["interests", "reviews"]
  return <VStack alignment="leading" spacing={0}>
    <HStack spacing={20}>
      {kinds.map(kind => {
        const current = selection === kind
        return <Button key={kind} action={() => select(kind)} buttonStyle="plain"
          accessibilityAddTraits={current ? "isSelected" : undefined}>
          <Text font="subheadline" fontWeight={current ? "semibold" : "regular"}
            foregroundStyle={current ? accent : muted} padding={{ horizontal: 4 }}
            frame={{ minHeight: 38 }}
            overlay={{ alignment: "bottom", content: <Rectangle fill={current ? accent : "clear"}
              frame={{ height: 2 }} accessibilityHidden allowsHitTesting={false} /> }}>
            {commentName[kind]}
          </Text>
        </Button>
      })}
      <Spacer minLength={0} />
    </HStack>
    <Hairline />
  </VStack>
}

function Comments({ subject, kind }: { subject: SubjectRef; kind: CommentKind }) {
  const { page, busy, failed, load, retry } = usePages<Comment>(row => row.id)
  const retrieve = (start: number) => getComments(subject, kind, start)
  useEffect(() => { load(retrieve) }, [])
  return <VStack alignment="leading" spacing={16}>
    {page?.items.map(row => <CommentRow key={row.id} row={row} kind={kind} />)}
    <InlineStatus busy={busy} failed={failed} retry={retry}
      more={page?.next === undefined ? undefined : () => load(retrieve, page.next)}
      empty={page && !page.items.length ? `暂无${commentName[kind]}` : undefined} />
  </VStack>
}

function Heading({ title }: { title: string }) {
  return <Text font="title3" fontDesign="serif" fontWeight="semibold" foregroundStyle={ink}
    accessibilityAddTraits="isHeader">{title}</Text>
}

function DetailHeader({ detail, added, adding, add }: {
  detail: Detail; added: boolean; adding: boolean; add: () => void
}) {
  return <EnvironmentValuesReader keys={["dynamicTypeSize"]}>{env => {
    const album = detail.type === "music"
    const poster = <CoverImage key={detail.coverUrl} url={detail.coverUrl}
      width={album ? 120 : 114} height={album ? 120 : 164} />
    const information = <VStack alignment="leading" spacing={7}
      frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <Text font="caption" foregroundStyle={muted}>{[typeName[detail.type], detail.year].filter(Boolean).join(" · ")}</Text>
      <Text font="title" fontDesign="serif" fontWeight="semibold" foregroundStyle={ink}
        accessibilityAddTraits="isHeader">{detail.title}</Text>
      <VStack alignment="leading" spacing={1}>
        {detail.rating > 0 ? <HStack alignment="firstTextBaseline" spacing={5}>
          <Text font="largeTitle" fontDesign="serif" fontWeight="semibold" foregroundStyle={accent}
            monospacedDigit>{detail.rating.toFixed(1)}</Text>
          <Text font="caption2" foregroundStyle={muted}>豆瓣</Text>
        </HStack> : <Text font="caption" foregroundStyle={muted}>暂无评分</Text>}
        {detail.ratingCount !== undefined
          ? <Text font="caption2" foregroundStyle={muted}>{`${detail.ratingCount.toLocaleString()} 人评价`}</Text>
          : null}
      </VStack>
      <Button action={add} disabled={added || adding || !detail.coverUrl} buttonStyle="plain">
        <HStack spacing={5} padding={{ horizontal: 10, vertical: 7 }}
          background={{ style: surface, shape: capsule }}>
          {adding ? <ProgressView controlSize="mini" /> : <Image systemName={added ? "checkmark" : "plus"}
            font="caption2" foregroundStyle={added ? muted : accent} accessibilityHidden />}
          <Text font="caption" fontWeight="medium" foregroundStyle={added ? muted : accent}>
            {added ? "已加入" : adding ? "正在加入" : "加入桌面封面"}
          </Text>
        </HStack>
      </Button>
    </VStack>

    return env.dynamicTypeSize.startsWith("accessibility")
      ? <VStack alignment="leading" spacing={14}>{poster}{information}</VStack>
      : <HStack alignment="top" spacing={16}>{poster}{information}</HStack>
  }}</EnvironmentValuesReader>
}

function DetailFacts({ facts }: { facts: Detail["facts"] }) {
  return <VStack alignment="leading" spacing={8}
    frame={{ maxWidth: "infinity", alignment: "leading" }}
    padding={14} background={{ style: surface, shape: { type: "rect", cornerRadius: 12 } }}>
    {facts.map(({ label, value }) => <HStack key={label} alignment="firstTextBaseline" spacing={12}>
      <Text font="subheadline" foregroundStyle={muted} frame={{ width: 60, alignment: "leading" }}>{label}</Text>
      <Text font="subheadline" foregroundStyle={ink} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        {value}
      </Text>
    </HStack>)}
  </VStack>
}

function measuredHeight(onHeight: (height: number) => void) {
  return <GeometryReader>{({ size }) =>
    <Rectangle key={size.height} fill="clear" onAppear={() => onHeight(size.height)} />
  }</GeometryReader>
}

function Introduction({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const [shownHeight, setShownHeight] = useState(0)
  const [fullHeight, setFullHeight] = useState(0)
  const textProps = {
    font: "body" as const, lineSpacing: 6, fixedSize: { horizontal: false, vertical: true },
    frame: { maxWidth: "infinity" as const, alignment: "leading" as const },
  }
  return <VStack alignment="leading" spacing={10}>
    <Heading title="简介" />
    <Text {...textProps} foregroundStyle={ink} lineLimit={expanded ? undefined : 5}
      background={<Text {...textProps} foregroundStyle="clear" accessibilityHidden allowsHitTesting={false}
        background={measuredHeight(setFullHeight)}>{text}</Text>}
      overlay={measuredHeight(setShownHeight)}>
      {text}
    </Text>
    {expanded || (shownHeight > 0 && fullHeight - shownHeight > 1)
      ? <Button title={expanded ? "收起" : "展开"} action={() => setExpanded(!expanded)}
          font="subheadline" foregroundStyle={accent} />
      : null}
  </VStack>
}

function DetailScreen({ subject }: { subject: SubjectRef }) {
  const [detail, setDetail] = useState<Detail>()
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  const [kind, setKind] = useState<CommentKind>("interests")
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState<boolean>()
  useEffect(() => {
    let current = true
    void readCovers().then(list => {
      if (current) setAdded(list.items.some(entry => subjectKey(entry) === subjectKey(subject)))
    }, () => { if (current) setAdded(false) })
    return () => { current = false }
  }, [])
  useEffect(() => {
    let current = true
    void getDetail(subject).then(result => {
      if (current) setDetail(result)
    }, () => {
      if (current) setFailed(true)
    })
    return () => { current = false }
  }, [attempt])

  async function add(entry: Detail) {
    setAdding(true)
    try {
      await addCover(entry)
      setAdded(true)
    } catch {
      await Dialog.alert({ title: "暂时无法添加封面", message: "稍后可以再试一次。" })
    } finally {
      setAdding(false)
    }
  }

  return <ScrollView navigationTitle="" navigationBarTitleDisplayMode="inline"
    background={paper} navigationContainerBackground={paper}
    toolbar={detail ? { primaryAction: <Button title="在豆瓣打开" systemImage="safari"
      action={() => openOriginal(detail.originalUrl)} labelStyle="iconOnly" accessibilityLabel="在豆瓣打开" />
    } : undefined}>
    <LazyVStack alignment="leading" spacing={24} padding={{ horizontal: 20, top: 16, bottom: 32 }}>
      {detail ? <>
        <DetailHeader detail={detail} added={added === true} adding={adding}
          add={() => { if (added !== undefined) void add(detail) }} />
        {detail.facts.length ? <DetailFacts facts={detail.facts} /> : null}
        {detail.intro ? <Introduction text={detail.intro} /> : null}
        {detail.episodes > 0 ? <Menu title={`选集 · 共 ${detail.episodes} 集`} systemImage="list.number"
          foregroundStyle={accent}>
          {Array.from({ length: detail.episodes }, (_, index) => index + 1).map(episode =>
            <Button key={episode} title={`第 ${episode} 集`} action={() => openOriginal(episodeUrl(detail.id, episode))} />)}
        </Menu> : null}
        {detail.songs.length ? <VStack alignment="leading" spacing={8}>
          <Heading title="曲目" />
          {detail.songs.map((song, index) => <HStack key={index} alignment="firstTextBaseline" spacing={10}>
            <Text font="caption" monospacedDigit foregroundStyle={muted}>{String(song.number ?? index + 1)}</Text>
            <Text font="body" foregroundStyle={ink}>{song.title}</Text>
          </HStack>)}
        </VStack> : null}
        <VStack alignment="leading" spacing={16}>
          <CommentTabs selection={kind} select={setKind} />
          <Comments key={kind} subject={subject} kind={kind} />
        </VStack>
      </> : <InlineStatus busy={!failed} failed={failed} retry={() => {
        setFailed(false)
        setAttempt(value => value + 1)
      }} />}
    </LazyVStack>
  </ScrollView>
}

function CoversScreen({ open }: { open: (entry: CoverEntry) => void }) {
  const [items, setItems] = useState<CoverEntry[]>()
  const [working, setWorking] = useState<SubjectRef>()
  const [readingFailed, setReadingFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [thumbnailVersion, setThumbnailVersion] = useState(0)
  useEffect(() => {
    let current = true
    void readCovers().then(list => {
      if (current) setItems(list.items)
    }, () => {
      if (current) setReadingFailed(true)
    })
    return () => { current = false }
  }, [attempt])

  async function edit(entry: CoverEntry, refresh: boolean) {
    setWorking(entry)
    try {
      const list = await (refresh ? refreshCover(entry) : removeCover(entry))
      setItems(list.items)
      if (refresh) setThumbnailVersion(value => value + 1)
    } catch {
      await Dialog.alert({
        title: refresh ? "暂时无法更新封面" : "暂时无法移除封面",
        message: refresh ? "组件会继续使用之前的图片。" : "稍后可以再试一次。",
      })
    } finally {
      setWorking(undefined)
    }
  }

  return <ScrollView navigationTitle="组件封面" navigationBarTitleDisplayMode="inline"
    background={paper} navigationContainerBackground={paper}>
    <LazyVStack alignment="leading" spacing={16} padding={{ horizontal: 20, top: 16, bottom: 32 }}>
      {!items ? <InlineStatus busy={!readingFailed} failed={readingFailed} retry={() => {
        setReadingFailed(false)
        setAttempt(value => value + 1)
      }} /> : null}
      {items && !items.length ? <Text font="body" foregroundStyle={muted}>从作品详情加入喜欢的海报、书封或专辑封面。</Text> : null}
      {items?.map(entry => <VStack key={subjectKey(entry)} alignment="leading" spacing={10}>
        <Button action={() => open(entry)} buttonStyle="plain">
          <HStack spacing={12} contentShape="rect">
            <CoverImage key={thumbnailVersion} local={entry} fills
              width={46} height={entry.type === "music" ? 46 : 62} />
            <VStack alignment="leading" spacing={4} frame={{ maxWidth: "infinity", alignment: "leading" }}>
              <Text font="headline" fontDesign="serif" foregroundStyle={ink}>{entry.title}</Text>
              <Text font="caption" foregroundStyle={muted} lineLimit={2}>
                {[typeName[entry.type], entry.subtitle].filter(Boolean).join(" · ")}
              </Text>
            </VStack>
            <SearchScore rating={entry.rating} />
            {working && subjectKey(working) === subjectKey(entry) ? <ProgressView controlSize="small" />
              : <Image systemName="chevron.right" foregroundStyle={muted} font="caption2" accessibilityHidden />}
          </HStack>
        </Button>
        <HStack spacing={16}>
          <Button title="更新封面" action={() => { void edit(entry, true) }} disabled={!!working} foregroundStyle={accent} />
          <Button title="移除" action={() => { void edit(entry, false) }} disabled={!!working} foregroundStyle={muted} />
        </HStack>
        <Hairline />
      </VStack>)}
    </LazyVStack>
  </ScrollView>
}

function App({ initial }: { initial?: SubjectRef }) {
  const path = useObservable(initial ? [subjectKey(initial)] : [])
  return <NavigationStack path={path}>
    <VStack navigationTitle="豆瓣书影音"
      navigationDestination={<NavigationDestination>{value => {
        if (value === coverRoute) return <CoversScreen open={entry => path.setValue([coverRoute, subjectKey(entry)])} />
        const subject = routeSubject(value)
        return subject ? <DetailScreen key={value} subject={subject} /> : <Text>找不到这条作品</Text>
      }}</NavigationDestination>}>
      <SearchScreen open={value => path.setValue([value])} />
    </VStack>
  </NavigationStack>
}

async function main() {
  const { type, id } = Script.queryParameters
  try {
    await Navigation.present({
      element: <App initial={parseSubject(type, id)} />,
      modalPresentationStyle: "fullScreen",
    })
  } finally {
    Script.exit()
  }
}

void main()
