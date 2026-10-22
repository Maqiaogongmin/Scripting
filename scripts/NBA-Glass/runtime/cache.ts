import { Script } from "scripting"

export type Snapshot<T> = { value: T; fetchedAt: number }
type Pointer = { current: string; previous?: string }
const base = () => `${FileManager.appGroupDocumentsDirectory}/nba-glass-${encodeURIComponent(Script.name)}`
const pointerKey = (key: string) => `nba-glass-v1:${key}`

export async function readCache<T>(key: string): Promise<Snapshot<T> | null> {
  const pointer = Storage.get<Pointer>(pointerKey(key))
  for (const file of [pointer?.current, pointer?.previous]) {
    if (!file || !file.startsWith(base() + "/")) continue
    try {
      const record = JSON.parse(await FileManager.readAsString(file))
      if (Number.isFinite(record.fetchedAt) && record.value != null) return record
    } catch { /* An interrupted write never replaces the prior readable snapshot. */ }
  }
  return null
}

export async function saveCache<T>(key: string, value: T, fetchedAt = Date.now()): Promise<Snapshot<T>> {
  const record = { value, fetchedAt }
  await FileManager.createDirectory(base(), true)
  const file = `${base()}/${encodeURIComponent(key)}-${record.fetchedAt}-${Math.random().toString(36).slice(2)}.json`
  await FileManager.writeAsString(file, JSON.stringify(record))
  const prior = Storage.get<Pointer>(pointerKey(key))
  if (!Storage.set(pointerKey(key), { current: file, previous: prior?.current })) throw new Error("缓存指针保存失败")
  if (prior?.previous?.startsWith(base() + "/")) {
    try { await FileManager.remove(prior.previous) } catch { /* Cache cleanup is best effort. */ }
  }
  return record
}
