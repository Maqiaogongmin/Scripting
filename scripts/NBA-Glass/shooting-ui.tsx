import { Canvas, DisclosureGroup, HStack, ProgressView, Text, VStack, useEffect, useState } from "scripting"
import { api } from "./runtime/client"
import { readCache, saveCache } from "./runtime/cache"
import { playerShotMap, type ShotMap } from "./runtime/player"
import { colors, Surface } from "./ui"

const areaNames = ["篮下", "左侧近距离", "中路近距离", "右侧近距离", "右侧底线中投", "右侧中投", "正面中投", "左侧中投", "左侧底线中投", "左底角三分", "左翼三分", "正面三分", "右翼三分", "右底角三分"]
const fills = ["#D5DCE4", "#F6B198", "#F0D78E", "#A7CAE5"] as const

export function ShootingMap({ player, year, refreshing }: { player: { id: string }; year: number; refreshing: boolean }) {
  const c = colors()
  const [data, setData] = useState<ShotMap | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    if (refreshing) return
    let active = true
    const key = `shot-${player.id}-${year}`
    async function load() {
      setBusy(true); setError("")
      try {
        const prior = (await readCache<ShotMap>(key))?.value
        if (active && prior) setData(prior)
        const next = await playerShotMap(api, player.id, year)
        if (active) setData(next)
        if (next) await saveCache(key, next)
      } catch { if (active) setError("热区更新失败") }
      finally { if (active) setBusy(false) }
    }
    void load()
    return () => { active = false }
  }, [player.id, year, refreshing])
  const hasShots = data?.areas.some(area => area.attempts > 0)
  return <Surface><VStack alignment="leading" spacing={14} fixedSize={{ horizontal: false, vertical: true }}>
    <Text font="headline" foregroundStyle={c.primary}>{`${year}–${String(year + 1).slice(-2)} 投篮热区 · 常规赛`}</Text>
    {busy && !data ? <ProgressView /> : null}
    {error ? <Text font="caption" foregroundStyle={c.secondary}>{error}</Text> : null}
    {data && hasShots ? <>
      <HStack frame={{ maxWidth: "infinity", alignment: "center" }}><Canvas opaque={false} aspectRatio={{ value: 50 / 40, contentMode: "fit" }} frame={{ maxWidth: 500 }}
        accessibilityLabel="投篮热区图。各区域的精确命中率和命中、出手次数可在区域明细查看。"
        draw={(ctx, size) => {
          const scale = size.width / 50
          const px = (x: number) => x * scale
          const py = (y: number) => y * scale
          const point = (radius: number, angle: number) => ({ x: 25 + radius * Math.cos(angle * Math.PI / 180), y: 5.25 + radius * Math.sin(angle * Math.PI / 180) })
          ctx.save()
          ctx.beginPath(); ctx.rect(0, 0, size.width, size.height); ctx.clip()
          function paint(id: number) {
            const area = data!.areas[id - 1]
            ctx.fillStyle = fills[area.attempts && area.level >= 1 && area.level <= 3 ? area.level : 0]
            ctx.fill(); ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 1.5; ctx.stroke()
          }
          function band(id: number, inner: number, outer: number, start: number, end: number) {
            ctx.beginPath()
            const first = point(inner, start); ctx.moveTo(px(first.x), py(first.y))
            for (let a = start; a <= end; a += 2) { const p = point(outer, a); ctx.lineTo(px(p.x), py(p.y)) }
            const last = point(outer, end); ctx.lineTo(px(last.x), py(last.y))
            for (let a = end; a >= start; a -= 2) { const p = point(inner, a); ctx.lineTo(px(p.x), py(p.y)) }
            ctx.closePath(); paint(id)
          }
          // Hupu NBA's 14 area IDs, drawn in a half-court coordinate system (feet).
          band(11, 23.75, 65, 110, 200); band(12, 23.75, 65, 70, 110); band(13, 23.75, 65, -20, 70)
          band(9, 16, 23.75, 150, 200); band(8, 16, 23.75, 110, 150); band(7, 16, 23.75, 70, 110)
          band(6, 16, 23.75, 30, 70); band(5, 16, 23.75, -20, 30)
          band(2, 8, 16, 120, 220); band(3, 8, 16, 60, 120); band(4, 8, 16, -40, 60)
          ctx.beginPath(); ctx.arc(px(25), py(5.25), px(8), 0, Math.PI * 2); paint(1)
          ctx.beginPath(); ctx.rect(0, 0, px(3), py(14)); paint(10)
          ctx.beginPath(); ctx.rect(px(47), 0, px(3), py(14)); paint(14)
          ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 1.5
          ctx.strokeRect(px(17), 0, px(16), py(19))
          ctx.beginPath(); ctx.arc(px(25), py(19), px(6), 0, Math.PI); ctx.stroke()
          ctx.strokeStyle = "#344558"
          ctx.beginPath(); ctx.moveTo(px(22), py(4)); ctx.lineTo(px(28), py(4)); ctx.stroke()
          ctx.beginPath(); ctx.arc(px(25), py(5.25), px(0.75), 0, Math.PI * 2); ctx.stroke()
          const positions = [[25, 10], [14, 8], [25, 17.5], [36, 8], [44, 7], [41, 21], [25, 26], [9, 21], [6, 7], [1.5, 7], [8, 33], [25, 36], [42, 33], [48.5, 7]]
          positions.forEach(([x, y], i) => {
            const area = data!.areas[i]
            ctx.save(); ctx.translate(px(x), py(y))
            if (i === 9 || i === 13) ctx.rotate(-Math.PI / 2)
            ctx.fillStyle = "#17212B"; ctx.font = size.width < 370 ? 11 : 14; ctx.textAlign = "center"; ctx.textBaseline = "middle"
            ctx.fillText(area.attempts ? `${Math.round(100 * area.made / area.attempts)}%` : "—", 0, 0)
            ctx.restore()
          })
          ctx.restore()
        }} /></HStack>
      <HStack spacing={12}>
        {["高于平均", "平均", "低于平均"].map((label, i) => <Text key={label} font="caption2" foregroundStyle="#17212B" padding={{ horizontal: 7, vertical: 4 }} background={fills[i + 1]} clipShape={{ type: "rect", cornerRadius: 4 }}>{label}</Text>)}
      </HStack>
      <DisclosureGroup title="区域明细">
        <VStack spacing={10} padding={{ top: 8 }}>
          {data.areas.map(area => <HStack key={area.id} spacing={8}>
            <Text font="caption" foregroundStyle={c.secondary} frame={{ maxWidth: "infinity", alignment: "leading" }}>{areaNames[area.id - 1]}</Text>
            <Text font="caption" foregroundStyle={c.primary} monospacedDigit>{area.attempts ? `${(100 * area.made / area.attempts).toFixed(1)}%` : "—"}</Text>
            <Text font="caption" foregroundStyle={c.secondary} monospacedDigit frame={{ width: 68, alignment: "trailing" }}>{`${area.made}/${area.attempts}`}</Text>
          </HStack>)}
          <Text font="caption2" foregroundStyle={c.secondary}>命中率 · 命中 / 出手</Text>
        </VStack>
      </DisclosureGroup>
      {data.updated ? <Text font="caption2" foregroundStyle={c.secondary}>{`虎扑 · ${data.updated}`}</Text> : null}
    </> : !busy && !error ? <Text font="caption" foregroundStyle={c.secondary}>暂无投篮热区</Text> : null}
  </VStack></Surface>
}
