import { validate } from 'class-validator';
import { SELECTABLE_AI_MODELS, SelectAiModelDto } from './ai.dto';

describe('SelectAiModelDto', () => {
  it('allows the LUNA and SOL models shown in the UI', async () => {
    expect(SELECTABLE_AI_MODELS).toEqual(['gpt-5.6-luna', 'gpt-5.6-sol']);

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
