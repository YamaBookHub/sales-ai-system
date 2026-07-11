import { classifyReplyText } from './reply-classifier';

describe('reply-classifier', () => {
  const now = new Date('2026-07-11T00:00:00.000Z');

  it('classifies unsubscribe replies as rejected', () => {
    const result = classifyReplyText('今後のご連絡は不要です。配信停止をお願いします。', now);
    expect(result.category).toBe('unsubscribe');
    expect(result.leadStatus).toBe('rejected');
    expect(result.nextActionAt).toBeUndefined();
  });

  it('classifies meeting replies with next action date', () => {
    const result = classifyReplyText('ぜひZoomで打ち合わせしたいです。候補日をください。', now);
    expect(result.category).toBe('meeting_request');
    expect(result.leadStatus).toBe('meeting_candidate');
    expect(result.nextActionAt?.toISOString()).toBe('2026-07-12T00:00:00.000Z');
  });

  it('classifies auto replies with a three day follow-up', () => {
    const result = classifyReplyText('out of office 自動返信です。', now);
    expect(result.category).toBe('auto_reply');
    expect(result.leadStatus).toBe('contacted');
    expect(result.nextActionAt?.toISOString()).toBe('2026-07-14T00:00:00.000Z');
  });

  it('falls back to unknown while preserving a short summary', () => {
    const result = classifyReplyText('確認しました。', now);
    expect(result.category).toBe('unknown');
    expect(result.summary).toBe('確認しました。');
    expect(result.leadStatus).toBe('replied');
  });
});
