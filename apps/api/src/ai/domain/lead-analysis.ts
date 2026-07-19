import { createHash } from 'crypto';

export const LEAD_ANALYSIS_FIELDS = ['appeal', 'targetUser', 'videoIdea'] as const;
export type LeadAnalysisField = (typeof LEAD_ANALYSIS_FIELDS)[number];
export type StructuredLeadAnalysis = Record<LeadAnalysisField, string | null>;

export type AnalysisProjectSource = {
  id: string;
  title: string;
  url: string;
  category?: string | null;
  description?: string | null;
};

export function projectSourceFingerprint(project: AnalysisProjectSource) {
  const source = [project.id, project.title, project.url, project.category || '', project.description || ''].join('\u001f');
  return createHash('md5').update(source, 'utf8').digest('hex');
}

export function normalizeStructuredAnalysis(values: Partial<StructuredLeadAnalysis>): StructuredLeadAnalysis {
  return {
    appeal: normalizeValue(values.appeal),
    targetUser: normalizeValue(values.targetUser),
    videoIdea: normalizeValue(values.videoIdea)
  };
}

export function missingAnalysisFields(values?: Partial<StructuredLeadAnalysis> | null): LeadAnalysisField[] {
  const normalized = normalizeStructuredAnalysis(values || {});
  return LEAD_ANALYSIS_FIELDS.filter((field) => !normalized[field]);
}

export function isCompleteStructuredAnalysis(values?: Partial<StructuredLeadAnalysis> | null) {
  return missingAnalysisFields(values).length === 0;
}

export function editedAnalysisFields(
  before: Partial<StructuredLeadAnalysis> | null | undefined,
  after: Partial<StructuredLeadAnalysis>
): LeadAnalysisField[] {
  const previous = normalizeStructuredAnalysis(before || {});
  const next = normalizeStructuredAnalysis(after);
  return LEAD_ANALYSIS_FIELDS.filter((field) => previous[field] !== next[field]);
}

function normalizeValue(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
}
