import { fetch } from "scripting"
import { Hupu } from "./hupu"

// Native Scripting fetch supports timeout in seconds and does not persist cookies.
// This transport only performs anonymous GETs to the two researched source hosts.
export const api = new Hupu(async url => {
  if (!/^https:\/\/(match-api\.hupu\.com|games\.mobileapi\.hupu\.com)\//.test(url)) throw new Error("数据来源域名不在允许范围内")
  const source = url.startsWith("https://match-api.") ? "schedule" : "rating"
  const backoffKey = `nba-source-backoff:${source}`
  const prior = Storage.get<{ until: number; failures: number }>(backoffKey)
  if (prior && prior.until > Date.now()) throw new Error(`数据源暂不可用，请 ${Math.ceil((prior.until - Date.now()) / 1000)} 秒后重试`)
  try {
    const response = await fetch(url, {
    method: "GET",
    timeout: 15,
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      "Referer": "https://m.hupu.com/",
      "Accept": "application/json",
    },
    })
    if (!response.ok) throw new Error(`虎扑数据请求失败（HTTP ${response.status}），请稍后重试`)
    const result = await response.json()
    Storage.remove(backoffKey)
    return result
  } catch (error) {
    const failures = Math.min((prior?.failures ?? 0) + 1, 6)
    Storage.set(backoffKey, { until: Date.now() + Math.min(300000, 10000 * 2 ** (failures - 1)), failures })
    throw error
  }
})
