import { ProjectSearchDiagnostics } from './project-source-provider';
import { SearchCampfireProjectsDto } from '../projects.dto';

export type ProjectSearchCompletionReason =
  | 'desired_reached'
  | 'source_exhausted'
  | 'condition_shortage'
  | 'excluded_existing'
  | 'cancelled'
  | 'failed';

export function decideProjectSearchCompletion(input: {
  desiredLimit: number;
  importableCount: number;
  dto: SearchCampfireProjectsDto;
  diagnostics?: ProjectSearchDiagnostics;
}): ProjectSearchCompletionReason {
  if (input.importableCount >= input.desiredLimit) return 'desired_reached';

  const diagnostics = input.diagnostics;
  const shortage = input.desiredLimit - input.importableCount;
  if (
    diagnostics &&
    diagnostics.excludedCount >= shortage &&
    diagnostics.conditionMatchedCount >= input.desiredLimit
  ) {
    return 'excluded_existing';
  }
  if (!diagnostics?.scanComplete) return 'failed';
  return hasRestrictiveSearchCondition(input.dto) ? 'condition_shortage' : 'source_exhausted';
}

export function projectSearchCompletionMessage(input: {
  reason: ProjectSearchCompletionReason;
  desiredLimit: number;
  itemCount: number;
  importableCount: number;
  errorMessage?: string;
}) {
  switch (input.reason) {
    case 'desired_reached':
      return `指定${input.desiredLimit}件を取得したため完了しました`;
    case 'source_exhausted':
      return `取得元で確認できる候補が${input.importableCount}件のため完了しました`;
    case 'condition_shortage':
      return `条件一致が${input.importableCount}件のため完了しました`;
    case 'excluded_existing':
      return `取込済み等を除外し、取込可能が${input.importableCount}件のため完了しました`;
    case 'cancelled':
      return `検索を停止しました（候補${input.itemCount}件）`;
    case 'failed':
      return input.errorMessage ? `検索に失敗しました: ${input.errorMessage}` : '取得元の確認を完了できませんでした';
  }
}

function hasRestrictiveSearchCondition(dto: SearchCampfireProjectsDto) {
  return Boolean(
    dto.keyword?.trim() ||
      dto.category?.trim() ||
      dto.status === 'endingSoon' ||
      typeof dto.amountMin === 'number' ||
      typeof dto.amountMax === 'number' ||
      typeof dto.supporterMin === 'number' ||
      typeof dto.supporterMax === 'number' ||
      typeof dto.profileProjectMin === 'number' ||
      typeof dto.profileProjectMax === 'number'
  );
}
