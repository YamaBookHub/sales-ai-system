import { validate } from 'class-validator';
import { GenerateMailDto, SELECTABLE_AI_MODELS, SelectAiModelDto, UpdateLeadAnalysisDto } from './ai.dto';

describe('SelectAiModelDto', () => {
  it('allows the Gemini and OpenAI models shown in the UI', async () => {
    expect(SELECTABLE_AI_MODELS).toEqual([
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash',
      'gpt-4.1-mini',
      'gpt-5.6-luna',
      'gpt-5.6-sol'
    ]);

    for (const model of SELECTABLE_AI_MODELS) {
      const dto = new SelectAiModelDto();
      dto.model = model;
      await expect(validate(dto)).resolves.toEqual([]);
    }
  });

  it('keeps the model optional for existing API clients', async () => {
    await expect(validate(new SelectAiModelDto())).resolves.toEqual([]);
  });

  it('rejects model names outside the server allowlist', async () => {
    const dto = new SelectAiModelDto();
    dto.model = 'gpt-unknown' as never;

    const errors = await validate(dto);

    expect(errors[0]?.constraints?.isIn).toBeDefined();
  });
});

describe('structured analysis DTOs', () => {
  it('requires a confirmed analysis revision when generating mail', async () => {
    const dto = new GenerateMailDto();
    dto.templateKey = 'normal';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'analysisRevisionId')).toBe(true);
  });

  it('accepts analysis values only with the project fingerprint read by the editor', async () => {
    const dto = new UpdateLeadAnalysisDto();
    dto.expectedVersion = 1;
    dto.expectedSourceFingerprint = '0123456789abcdef0123456789abcdef';
    dto.appeal = '商品の魅力';
    dto.targetUser = '想定する相手';
    dto.videoIdea = '動画での見せ方';

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects a missing project fingerprint', async () => {
    const dto = new UpdateLeadAnalysisDto();
    dto.expectedVersion = 1;
    dto.appeal = '';
    dto.targetUser = '';
    dto.videoIdea = '';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'expectedSourceFingerprint')).toBe(true);
  });
});
