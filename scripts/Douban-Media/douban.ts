// Public request and Rexxar field mappings adapted from Marvae/douban-cli.
// Commit 156fa96f76adc0bc1c28998605d1ebf42925e0ce. See LICENSE.douban-cli.
import { fetch } from "scripting"

export type Scope = "movie" | "book" | "music"
export type SubjectType = Scope | "tv"
export type SubjectRef = { type: SubjectType; id: string }
export type CoverEntry = SubjectRef & { title: string; rating: number; coverUrl: string; subtitle?: string }
export type SearchItem = CoverEntry & { subtitle: string }
export type CreditKind = "celebrity" | "author" | "query"
export type CreditPerson = { name: string; role: string; avatarUrl: string; bio?: string } & (
  { kind: "celebrity" | "author"; id: string } | { kind: "query"; scope: Scope }
)
export type WorksTarget = CreditPerson | { kind: "series"; id: string; name: string; role: "丛书" }
type Fact = { label: string; value: string; action?: WorksTarget }
export type Detail = CoverEntry & {
  ratingCount?: number
  year: string
  originalUrl: string
  intro: string
  facts: Fact[]
  episodes: number
  songs: { number?: number; title: string }[]
}
export type CommentKind = "interests" | "reviews"
export type Comment = {
  id: string
  author: string
  body: string
  title: string
  date: string
  stars?: number
  votes?: number
  url: string
}
export type Page<T> = { items: T[]; total: number; next?: number }

export const typeName = { movie: "电影", tv: "剧集", book: "图书", music: "专辑" }
export const subjectKey = ({ type, id }: SubjectRef) => `${type}:${id}`

export function parseSubject(type: unknown, id: unknown): SubjectRef | undefined {
  if ((type === "movie" || type === "tv" || type === "book" || type === "music")
      && typeof id === "string" && /^\d+$/.test(id)) return { type, id }
}

const mobile = "https://m.douban.com"
const pageSize = 20
const domain = (type: SubjectType) => type === "tv" ? "movie" : type
const detailPath = ({ type, id }: SubjectRef) => `/${domain(type)}/subject/${id}/`
export const episodeUrl = (id: string, episode: number) =>
  `https://movie.douban.com/subject/${id}/episode/${episode}/`

type RecordValue = Record<string, unknown>
function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
const record = (value: unknown) => isRecord(value) ? value : {}
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const clean = (value: unknown) => typeof value === "string"
  ? value.replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, "").trim() : ""
const joined = (value: unknown) => Array.isArray(value) ? value.map(clean).filter(Boolean).join(" / ") : clean(value)
const people = (value: unknown) => list(value).map(item => record(item).name)
const names = (value: unknown) => joined(people(value))
const metadata = (...values: unknown[]) => values.flatMap(value => Array.isArray(value) ? value : [value])
  .map(clean).filter(Boolean).join(" · ")
const cardSubtitle = (value: unknown) => metadata(...clean(value).split(/\s*[/／·]\s*/))
const releaseYear = (value: unknown) => joined(value).match(/\b\d{4}(?!\d)/)?.[0] ?? ""
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined
const idText = (value: unknown) => typeof value === "number" ? String(value) : clean(value)
const doubanUrl = (value: unknown) => /^https:\/\/(?:[\w-]+\.)*douban\.com\//i.test(clean(value)) ? clean(value) : ""
function imageUrl(value: unknown) {
  const url = clean(value)
  if (!/^https:\/\/(?:[\w-]+\.)*doubanio\.com\//i.test(url)) return ""
  return /default_large|movie_default|book-default|music-default/i.test(url) ? "" : url
}
function avatarUrl(value: unknown) {
  const avatar = record(value)
  return imageUrl(avatar.large) || imageUrl(avatar.normal)
}

async function request(path: string, referer: string) {
  const response = await fetch(`${mobile}/rexxar/api/v2/${path}`, {
    timeout: 12,
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      Referer: `${mobile}${referer}`,
    },
  })
  if (!response.ok) throw new Error(`Douban HTTP ${response.status}`)
  const data: unknown = await response.json()
  if (!isRecord(data)) throw new Error("Invalid Douban response")
  return data
}

function page<T>(data: RecordValue, key: string, start: number, parse: (item: RecordValue) => T | undefined): Page<T> {
  const rows = data[key]
  const total = number(data.total)
  if (!Array.isArray(rows) || total === undefined || data.start !== start) {
    throw new Error("Invalid Douban page")
  }
  const items = rows.filter(isRecord).flatMap(row => {
    const item = parse(row)
    return item ? [item] : []
  })
  const next = start + (number(data.count) || pageSize)
  return { items, total, next: rows.length && next < total ? next : undefined }
}

function workItem(type: unknown, work: RecordValue, subtitle: string): SearchItem | undefined {
  const subject = parseSubject(type, idText(work.id))
  const title = clean(work.title)
  if (!subject || !title) return
  return { ...subject, title, subtitle, rating: number(record(work.rating).value) ?? 0, coverUrl: imageUrl(work.cover_url) }
}

export async function search(scope: Scope, keyword: string, start = 0): Promise<Page<SearchItem>> {
  const query = encodeURIComponent(keyword.trim())
  const data = await request(`search/${scope}?q=${query}&start=${start}&count=${pageSize}`,
    `/search/?query=${query}&type=${scope}`)
  if (clean(data.banned) && !list(data.items).length) throw new Error("Douban search unavailable")
  const seen = new Set<string>()
  return page(data, "items", start, row => {
    const target = record(row.target)
    const item = workItem(row.target_type, target, cardSubtitle(target.card_subtitle) || clean(target.year))
    if (!item || domain(item.type) !== scope || seen.has(subjectKey(item))) return
    seen.add(subjectKey(item))
    return item
  })
}

function queryFacts(label: string, value: unknown, scope: Scope): Fact[] {
  return (Array.isArray(value) ? value : [value]).map(clean).filter(Boolean).map(name => ({
    label, value: name, action: { kind: "query", scope, name, role: label, avatarUrl: "" },
  }))
}

export async function getDetail(subject: SubjectRef): Promise<Detail> {
  const { type, id } = subject
  const data = await request(`${type}/${id}`, detailPath(subject))
  const title = clean(data.title)
  if (!title || idText(data.id) !== id) throw new Error("Invalid Douban subject")
  const rating = record(data.rating)
  const pic = record(data.pic)
  const episodes = type === "tv" ? Math.floor(number(data.episodes_count) ?? 0) : 0
  const year = releaseYear(data.year) || releaseYear(data.pubdate)
  let subtitle: string
  const facts: Fact[] = []
  const fact = (label: string, value: unknown) => ({ label, value: joined(value) })
  if (type === "book") {
    subtitle = metadata(data.author, data.press)
    const series = record(data.book_series)
    const seriesName = clean(series.title)
    const seriesId = clean(series.uri).match(/\/book_series\/(\d+)\/?$/)?.[1]
    facts.push(fact("作者", data.author), fact("译者", data.translator),
      ...queryFacts("出版社", data.press, "book"), fact("出品方", data.producers), {
        label: "丛书", value: seriesName,
        action: seriesId ? { kind: "series", id: seriesId, name: seriesName, role: "丛书" } : undefined,
      }, fact("出版", data.pubdate), fact("页数", data.pages), fact("定价", data.price))
  } else if (type === "music") {
    subtitle = metadata(people(data.singer), year)
    facts.push(fact("表演者", names(data.singer)), fact("发行", data.pubdate),
      ...queryFacts("发行方", data.publisher, "music"),
      fact("流派", data.genres), fact("版本", data.version), fact("介质", data.media))
  } else {
    subtitle = metadata(year, people(data.directors))
    facts.push(fact("导演", names(data.directors)), fact("主演", names(data.actors)),
      fact("类型", data.genres), fact(type === "tv" ? "单集片长" : "片长", data.durations),
      fact("集数", episodes ? `${episodes} 集` : ""))
  }
  const songs = type === "music" ? list(data.songs).filter(isRecord).flatMap(song => {
    const title = clean(song.title)
    return title ? [{ number: number(song.track_number), title }] : []
  }).sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity)) : []
  return {
    ...subject,
    title, year, subtitle,
    rating: number(rating.value) ?? 0,
    ratingCount: number(rating.count),
    coverUrl: imageUrl(pic.large) || imageUrl(data.cover_url) || imageUrl(pic.normal),
    originalUrl: doubanUrl(data.url) || `https://${domain(type)}.douban.com/subject/${id}/`,
    intro: clean(data.intro),
    facts: facts.filter(({ value }) => value),
    episodes,
    songs,
  }
}

function credit(row: RecordValue, type: SubjectType): CreditPerson | undefined {
  const name = clean(row.name)
  if (!name) return
  const avatar = avatarUrl(row.avatar)
  const category = clean(row.category)
  if (type === "music") {
    return {
      kind: "query", scope: "music", name, role: category || "歌手", avatarUrl: avatar,
      bio: clean(row.character) || metadata(row.info, row.stand_for),
    }
  }
  const id = idText(row.id)
  if (!/^\d+$/.test(id)) return
  const role = type === "book" ? category : clean(row.simple_character) || category || clean(row.character)
  return { kind: type === "book" ? "author" : "celebrity", id, name, role, avatarUrl: avatar }
}

export async function getCredits(subject: SubjectRef): Promise<CreditPerson[]> {
  const path = `${subject.type}/${subject.id}`
  const referer = detailPath(subject)
  const type = subject.type
  const main = request(`${path}/credits`, referer)
  if (type === "book" || type === "music") {
    return list((await main).items).map(row => credit(record(row), type))
      .filter((person): person is CreditPerson => person !== undefined)
  }
  const [featured, full] = await Promise.allSettled([main, request(`${path}/celebrities`, referer)])
  const extras = full.status === "fulfilled" ? full.value : {}
  const rows = [
    ...(featured.status === "fulfilled" ? list(featured.value.items) : []),
    ...list(extras.directors), ...list(extras.actors),
  ]
  const people = new Map<string, CreditPerson>()
  for (const row of rows) {
    const person = credit(record(row), type)
    if (person?.kind === "celebrity" && !people.has(person.id)) {
      people.set(person.id, person)
      if (people.size === 20) break
    }
  }
  return [...people.values()]
}

export async function getPerson(kind: "celebrity" | "author", id: string) {
  const path = `${kind}/${id}`
  const data = await request(path, `/${path}/`)
  if (kind === "author") {
    return { name: clean(data.name), avatarUrl: avatarUrl(data.avatar),
      bio: [clean(data.info), clean(data.intro)].filter(Boolean).join("\n\n"), facts: [] as Fact[] }
  }
  const extra = record(data.extra)
  const facts = list(extra.info).flatMap(entry => {
    const [key, text] = list(entry)
    const label = clean(key)
    const value = clean(text)
    return label && value ? [{ label, value }] : []
  })
  return {
    name: clean(data.title),
    avatarUrl: imageUrl(record(data.cover_img).url) || imageUrl(record(record(data.cover).normal).url),
    bio: clean(extra.short_info),
    facts,
  }
}

export async function getPersonWorks(target: WorksTarget, start = 0): Promise<Page<SearchItem>> {
  if (target.kind === "query") return search(target.scope, target.name, start)
  const pagination = `start=${start}&count=${pageSize}`
  if (target.kind === "series") {
    const path = `book_series/${target.id}`
    const data = await request(`${path}/books?${pagination}`, `/book/series/${target.id}/`)
    return page(data, "books", start, row => workItem("book", row, cardSubtitle(row.card_subtitle)))
  }
  const path = `${target.kind}/${target.id}`
  const sort = target.kind === "celebrity" ? "sortby=vote" : "sort=hot"
  const data = await request(`${path}/works?${pagination}&${sort}`, `/${path}/`)
  return page(data, "works", start, row => {
    if (target.kind === "author") return workItem("book", row, cardSubtitle(row.card_subtitle))
    const work = record(row.work)
    return workItem(work.type, work, metadata(work.year, row.roles) || cardSubtitle(work.card_subtitle))
  })
}

export async function getComments(subject: SubjectRef, kind: CommentKind, start = 0): Promise<Page<Comment>> {
  const sort = kind === "interests" ? "&order_by=hot" : ""
  const data = await request(`${subject.type}/${subject.id}/${kind}?count=${pageSize}&start=${start}${sort}`,
    detailPath(subject))
  return page(data, kind, start, row => {
    const id = idText(row.id)
    const body = kind === "interests" ? clean(row.comment)
      : clean(row.abstract).replace(/\r\n?/g, "\n").replace(/^[ \t\u3000]+/gm, "").replace(/\n{3,}/g, "\n\n")
    const title = kind === "reviews" ? clean(row.title) : ""
    if (!id || (!title && !body)) return
    return {
      id, title, body,
      author: clean(record(row.user).name) || "匿名",
      date: clean(row.create_time).split(" ")[0],
      stars: number(record(row.rating).value),
      votes: number(kind === "interests" ? row.vote_count : row.useful_count),
      url: doubanUrl(row.url),
    }
  })
}

const entities: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }

function reviewText(html: string) {
  return html
    .replace(/\r\n?/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|blockquote)\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(nbsp|amp|lt|gt|quot|#\d+|#x[0-9a-f]+);/gi, (entity, value: string) => {
      const key = value.toLowerCase()
      if (entities[key] !== undefined) return entities[key]
      const code = key.startsWith("#x") ? Number.parseInt(key.slice(2), 16) : Number(key.slice(1))
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code) : entity
    })
    .replace(/^[ \t\u00a0\u3000]+|[ \t\u00a0\u3000]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export async function getReview(id: string): Promise<{ body: string; hasPhotos: boolean; spoiler: boolean }> {
  const data = await request(`review/${id}`, `/review/${id}/`)
  const body = reviewText(clean(data.content))
  const hasPhotos = list(data.photos).length > 0
  if (!body && !hasPhotos) throw new Error("Review text unavailable")
  return { body, hasPhotos, spoiler: data.spoiler === true }
}
