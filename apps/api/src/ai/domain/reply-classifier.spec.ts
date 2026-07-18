import { classifyReplyText } from './reply-classifier';

describe('reply-classifier', () => {
  const now = new Date('2026-07-11T00:00:00.000Z');

  it('classifies unsubscribe replies as rejected', () => {
    const result = classifyReplyText('今後のご連絡は不要です。配信停止をお願いします。', now);
    expect(result.category).toBe('unsubscribe');
    expect(result.leadStatus).toBe('rejected');
    expect(result.nextActionAt).toBeUndefined();
  });

  it('keeps a polite rejection separate from an explicit unsubscribe', () => {
    const result = classifyReplyText('今回は不要です。検討しましたがお断りします。', now);
    expect(result.category).toBe('not_interested');
    expect(result.leadStatus).toBe('no_response');
    expect(result.nextActionAt).toBeUndefined();
  });

  it('classifies interested replies for same-day action', () => {
    const result = classifyReplyText('ぜひ前向きに検討したいです。', now);
    expect(result.category).toBe('interested');
    expect(result.leadStatus).toBe('replied');
    expect(result.nextActionAt?.toISOString()).toBe(now.toISOString());
  });

  it('classifies requests for details as next-day information follow-up', () => {
    const result = classifyReplyText('料金と詳しい支援内容を教えてください。', now);
    expect(result.category).toBe('need_info');
    expect(result.leadStatus).toBe('replied');
    expect(result.nextActionAt?.toISOString()).toBe('2026-07-12T00:00:00.000Z');
  });

  it('classifies complaints for same-day manager action', () => {
    const result = classifyReplyText('この連絡は迷惑です。責任者から説明してください。', now);
    expect(result.category).toBe('complaint');
    expect(result.leadStatus).toBe('replied');
    expect(result.nextActionAt?.toISOString()).toBe(now.toISOString());
  });

  it('classifies meeting replies with next action date', () => {
    const result = classifyReplyText('ぜひZoomで打ち合わせしたいです。候補日をください。', now);
    expect(result.category).toBe('meeting_request');
    expect(result.leadStatus).toBe('meeting_candidate');
    expect(result.nextActionAt?.toISOString()).toBe(now.toISOString());
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
    expect(result.nextActionAt?.toISOString()).toBe(now.toISOString());
  });
});
