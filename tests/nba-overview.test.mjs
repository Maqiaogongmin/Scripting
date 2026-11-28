import assert from 'node:assert/strict'
import test from 'node:test'
import { Hupu, mergeSchedule } from '../scripts/NBA-Glass/runtime/hupu.ts'
import { playerBio, playerNumbers } from '../scripts/NBA-Glass/runtime/player.ts'
import { parseStandings } from '../scripts/NBA-Glass/runtime/standings.ts'

test('latest results replace the same game ID while preserving other season games', () => {
  const live = { id: '1', time: 10, status: 'PENDING' }
  const final = { ...live, status: 'COMPLETED' }
  const earlier = { id: '2', time: 5 }
  const newGame = { id: '3', time: 15 }
  assert.deepEqual(mergeSchedule([live, earlier], [final, newGame]), [earlier, final, newGame])
})

test('player endpoints preserve the source ID, distinct ranks and unavailable percentages', async () => {
  const playerId = '1901000000442301'
  const metrics = data => Object.entries(data).map(([name, [quota, rank]]) => ({ name, quota, rank }))
  const row = (pack, regular) => ({ dataDimensionMap: { basic: { [pack]: { REGULAR: metrics(regular) } } } })
  const api = new Hupu(async source => {
    const url = new URL(source)
    assert.equal(url.searchParams.get('playerId'), playerId)
    if (url.pathname.endsWith('playerInfo')) {
      return { result: { playerId, name: '库里', height: 1.88, weight: 92, draft_year: 2009, draftRound: 1, draftPick: 7 } }
    }
    assert.equal(url.searchParams.get('competitionLeagueType'), 'NBA')
    if (url.pathname.endsWith('playerSeasonStats')) {
      return { result: { playerId, season: '2026-2027', ...row('competitionStagePackListMap', { ptsAvg: ['27.8', null], tpp: ['45.7%', 9] }) } }
    }
    return { result: { playerId, ...row('competitionStageTypePackListMap', { pts: ['26806', 17], fgm: ['9102', 25], fga: ['19316', 26], tpm: ['4291', 1], tpa: ['10168', 1], ftm: ['0', 0], fta: ['0', 0] }) } }
  })
  const bio = await playerBio(api, playerId)
  assert.deepEqual([bio.height, bio.weight, bio.draft], ['188 cm', '92 kg', '2009 年第 1 轮第 7 顺位'])
  const season = await playerNumbers(api, playerId, 2026, false)
  assert.equal(season[0].rank, undefined)
  assert.equal(season.find(metric => metric.title === '三分命中率').rank, 9)
  assert.deepEqual(await playerNumbers(api, playerId, 2025, false), [])
  const career = await playerNumbers(api, playerId, 2026, true)
  assert.deepEqual(career[0], { title: '总得分', value: '26806', rank: 17 })
  assert.equal(career.find(metric => metric.title === '投篮命中率').value, '47.1%')
  assert.equal(career.find(metric => metric.title === '罚球命中率').value, '—')
  await assert.rejects(playerBio(new Hupu(async () => ({ result: { playerId: 'wrong' } })), playerId), /不匹配/)
})

test('standings use the provider rank even when arrays arrive reversed or teams are tied', () => {
  const field = (name, value) => ({ name, value })
  const conference = abbreviation => ({ abbreviation, standings: { entries: Array.from({ length: 15 }, (_, i) => ({
    team: { id: i + 1, displayName: 'Team ' + (i + 1) },
    stats: [field('playoffSeed', i + 1), field('wins', 6), field('losses', 6), field('winPercent', 0.5), field('gamesBehind', 0)],
  })).reverse() } })
  const payload = { season: { year: 2027 }, children: [conference('West'), conference('East')] }
  const result = parseStandings(payload, 2027)
  assert.deepEqual([result.East.length, result.West.length], [15, 15])
  assert.equal(result.East[0].name, 'Team 1')
  assert.equal(result.West[14].rank, 15)
  assert.throws(() => parseStandings(payload, 2026), /赛季/)
  payload.children[0].standings.entries.pop()
  assert.throws(() => parseStandings(payload, 2027), /球队不完整/)
})
