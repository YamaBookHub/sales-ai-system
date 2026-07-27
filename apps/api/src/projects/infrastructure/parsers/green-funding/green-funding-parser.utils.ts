import type * as cheerio from 'cheerio';

export const GREEN_FUNDING_ORIGIN = 'https://greenfunding.jp';

export function clean(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function absolutize(value: string) {
  try {
    return new URL(value, GREEN_FUNDING_ORIGIN).toString();
  } catch {
    return '';
  }
}

export function normalizeUrlForUnique(value: string) {
  try {
    const url = new URL(value, GREEN_FUNDING_ORIGIN);
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString().toLowerCase();
  } catch {
    return clean(value).toLowerCase();
  }
}

export function parseMetricNumber(value: string | null | undefined) {
  const match = value?.match(/[0-9][0-9,]*/);
  return match?.[0] ? Number(match[0].replace(/,/g, '')) : 0;
}

export function parseOptionalMetricNumber(value: string | null | undefined) {
  return value && /[0-9]/.test(value) ? parseMetricNumber(value) : null;
}

export function parseGreenFundingDaysLeft(value: string | null | undefined) {
  const normalized = clean(value);
  if (!normalized || /終了|募集終了/.test(normalized)) return null;
  if (/[0-9][0-9,]*\s*(?:時間|分)/.test(normalized)) return 0;
  const dayMatch = normalized.match(/([0-9][0-9,]*)\s*日/);
  return dayMatch?.[1] ? Number(dayMatch[1].replace(/,/g, '')) : null;
}

export function uniqueBy<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export function extractExternalUrls($: cheerio.CheerioAPI, projectUrl: string) {
  const projectOrigin = new URL(projectUrl).origin;
  return uniqueBy(
    $('.project_sidebar_profile-links a[href^="http"]')
      .toArray()
      .map((element) => clean($(element).attr('href')))
      .filter((value) => {
        if (!value) return false;
        try {
          const url = new URL(value);
          return url.origin !== projectOrigin && !/greenfunding\.jp/i.test(url.hostname);
        } catch {
          return false;
        }
      }),
    normalizeUrlForUnique
  );
}

export function isGreenFundingProjectUrl(value: string) {
  try {
    const url = new URL(value, GREEN_FUNDING_ORIGIN);
    return ['greenfunding.jp', 'www.greenfunding.jp'].includes(url.hostname)
      && /^\/[^/]+\/projects\/\d+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}
