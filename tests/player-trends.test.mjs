import assert from 'node:assert/strict'
import test from 'node:test'
import { Hupu } from '../scripts/NBA-Glass/runtime/hupu.ts'
import { careerPlayerSeasons, recentPlayerGames } from '../scripts/NBA-Glass/runtime/player.ts'

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
