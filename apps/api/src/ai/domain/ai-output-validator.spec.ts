import { BadGatewayException } from '@nestjs/common';
import { parseMailDraftJson } from './ai-output-validator';

describe('ai-output-validator', () => {
  it('parses a valid mail draft JSON output', () => {
    expect(
      parseMailDraftJson(JSON.stringify({
        subject: ' 件名 ',
        body: ' 本文 ',
        factsUsed: ['fact'],
        assumptions: ['assumption'],
        riskFlags: ['risk']
      }))
    ).toEqual({
      subject: '件名',
      body: '本文',
      factsUsed: ['fact'],
      assumptions: ['assumption'],
      riskFlags: ['risk']
    });
  });

  it('rejects broken JSON', () => {
    expect(() => parseMailDraftJson('{broken')).toThrow(BadGatewayException);
  });

  it('rejects missing required fields', () => {
    expect(() => parseMailDraftJson(JSON.stringify({ subject: '件名' }))).toThrow(BadGatewayException);
  });
});
