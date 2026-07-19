import {
  editedAnalysisFields,
  isCompleteStructuredAnalysis,
  missingAnalysisFields,
  normalizeStructuredAnalysis,
  projectSourceFingerprint
} from './lead-analysis';

describe('lead-analysis', () => {
  it('builds a stable fingerprint from mail-relevant project facts', () => {
    const project = { id: 'project_1', title: '案件名', url: 'https://example.com/1', category: '食品', description: '説明' };
    expect(projectSourceFingerprint(project)).toBe(projectSourceFingerprint({ ...project }));
    expect(projectSourceFingerprint({ ...project, title: '変更後' })).not.toBe(projectSourceFingerprint(project));
  });

  it('normalizes blanks and reports missing fields', () => {
    const values = normalizeStructuredAnalysis({ appeal: '  魅力  ', targetUser: ' ', videoIdea: null });
    expect(values).toEqual({ appeal: '魅力', targetUser: null, videoIdea: null });
    expect(missingAnalysisFields(values)).toEqual(['targetUser', 'videoIdea']);
    expect(isCompleteStructuredAnalysis(values)).toBe(false);
  });

  it('detects only changed values', () => {
    expect(editedAnalysisFields(
      { appeal: '魅力', targetUser: '対象', videoIdea: '動画' },
      { appeal: '新しい魅力', targetUser: '対象', videoIdea: '動画' }
    )).toEqual(['appeal']);
  });
});
