// Public request and Rexxar field mappings adapted from Marvae/douban-cli.
// Commit 156fa96f76adc0bc1c28998605d1ebf42925e0ce. See LICENSE.douban-cli.
import { fetch } from "scripting"

export type Scope = "movie" | "book" | "music"
export type SubjectType = Scope | "tv"
export type SubjectRef = { type: SubjectType; id: string }
export type CoverEntry = SubjectRef & { title: string; rating: number; coverUrl: string; subtitle?: string }
export type SearchItem = CoverEntry & { subtitle: string }
export type Detail = CoverEntry & {
  ratingCount?: number
  year: string
  originalUrl: string
  intro: string
  facts: { label: string; value: string }[]
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
export type Page<T> = { items: T[]; next?: number }

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
const releaseYear = (value: unknown) => joined(value).match(/\b\d{4}(?!\d)/)?.[0] ?? ""
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined
const idText = (value: unknown) => typeof value === "number" ? String(value) : clean(value)
const doubanUrl = (value: unknown) => /^https:\/\/(?:[\w-]+\.)*douban\.com\//i.test(clean(value)) ? clean(value) : ""
function imageUrl(value: unknown) {
  const url = clean(value)
  if (!/^https:\/\/(?:[\w-]+\.)*doubanio\.com\//i.test(url)) return ""
  return /default_large|movie_default|book-default|music-default/i.test(url) ? "" : url
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
  return { items, next: rows.length && next < total ? next : undefined }
}

export async function search(scope: Scope, keyword: string, start = 0): Promise<Page<SearchItem>> {
  const query = encodeURIComponent(keyword.trim())
  const data = await request(`search/${scope}?q=${query}&start=${start}&count=${pageSize}`,
    `/search/?query=${query}&type=${scope}`)
  if (clean(data.banned) && !list(data.items).length) throw new Error("Douban search unavailable")
  const seen = new Set<string>()
  return page(data, "items", start, row => {
    const target = record(row.target)
    const subject = parseSubject(row.target_type, idText(target.id))
    const title = clean(target.title)
    if (!subject || domain(subject.type) !== scope || !title || seen.has(subjectKey(subject))) return
    seen.add(subjectKey(subject))
    return {
      ...subject,
      title,
      subtitle: metadata(...clean(target.card_subtitle).split(/\s*[/／·]\s*/)) || clean(target.year),
      rating: number(record(target.rating).value) ?? 0,
      coverUrl: imageUrl(target.cover_url),
    }
  })
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
  const facts = []
  if (type === "book") {
    subtitle = metadata(data.author, data.press)
    facts.push(["作者", joined(data.author)], ["出版社", joined(data.press)], ["出版", joined(data.pubdate)],
      ["页数", joined(data.pages)], ["定价", joined(data.price)])
  } else if (type === "music") {
    subtitle = metadata(people(data.singer), year)
    facts.push(["表演者", names(data.singer)], ["发行", joined(data.pubdate)], ["发行方", joined(data.publisher)])
  } else {
    subtitle = metadata(year, people(data.directors))
    facts.push(["导演", names(data.directors)], ["主演", names(data.actors)],
      ["类型", joined(data.genres)], [type === "tv" ? "单集片长" : "片长", joined(data.durations)],
      ["集数", episodes ? `${episodes} 集` : ""])
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
    facts: facts.filter(([, value]) => value).map(([label, value]) => ({ label, value })),
    episodes,
    songs,
  }
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
