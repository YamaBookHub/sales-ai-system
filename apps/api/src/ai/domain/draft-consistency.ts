export type DraftConsistencyInput = {
  companyName: string;
  projectTitle?: string | null;
  body?: string | null;
  factsUsed?: string[] | null;
  knownCompanyNames?: string[];
  minBodyLength?: number;
};

export type DraftConsistencyWarning = {
  code: string;
  message: string;
  severity: 'warning';
};

export type DraftConsistencyResult = {
  warnings: DraftConsistencyWarning[];
  hasWarnings: boolean;
};

export function checkDraftConsistency(input: DraftConsistencyInput): DraftConsistencyResult {
  const body = normalizeText(input.body || '');
  const companyName = normalizeText(input.companyName);
  const warnings: DraftConsistencyWarning[] = [];
  const minBodyLength = input.minBodyLength ?? 80;

  if (!body || body.length < minBodyLength) {
    warnings.push(warning('body_too_short', '本文が空、または極端に短いため内容を確認してください。'));
  }

  if (hasTemplateVariable(input.body || '')) {
    warnings.push(warning('template_variable_left', '本文に未置換のテンプレート変数が残っています。'));
  }

  if (companyName && !normalizeText(firstAddressLines(input.body || '')).includes(companyName)) {
    warnings.push(warning('recipient_company_mismatch', '宛名に選択会社名が見つかりません。'));
  }

  const otherCompanyName = (input.knownCompanyNames || [])
    .filter((name) => normalizeText(name) && normalizeText(name) !== companyName)
    .find((name) => body.includes(normalizeText(name)));
  if (otherCompanyName) {
    warnings.push(warning('other_company_name', `本文に別会社名「${otherCompanyName}」が残っています。`));
  }

  const keywords = extractImportantKeywords(input.projectTitle || '');
  if (keywords.length && !keywords.some((keyword) => body.includes(keyword))) {
    warnings.push(warning('project_keyword_missing', '案件名の重要語が本文に見つかりません。商品・案件の一致を確認してください。'));
  }

  const unsupportedNumber = extractNumericClaims(input.body || '').find((claim) => {
    const facts = normalizeText((input.factsUsed || []).join(' ')).replace(/,/g, '');
    return !facts.includes(claim.replace(/,/g, ''));
  });
  if (unsupportedNumber) {
    warnings.push(warning('unsupported_numeric_claim', `factsUsedにない数値実績「${unsupportedNumber}」が本文に含まれている可能性があります。`));
  }

  return { warnings, hasWarnings: warnings.length > 0 };
}

export function normalizeText(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

function firstAddressLines(body: string) {
  return body.split(/[\r\n]/).slice(0, 2).join(' ');
}

function hasTemplateVariable(body: string) {
  return /\{\{?[^{}]+\}?\}|【[^】]+】|\[\[[^\]]+\]\]/.test(body);
}

function extractImportantKeywords(title: string) {
  const normalizedTitle = normalizeText(title);
  const pieces = title
    .normalize('NFKC')
    .split(/[｜|、。:：!！?？\s「」『』（）()【】［］]/)
    .map((piece) => normalizeText(piece))
    .filter((piece) => piece.length >= 2);
  return Array.from(new Set(pieces.length ? pieces : normalizedTitle.length >= 2 ? [normalizedTitle] : []));
}

function extractNumericClaims(body: string) {
  return Array.from(new Set(body.match(/\d[\d,]*(?:\.\d+)?(?:万円|万|円|人|件|%|％)?/g) || []));
}

function warning(code: string, message: string): DraftConsistencyWarning {
  return { code, message, severity: 'warning' };
}
