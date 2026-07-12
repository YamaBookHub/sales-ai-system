import { BadGatewayException } from '@nestjs/common';
import { parseSemanticConsistencyJson } from './semantic-consistency';

describe('semantic-consistency', () => {
  it('accepts the strict semantic consistency result shape', () => {
    expect(parseSemanticConsistencyJson(JSON.stringify({
      matchesProject: false,
      suspectedForeignFacts: ['別案件の支援額かもしれません'],
      reason: '本文の実績が案件情報と一致しません。',
      confidence: 0.78
    }))).toEqual({
      matchesProject: false,
      suspectedForeignFacts: ['別案件の支援額かもしれません'],
      reason: '本文の実績が案件情報と一致しません。',
      confidence: 0.78
    });
  });

  it('rejects malformed or out-of-range AI output', () => {
    expect(() => parseSemanticConsistencyJson('{broken')).toThrow(BadGatewayException);
    expect(() => parseSemanticConsistencyJson(JSON.stringify({
      matchesProject: true,
      suspectedForeignFacts: [],
      reason: 'ok',
      confidence: 1.2
    }))).toThrow(BadGatewayException);
  });
});
