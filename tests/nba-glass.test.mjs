import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { Hupu, parseSchedule } from '../scripts/NBA-Glass/runtime/hupu.ts'
import { parseBoxScore } from '../scripts/NBA-Glass/runtime/boxscore.ts'
const read = file => JSON.parse(fs.readFileSync(new URL('./fixtures/' + file, import.meta.url)))
const games = parseSchedule(read('schedule.json'))
const game = games.find(game => game.id === '1537445624650137600')
const raw = read('stats.json')
test('full match statistics retain shooting, turnovers, plus/minus, DNP and source totals', () => {
  const box = parseBoxScore(raw, game)
  assert.equal(box.matchId, game.id)
  const warriors = box.teams.find(team => team.id === game.teams[0].id)
  const curry = warriors.players.find(player => player.id === '1901000000442301')
  assert.equal(curry.values.pts, '23')
  assert.equal(curry.values.twoPoints, '7-15')
  assert.equal(curry.values.threePoints, '2-7')
  assert.equal(curry.values.ft, '7-7')
  assert.equal(curry.values.to, '2')
  assert.equal(curry.values.plusMinus, '-22')
  assert.equal(warriors.totals.pts, '105')
  assert.equal(warriors.totals.twoPoints, '38-92')
  assert.equal(warriors.totalsLabel, '球队总计')
  assert.ok(warriors.players.some(player => player.dnp))
  assert.ok(warriors.players.every(player => /^\d+$/.test(player.id)))
  assert.equal(box.teams.find(team => team.id !== warriors.id).totals.pts, '127')
})
test('statistics reject another match, team, player ownership or duplicate ID', () => {
  for (const mutate of [r => r.result.matchId = 'other', r => r.result.homeTeamId = 'other', r => r.result.homePlayers[0].teamId = 'other', r => r.result.homePlayers[0].matchId = 'other', r => r.result.homePlayers.push(r.result.homePlayers[0])]) {
    const changed = structuredClone(raw); mutate(changed)
    assert.throws(() => parseBoxScore(changed, game))
  }
})
test('unknown fields stay unknown; empty pregame is distinct from an invalid response', () => {
  const changed = structuredClone(raw)
  changed.result.homePlayers[0].pts = null
  changed.result.homePlayers = changed.result.homePlayers.filter(row => !row.playerId.includes('-team-'))
  const home = parseBoxScore(changed, game).teams[0]
  assert.equal(home.players[0].values.pts, '—')
  assert.equal(home.totals.pts, '—')
  assert.equal(home.totalsLabel, '球员合计')
  changed.result.homePlayers = []; changed.result.awayPlayers = []
  assert.equal(parseBoxScore(changed, game), null)
  assert.throws(() => parseBoxScore({ success: false }, game))
})
test('single-game refresh reloads a team schedule and rejects a mismatched match', async () => {
  let requests = 0
  const rawSchedule = read('schedule.json')
  const api = new Hupu(async address => {
    const u = new URL(address)
    assert.equal(u.searchParams.get('businessType'), 'team')
    assert.equal(u.searchParams.get('businessId'), game.teams[0].id)
    requests++; return rawSchedule
  })
  const current = await api.match({ ...game, status: 'PENDING', teams: game.teams.map(t => ({ ...t, score: 0 })) })
  assert.equal(requests, 1)
  assert.equal(current.status, 'COMPLETED')
  assert.deepEqual(current.teams.map(t => t.score), [105, 127])
  await assert.rejects(api.match({ ...game, time: game.time + 1000 }), /不匹配/)
  await assert.rejects(api.match({ ...game, id: '123' }), /未返回/)
})
