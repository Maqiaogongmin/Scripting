import test from 'node:test'
import assert from 'node:assert/strict'
import { commentText, Hupu } from '../scripts/NBA-Glass/runtime/hupu.ts'

const promo = JSON.stringify({ miguVideo: { promotion: { way: {}, extraData: { deepLink: 'miguvideo://test?x={hi}', label: '引号 " 与反斜杠 \\ }' } } } })
test('remove nested promotions while retaining text on both sides and multiple attachments', () => {
  assert.equal(commentText(`正文🐺\n${promo}继续评论${promo}！`), '正文🐺\n继续评论！')
})
test('truncated promotion tails do not leak JSON or tracking fields', () => {
  for (let cut = '{"miguVideo":'.length; cut < promo.length; cut++) {
    assert.equal(commentText('正常评论' + promo.slice(0, cut)), '正常评论')
  }
  assert.equal(commentText('正文{  "miguVideo" : {"promotion":'), '正文')
})
test('ordinary long text, emoji, newlines, JSON and braces are preserved', () => {
  for (const text of ['普通正文🐺\n第二行', '投篮 {7/15}，不错', '{"promotion":"讨论数据","deepLink":"example"}', '评论'.repeat(3000)]) {
    assert.equal(commentText(text), text)
  }
})
test('empty/non-string content stays empty and cleaning is idempotent', () => {
  for (const value of [null, undefined, {}, 123, '', promo]) assert.equal(commentText(value), '')
  const text = `正文${promo}结尾`
  assert.equal(commentText(commentText(text)), commentText(text))
})
test('latest comments are cleaned without changing metadata or pagination', async () => {
  const api = new Hupu(async () => ({ success: true, data: {
    comments: [{ commentId: '123', subjectId: '456', commentUserName: '测试用户', commentContent: `正文${promo}结尾`, lightCount: 4 }],
    cursor: { publishTime: 100 }, hasMore: true,
  } }))
  const page = await api.comments({ key: { outBizType: 'player', outBizNo: '1' } }, 200)
  assert.equal(page.comments[0].text, '正文结尾')
  assert.equal(page.comments[0].id, '123')
  assert.equal(page.comments[0].user, '测试用户')
  assert.equal(page.comments[0].likes, 4)
  assert.equal(page.cursor, 100)
  assert.equal(page.hasMore, true)
})
