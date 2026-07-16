import * as cheerio from 'cheerio';
import { ProjectParserResult, RawProjectPageSnapshot } from '../parser.types';
import { CampfireDetail } from './campfire.types';

const CAMPFIRE_ORIGIN = 'https://camp-fire.jp';

export const CAMPFIRE_DETAIL_SELECTORS = {
  title: 'detail.title.primary.og',
  titleFallbackHeading: 'detail.title.fallback.heading',
  titleFallbackDocument: 'detail.title.fallback.document-title',
  amount: 'detail.amount.primary',
  amountFallback: 'detail.amount.fallback.label',
  supporters: 'detail.supporters.primary',
  supportersFallback: 'detail.supporters.fallback.label',
  daysLeft: 'detail.daysLeft.primary',
  daysLeftFallback: 'detail.daysLeft.fallback.label',
  category: 'detail.category.primary',
  categoryFallback: 'detail.category.fallback.label',
  publicStatus: 'detail.publicStatus.primary',
  publicStatusFallback: 'detail.publicStatus.fallback.label',
  description: 'detail.description.primary.og',
  descriptionFallback: 'detail.description.fallback.content'
} as const;

export function parseCampfireDetail(snapshot: RawProjectPageSnapshot): ProjectParserResult<CampfireDetail> {
  assertSnapshot(snapshot, 'detail');
  const $ = cheerio.load(snapshot.html);
  const bodyText = clean($('body').text());
  const visibleText = clean(snapshot.visibleText);
  const fallbackText = visibleText || bodyText;
  const fallbacksUsed: string[] = [];

  const ogTitle = clean($('meta[property="og:title"]').attr('content'));
  const headingTitle = clean($('h1').first().text());
  const documentTitle = clean($('title').text()).replace(/\s*\|\s*CAMPFIRE.*$/i, '');
  const projectTitle = ogTitle || headingTitle || documentTitle;
  if (!ogTitle && headingTitle) fallbacksUsed.push(CAMPFIRE_DETAIL_SELECTORS.titleFallbackHeading);
  if (!ogTitle && !headingTitle && documentTitle) fallbacksUsed.push(CAMPFIRE_DETAIL_SELECTORS.titleFallbackDocument);

  const amountValue = firstText($, '[data-support-amount]');
  const amountText = amountValue || findFirst(fallbackText, [/支援総額\s*[:：]?\s*([0-9,]+円?)/g, /現在\s*([0-9,]+円?)/g]);
  if (!amountValue && amountText) fallbacksUsed.push(CAMPFIRE_DETAIL_SELECTORS.amountFallback);

  const supportersValue = firstText($, '[data-supporters]');
  const supportersText = supportersValue || findFirst(fallbackText, [/支援者(?:数)?\s*[:：]?\s*([0-9,]+人?)/g]);
  if (!supportersValue && supportersText) fallbacksUsed.push(CAMPFIRE_DETAIL_SELECTORS.supportersFallback);

  const daysValue = firstText($, '[data-days-left]');
  const daysText = daysValue || findFirst(fallbackText, [/残り\s*([0-9]+\s*日)/g, /あと\s*([0-9]+\s*日)/g]);
  if (!daysValue && daysText) fallbacksUsed.push(CAMPFIRE_DETAIL_SELECTORS.daysLeftFallback);

  const categoryValue = firstText($, '[data-project-category]');
  const categoryText = categoryValue || findFirst(fallbackText, [/(?:カテゴリー|カテゴリ)\s*[:：]?\s*([^|｜\n]+?)(?=\s+(?:公開状態|ステータス|状態)\s*[:：]|$)/g]);
  if (!categoryValue && categoryText) fallbacksUsed.push(CAMPFIRE_DETAIL_SELECTORS.categoryFallback);

  const statusValue = firstText($, '[data-public-status]');
  const statusText = statusValue || findFirst(fallbackText, [/(?:公開状態|ステータス|状態)\s*[:：]?\s*([^|｜\n]+)/g]) || findStatus(fallbackText);
  if (!statusValue && statusText) fallbacksUsed.push(CAMPFIRE_DETAIL_SELECTORS.publicStatusFallback);

  const descriptionValue = clean($('meta[property="og:description"]').attr('content'));
  const descriptionFallback = clean($('[class*="description"], [class*="Description"]').first().text() || $('main').text().slice(0, 1800));
  if (!descriptionValue && descriptionFallback) fallbacksUsed.push(CAMPFIRE_DETAIL_SELECTORS.descriptionFallback);

  const profileName = clean($('a[href*="/profile/"]').first().text());
  const urls = extractExternalUrls($, snapshot.url);
  const classifiedUrls = classifyUrls(urls);
  const profileUrl = extractProfileUrl($);
  const executorName = sanitizeName(profileName) || sanitizeName(pickNearLabel(fallbackText, ['実行者', '起案者', 'プロジェクトオーナー']));

  return {
    value: {
      projectUrl: snapshot.url,
      projectId: snapshot.url.match(/projects\/(\d+)/)?.[1] || '',
      projectTitle,
      executorName,
      brandName: sanitizeName(pickNearLabel(fallbackText, ['ブランド名', 'ショップ名'])),
      supportAmount: extractValue(amountText),
      supporters: extractValue(supportersText),
      achievementRate: findFirst(fallbackText, [/([0-9,]+)\s*%/g, /達成率\s*([0-9,]+%)/g]),
      daysLeft: clean(extractValue(daysText)) || null,
      publicStatus: clean(statusText),
      mainDescription: descriptionValue || descriptionFallback,
      category: clean(categoryText),
      features: extractFeatureCandidates($, descriptionValue || descriptionFallback),
      profileUrl,
      websiteUrl: classifiedUrls.websiteUrl,
      inquiryUrl: classifiedUrls.inquiryUrl,
      instagramUrl: classifiedUrls.instagramUrl,
      tiktokUrl: classifiedUrls.tiktokUrl,
      xUrl: classifiedUrls.xUrl,
      externalUrls: urls
    },
    fallbacksUsed: unique(fallbacksUsed)
  };
}

function assertSnapshot(snapshot: RawProjectPageSnapshot, kind: 'detail') {
  if (snapshot.source !== 'campfire' || snapshot.kind !== kind) {
    throw new Error(`CAMPFIRE detail parser requires a ${kind} snapshot.`);
  }
}

function firstText($: cheerio.CheerioAPI, selector: string) {
  return clean($(selector).first().text());
}

function extractValue(value: string) {
  return value.replace(/^\s*(?:支援総額|支援者(?:数)?|現在|残り|あと)\s*[:：]?\s*/u, '').trim();
}

function findStatus(text: string) {
  return text.match(/募集中|募集終了|受付終了|終了しました|終了|もうすぐ公開|近日公開|公開予定|COMING\s*SOON/i)?.[0] || '';
}

function findFirst(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = new RegExp(pattern.source, pattern.flags.replace('g', '')).exec(text);
    if (match?.[1]) return clean(match[1]);
  }
  return '';
}

function pickNearLabel(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(new RegExp(label + '\\s*[:：]?\\s*([^\\s]{2,40})'));
    if (match?.[1]) return clean(match[1]);
  }
  return '';
}

function extractProfileUrl($: cheerio.CheerioAPI) {
  return absolutize(
    $('a[href*="/profile/"][href*="/projects"]').first().attr('href') || $('a[href*="/profile/"]').first().attr('href') || '',
    CAMPFIRE_ORIGIN
  );
}

function extractFeatureCandidates($: cheerio.CheerioAPI, description: string) {
  const headings = $('h2,h3,strong')
    .toArray()
    .map((element) => clean($(element).text()))
    .filter((value) => value.length >= 8 && value.length <= 80);
  const descriptionSentences = description
    .split(/[。！？!?]/)
    .map((value) => clean(value))
    .filter((value) => value.length >= 12 && value.length <= 90);
  return uniqueBy([...headings, ...descriptionSentences], (value) => value).slice(0, 8);
}

function extractExternalUrls($: cheerio.CheerioAPI, projectUrl: string) {
  const projectHost = new URL(projectUrl).hostname;
  const urls = $('a[href]')
    .toArray()
    .map((element) => absolutize($(element).attr('href') || '', CAMPFIRE_ORIGIN))
    .filter((url) => {
      if (!url) return false;
      const parsed = new URL(url);
      if (parsed.hostname === projectHost || parsed.hostname.endsWith('.camp-fire.jp')) return false;
      if (['mailto:', 'tel:'].includes(parsed.protocol) || isShareOrTrackingUrl(parsed)) return false;
      return ['http:', 'https:'].includes(parsed.protocol);
    });
  return uniqueBy(urls, (value) => normalizeUrl(value)).slice(0, 20);
}

function classifyUrls(urls: string[]) {
  const instagramUrl = urls.find((url) => /(^|\.)instagram\.com$/i.test(new URL(url).hostname)) || '';
  const tiktokUrl = urls.find((url) => /(^|\.)tiktok\.com$/i.test(new URL(url).hostname)) || '';
  const xUrl = urls.find((url) => {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (host === 'x.com' || host === 'twitter.com' || host.endsWith('.twitter.com')) && !parsed.pathname.startsWith('/intent/');
  }) || '';
  const inquiryUrl = urls.find((url) => /contact|inquiry|toiawase|support|help|form|otoiawase/i.test(url)) || '';
  const websiteUrl = urls.find((url) => !/instagram\.com|tiktok\.com|x\.com|twitter\.com|facebook\.com|youtube\.com|youtu\.be/i.test(new URL(url).hostname)) || '';
  return { websiteUrl, inquiryUrl, instagramUrl, tiktokUrl, xUrl };
}

function isShareOrTrackingUrl(url: URL) {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (host === 'x.com' || host === 'twitter.com' || host.endsWith('.twitter.com')) return path.startsWith('/intent/') || path.startsWith('/share');
  if (host === 'facebook.com' || host === 'www.facebook.com' || host.endsWith('.facebook.com')) return path.includes('/sharer') || path.includes('/share');
  if (host === 'social-plugins.line.me' || host.endsWith('.line.me')) return path.includes('/share') || path.includes('/lineit');
  return host === 'app.adjust.com' || host.endsWith('.adjust.com') || host === 'b.hatena.ne.jp' || host === 'pinterest.com' || host === 'www.pinterest.com';
}

function sanitizeName(value: string) {
  const text = clean(value);
  if (!text || text.length > 40 || /[。、「」]|メーカー|製造国|販売権|有する|http|CAMPFIRE/.test(text)) return '';
  return text;
}

function absolutize(href: string, origin: string) {
  if (!href) return '';
  try { return new URL(href, origin).toString(); } catch { return ''; }
}

function normalizeUrl(value: string) {
  try { const url = new URL(value); url.hash = ''; return url.toString().replace(/\/$/, ''); } catch { return value; }
}

function clean(value: string | undefined | null) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function unique<T>(items: T[]) { return [...new Set(items)]; }

function uniqueBy<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => { const key = keyFn(item); if (!key || seen.has(key)) return false; seen.add(key); return true; });
}
