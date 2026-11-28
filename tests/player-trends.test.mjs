import assert from 'node:assert/strict'
import test from 'node:test'
import { Hupu } from '../scripts/NBA-Glass/runtime/hupu.ts'
import { careerPlayerSeasons, recentPlayerGames, playerBio, playerShotMap } from '../scripts/NBA-Glass/runtime/player.ts'

const playerId = '880449725529063424'
function table(paths, rows) {
  return { tableHeaderFieldList: paths.map(navigationPath => ({ navigationPath })), statsRowList: rows.map(quotaList => ({ quotaList })) }
}

test('recent game trend skips DNP and preserves a true zero across the calendar year', async () => {
  const regular = { classify: 'REGULAR', ...table(
    ['model.reb', 'model.pts', 'model.asts', 'opponentTeamName', 'matchTime', 'preciseMins'],
    [['0', '0', '0', '球队甲', '2027-01-03', '0'], ['5', '0', '3', '球队乙', '2027-01-02', '22.2'], ['6', '12', '4', '球队丙', '2026-12-30', '31.4']],
  ) }
  const api = new Hupu(async url => {
    assert.equal(new URL(url).searchParams.get('season'), '2026-2027')
    return { result: { playerId, season: '2026-2027', statsClassifyList: [regular] } }
  })
  assert.deepEqual((await recentPlayerGames(api, playerId, 2026)).map(row => [row.label, row.pts]), [['12-30', 12], ['01-02', 0]])
})

test('career charts combine team stints using total counting stats and games played', async () => {
  const sum = table(
    ['seasonWrapper', 'teamName', 'gamesPack', 'model.basic.pts', 'model.basic.reb', 'model.basic.ast'],
    [['生涯', '-', '16/16', '205', '35', '40'], ['26-27', '球队甲', '5/5', '50', '10', '10'], ['25-26', '球队甲', '1/1', '5', '5', '3'], ['25-26', '球队乙', '10/10', '150', '20', '27']],
  )
  const api = new Hupu(async () => ({ result: { playerId, competitionStageMap: { REGULAR: { statsClassifyMap: { SUM: sum } } } } }))
  const trend = await careerPlayerSeasons(api, playerId)
  assert.deepEqual(trend.map(row => row.label), ['25-26', '26-27'])
  assert.equal(trend[0].detail, '11 场')
  assert.equal(trend[0].pts, 155 / 11)
  assert.equal(trend[1].pts, 10)
})

test('season selection uses weighted totals including shooting after a trade', async () => {
  const sum = table(['seasonWrapper', 'gamesPack', 'model.basic.pts', 'model.basic.reb', 'model.basic.ast', 'model.basic.stl', 'fgSumPack'],
    [['26-27', '2/2', '20', '6', '4', '0', '4/8'], ['26-27', '1/3', '45', '9', '6', '5', '9/30']])
  const api = new Hupu(async () => ({ result: { playerId, competitionStageMap: { REGULAR: { statsClassifyMap: { SUM: sum } } } } }))
  const [season] = await careerPlayerSeasons(api, playerId)
  const values = Object.fromEntries(season.metrics.map(row => [row.title, row.value]))
  assert.equal(values['首发'], '3')
  assert.equal(values['场均抢断'], '1.0')
  assert.equal(values['投篮命中率'], '34.2%')
  assert.equal(values['场均时间（分钟）'], '—')
})

test('salary and contract use the verified player record and keep missing salaries absent', async () => {
  const api = new Hupu(async () => ({ result: { playerId, salary: 50110000, salaryRank: 13, contractDetails: '5年2.69亿美元\n#2026-27赛季 5011万美元' } }))
  const bio = await playerBio(api, playerId)
  assert.equal(bio.salary, 50110000)
  assert.equal(bio.salaryRank, 13)
  assert.equal(bio.contract, '5年2.69亿美元\n2026-27赛季 5011万美元')
  assert.equal((await playerBio(new Hupu(async () => ({ result: { playerId } })), playerId)).salary, undefined)
})

test('heat map binds player, season, stage and all 14 regions; zero attempts remain empty', async () => {
  const result = { playerId, competitionSeasonStageType: { competitionSeasonType: { season: '2026-2027' }, competitionStageTypeName: 'REGULAR' },
    shootAreaDTOList: Array.from({ length: 14 }, (_, i) => ({ areaId: String(i + 1), fgm: '0', fgs: '0', level: '0' })) }
  const api = new Hupu(async () => ({ result: structuredClone(result) }))
  assert.equal((await playerShotMap(api, playerId, 2026)).areas[0].attempts, 0)
  await assert.rejects(playerShotMap(api, playerId, 2025), /赛季不匹配/)
  for (const mutate of [r => { r.playerId = 'other' }, r => { r.shootAreaDTOList[0].areaId = '2' }, r => { r.shootAreaDTOList[0].fgm = '1' }]) {
    const copy = structuredClone(result); mutate(copy)
    await assert.rejects(playerShotMap(new Hupu(async () => ({ result: copy })), playerId, 2026))
  }
})
