import { buildLocalLeadAnalysis } from './local-lead-analysis';
import { buildLocalMailDraft, buildLocalMailInput } from './local-mail-draft';
import { mailGoldenDataset, MailGoldenCase } from './fixtures/mail-golden-dataset';

const forbiddenRawMailWords = ['TODO', '未取得', '確認してください', 'カテゴリーからさがす', '達成率', '残り日数'];

function buildLead(goldenCase: MailGoldenCase) {
  return {
    reason: `${goldenCase.source}で${goldenCase.projectCategory}のプロジェクトを確認`,
    sendMethod: 'email',
    brandAnalysisMemo: goldenCase.brandAnalysisMemo,
    snsAnalysisMemo: null,
    company: { name: goldenCase.companyName },
    project: {
      title: goldenCase.projectTitle,
      platform: { name: goldenCase.source, type: goldenCase.source === 'CAMPFIRE' ? 'campfire' : 'makuake' },
      url: `https://example.com/projects/${goldenCase.id}`,
      category: goldenCase.projectCategory,
      description: goldenCase.projectDescription,
      amount: null,
      supporterCount: null
    }
  };
}

describe('mail golden dataset', () => {
  it.each(mailGoldenDataset)('$id keeps mail and analysis facts within the case', (goldenCase) => {
    const lead = buildLead(goldenCase);
    const analysis = buildLocalLeadAnalysis(lead);
    const localMailInput = buildLocalMailInput(
      lead,
      { templateKey: 'normal', tone: '丁寧', analysisRevisionId: '00000000-0000-4000-8000-000000000001' },
      undefined,
      analysis.output.mailPlaceholders
    );
    const draft = buildLocalMailDraft(localMailInput);
    const analysisText = JSON.stringify(analysis.output);

    expect(draft.model).toBe('local-template-v2');
    expect(draft.subject).toContain(goldenCase.source);
    expect(draft.body).toContain(goldenCase.companyName);
    expect(draft.body).toContain(goldenCase.projectTitle);
    for (const word of forbiddenRawMailWords) expect(draft.body).not.toContain(word);
    expect(draft.body).not.toMatch(/魅力(?:です)?が(?:とても|特に)|ですが(?:とても|特に)/);
    for (const word of goldenCase.expectedAppealWords) expect(draft.body).toContain(word);
    for (const word of goldenCase.expectedTargetWords) expect(draft.body).toContain(word);

    expect(analysis.output.summary).toContain(goldenCase.companyName);
    expect(analysis.output.summary).toContain(goldenCase.projectTitle);
    expect(analysis.output.factsUsed).toContain(`取得元: ${goldenCase.source}`);
    expect(analysis.output.mailPlaceholders.appeal).toContain(goldenCase.expectedAppealWords[0]);
    expect(analysis.output.mailPlaceholders.targetUser).toContain(goldenCase.expectedTargetWords[0]);

    for (const word of goldenCase.forbiddenWords) {
      expect(draft.body).not.toContain(word);
      expect(analysisText).not.toContain(word);
    }
  });

  it('keeps event mail language separate from product and family-use language', () => {
    const eventCase = mailGoldenDataset.find(({ id }) => id === 'music-anniversary-event');
    expect(eventCase).toBeDefined();

    const lead = buildLead(eventCase!);
    const analysis = buildLocalLeadAnalysis(lead);
    const draft = buildLocalMailDraft(buildLocalMailInput(
      lead,
      { templateKey: 'normal', analysisRevisionId: '00000000-0000-4000-8000-000000000001' },
      undefined,
      analysis.output.mailPlaceholders
    ));

    for (const word of eventCase!.forbiddenMailWords || []) expect(draft.body).not.toContain(word);
    expect(draft.body).toContain('取り組み');
  });

  it('keeps event analysis language separate from product and family-use language', () => {
    const eventCase = mailGoldenDataset.find(({ id }) => id === 'music-anniversary-event');
    expect(eventCase).toBeDefined();

    const analysis = buildLocalLeadAnalysis(buildLead(eventCase!));
    const analysisText = JSON.stringify(analysis.output);

    for (const word of eventCase!.forbiddenMailWords || []) expect(analysisText).not.toContain(word);
  });
});
