import { NotFoundException } from '@nestjs/common';
import { CheckMailDraftConsistencyUseCase } from './check-mail-draft-consistency.usecase';

describe('CheckMailDraftConsistencyUseCase', () => {
  const email = {
    id: 'mail_1',
    body: '株式会社テスト食品 ご担当者様\n燻製サーモンの新商品プロジェクトを拝見しました。\n支援額1,000,000円、支援者数50人の実績を確認しています。\n弊社の支援内容をご案内できます。',
    company: { name: '株式会社テスト食品' },
    lead: { company: { name: '株式会社テスト食品' }, project: { title: '燻製サーモンの新商品プロジェクト' } },
    aiGenerations: [{ outputJson: { factsUsed: ['支援額: 1,000,000円', '支援者数: 50人'] } }]
  };

  it('checks the persisted mail with lead context and latest AI facts', async () => {
    const prisma = {
      outreachEmail: { findUnique: jest.fn().mockResolvedValue(email) },
      company: { findMany: jest.fn().mockResolvedValue([{ name: '株式会社テスト食品' }, { name: '別会社株式会社' }]) }
    };
    const useCase = new CheckMailDraftConsistencyUseCase(prisma as any);

    await expect(useCase.execute('mail_1')).resolves.toEqual({ warnings: [], hasWarnings: false });
    expect(prisma.company.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      select: { name: true },
      take: 500
    });
  });

  it('returns not found when the mail does not exist', async () => {
    const prisma = {
      outreachEmail: { findUnique: jest.fn().mockResolvedValue(null) },
      company: { findMany: jest.fn() }
    };
    const useCase = new CheckMailDraftConsistencyUseCase(prisma as any);

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.company.findMany).not.toHaveBeenCalled();
  });
});
