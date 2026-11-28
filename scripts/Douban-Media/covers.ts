import { Widget, fetch } from "scripting"
import { getDetail, subjectKey, type CoverEntry, type Detail, type SubjectRef } from "./douban"

const referer = "https://m.douban.com/"
const images = new Map<string, Promise<UIImage>>()
const waiting: (() => void)[] = []
let active = 0

async function downloadImage(url: string) {
  if (!url) throw new Error("No cover")
  const response = await fetch(url, { headers: { Referer: referer }, timeout: 12 })
  if (!response.ok) throw new Error(`Cover HTTP ${response.status}`)
  const image = UIImage.fromData(await response.data(), 1)
  if (!image) throw new Error("Invalid cover")
  return image
}

export function loadImage(url: string): Promise<UIImage> {
  const existing = images.get(url)
  if (existing) return existing
  const pending = new Promise<UIImage>((resolve, reject) => {
    function start() {
      active++
      void downloadImage(url).then(resolve, reject).finally(() => {
        active--
        waiting.shift()?.()
      })
    }
    if (active < 4) start()
    else waiting.push(start)
  })
  images.set(url, pending)
  void pending.catch(() => images.delete(url))
  return pending
}

export type CoverList = { items: CoverEntry[]; index: number }
const directory = () => `${FileManager.appGroupDocumentsDirectory}/douban-media`
const manifest = () => `${directory()}/widget-covers.json`
type ThumbnailVariant = "poster" | "wide"
const thumbnailPath = (entry: SubjectRef, variant: ThumbnailVariant = "poster") =>
  `${directory()}/${entry.type}-${entry.id}${variant === "wide" ? "-wide" : ""}.jpg`

export async function readThumbnail(entry: SubjectRef, variant: ThumbnailVariant = "poster"): Promise<UIImage | undefined> {
  try {
    return UIImage.fromData(await FileManager.readAsData(thumbnailPath(entry, variant)), 1) ?? undefined
  } catch {
    return undefined
  }
}

export async function readCovers(): Promise<CoverList> {
  if (!await FileManager.exists(manifest())) return { items: [], index: 0 }
  return JSON.parse(await FileManager.readAsString(manifest())) as CoverList
}

let lastWrite = Promise.resolve<unknown>(undefined)
function updateCovers(change: (current: CoverList) => CoverList | undefined): Promise<CoverList> {
  const write = lastWrite.then(async () => {
    const current = await readCovers()
    const next = change(current)
    if (!next) return current
    await FileManager.writeAsString(manifest(), JSON.stringify(next))
    Widget.reloadAll()
    return next
  })
  lastWrite = write.catch(() => undefined)
  return write
}

async function saveThumbnail(path: string, image: UIImage) {
  const scale = Math.min(1, 720 / Math.max(image.width, image.height))
  const thumb = scale === 1 ? image : image.preparingThumbnail({
    width: Math.max(1, Math.round(image.width * scale)),
    height: Math.max(1, Math.round(image.height * scale)),
  })
  const jpeg = thumb?.toJPEGData(0.85)
  if (!jpeg) throw new Error("Could not create thumbnail")
  await FileManager.createDirectory(directory(), true)
  await FileManager.writeAsData(path, jpeg)
}

const same = (a: SubjectRef, b: SubjectRef) => subjectKey(a) === subjectKey(b)

async function saveWideThumbnail(entry: SubjectRef, url?: string) {
  if (!url) return
  const image = await downloadImage(url)
  if (image.width > image.height) await saveThumbnail(thumbnailPath(entry, "wide"), image)
}

export async function addCover({ type, id, title, rating, coverUrl, subtitle, intro, wideCoverUrl }: Detail): Promise<CoverList> {
  const entry = { type, id, title, rating, coverUrl, subtitle, intro }
  const current = await readCovers()
  if (!current.items.some(item => same(item, entry))) {
    await saveThumbnail(thumbnailPath(entry), await loadImage(coverUrl))
    await saveWideThumbnail(entry, wideCoverUrl).catch(() => undefined)
  }
  return updateCovers(list => {
    const index = list.items.findIndex(item => same(item, entry))
    return index >= 0
      ? { items: list.items, index }
      : { items: [...list.items, entry], index: list.items.length }
  })
}

export async function removeCover(entry: SubjectRef): Promise<CoverList> {
  const updated = await updateCovers(({ items, index }) => {
    const removed = items.findIndex(item => same(item, entry))
    if (removed < 0) return
    const remaining = items.filter(item => !same(item, entry))
    const nextIndex = removed < index ? index - 1 : Math.min(index, remaining.length - 1)
    return { items: remaining, index: Math.max(0, nextIndex) }
  })
  for (const variant of ["poster", "wide"] as const) {
    const path = thumbnailPath(entry, variant)
    if (await FileManager.exists(path)) await FileManager.remove(path)
  }
  return updated
}

export async function refreshCover(entry: CoverEntry): Promise<CoverList> {
  const { type, id, title, rating, coverUrl, subtitle, intro, wideCoverUrl } = await getDetail(entry)
  const updated = { type, id, title, rating, coverUrl, subtitle, intro }
  const image = await downloadImage(coverUrl)
  await saveThumbnail(thumbnailPath(updated), image)
  await saveWideThumbnail(updated, wideCoverUrl).catch(() => undefined)
  images.set(coverUrl, Promise.resolve(image))
  return updateCovers(({ items, index }) => ({
    items: items.map(item => same(item, entry) ? updated : item),
    index,
  }))
}

export async function nextCover() {
  await updateCovers(({ items, index }) => items.length < 2
    ? undefined : { items, index: (index + 1) % items.length })
}
