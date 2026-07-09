import { BadRequestException, Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { chromium, type Page } from 'playwright';

const CAMPFIRE_ORIGIN = 'https://camp-fire.jp';

export type ScrapedCampfireProject = {
  projectUrl: string;
  projectId: string;
  projectTitle: string;
  executorName: string;
  brandName: string;
  supportAmount: string;
  supporters: string;
  achievementRate: string;
  daysLeft: string;
  mainDescription: string;
  category: string;
  features: string[];
  profileUrl: string;
  profileProjectCount: number;
  websiteUrl: string;
  inquiryUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  xUrl: string;
  externalUrls: string[];
};

@Injectable()
export class CampfireScraperService {
  async scrape(inputUrl: string): Promise<ScrapedCampfireProject> {
    const url = validateCampfireUrl(inputUrl);
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
      });
      await openPage(page, url);
      const html = await page.content();
      const project = extractProject(html, url);

      if (!project.projectTitle) {
        throw new BadRequestException('CAMPFIREプロジェクト名を取得できませんでした。');
      }

      return project;
    } finally {
      await browser.close();
    }
  }
}

async function openPage(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
}

function validateCampfireUrl(url: string) {
  if (!url) {
    throw new BadRequestException('CAMPFIRE URL is required.');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('URL format is invalid.');
  }

  if (!['camp-fire.jp', 'www.camp-fire.jp'].includes(parsed.hostname)) {
    throw new BadRequestException('CAMPFIRE URLを指定してください。');
  }

  if (!parsed.pathname.includes('/projects/')) {
    throw new BadRequestException('CAMPFIREプロジェクトページURLを指定してください。');
  }

  return parsed.toString();
}

function extractProject(html: string, projectUrl: string): ScrapedCampfireProject {
  const $ = cheerio.load(html);
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const description = clean(
    $('meta[property="og:description"]').attr('content') ||
      $('[class*="description"], [class*="Description"]').first().text() ||
      $('main').text().slice(0, 1800)
  );
  const profileName = clean($('a[href*="/profile/"]').first().text());
  const urls = extractExternalUrls($, projectUrl);
  const classifiedUrls = classifyUrls(urls);
  const profileProjectCount = extractProfileProjectCount(bodyText);

  return {
    projectUrl,
    projectId: projectUrl.match(/projects\/(\d+)/)?.[1] ?? '',
    projectTitle: clean(
      $('meta[property="og:title"]').attr('content') ||
        $('h1').first().text() ||
        $('title').text().replace(/\s*\|\s*CAMPFIRE.*$/i, '')
    ),
    executorName:
      sanitizeName(profileName) || sanitizeName(pickNearLabel(bodyText, ['実行者', '起案者', 'プロジェクトオーナー'])),
    brandName: sanitizeName(pickNearLabel(bodyText, ['ブランド名', 'ショップ名'])),
    supportAmount: findFirst(bodyText, [/([0-9,]+)\s*円/g, /支援総額\s*([0-9,]+円)/g]),
    supporters: findFirst(bodyText, [/([0-9,]+)\s*人\s*(?:の)?支援者/g, /支援者数\s*([0-9,]+人)/g]),
    achievementRate: findFirst(bodyText, [/([0-9,]+)\s*%/g, /達成率\s*([0-9,]+%)/g]),
    daysLeft: findFirst(bodyText, [/残り\s*([0-9]+日)/g, /あと\s*([0-9]+日)/g]),
    mainDescription: description,
    category: pickNearLabel(bodyText, ['カテゴリー', 'カテゴリ']) || '',
    features: extractFeatureCandidates($, description),
    profileUrl: absolutize(
      $('a[href*="/profile/"][href*="/projects"]').first().attr('href') ||
        $('a[href*="/profile/"]').first().attr('href') ||
        '',
      CAMPFIRE_ORIGIN
    ),
    profileProjectCount,
    websiteUrl: classifiedUrls.websiteUrl,
    inquiryUrl: classifiedUrls.inquiryUrl,
    instagramUrl: classifiedUrls.instagramUrl,
    tiktokUrl: classifiedUrls.tiktokUrl,
    xUrl: classifiedUrls.xUrl,
    externalUrls: urls
  };
}

function extractProfileProjectCount(text: string) {
  const patterns = [
    /([0-9,]+)\s*件のプロジェクト/g,
    /プロジェクト\s*([0-9,]+)\s*件/g,
    /([0-9,]+)\s*projects?/gi
  ];

  return parseInteger(findFirst(text, patterns));
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
      if (['mailto:', 'tel:'].includes(parsed.protocol)) return false;
      return ['http:', 'https:'].includes(parsed.protocol);
    });

  return uniqueBy(urls, (value) => normalizeUrlForUnique(value)).slice(0, 20);
}

function classifyUrls(urls: string[]) {
  const instagramUrl = urls.find((url) => /(^|\.)instagram\.com$/i.test(new URL(url).hostname)) || '';
  const tiktokUrl = urls.find((url) => /(^|\.)tiktok\.com$/i.test(new URL(url).hostname)) || '';
  const xUrl =
    urls.find((url) => {
      const host = new URL(url).hostname.toLowerCase();
      return host === 'x.com' || host === 'twitter.com' || host.endsWith('.twitter.com');
    }) || '';
  const inquiryUrl =
    urls.find((url) => {
      const normalized = url.toLowerCase();
      return /contact|inquiry|toiawase|support|help|form|otoiawase/.test(normalized);
    }) || '';
  const websiteUrl =
    urls.find((url) => {
      const host = new URL(url).hostname.toLowerCase();
      return ![
        'instagram.com',
        'www.instagram.com',
        'tiktok.com',
        'www.tiktok.com',
        'x.com',
        'twitter.com',
        'www.twitter.com',
        'facebook.com',
        'www.facebook.com',
        'youtube.com',
        'www.youtube.com',
        'youtu.be'
      ].includes(host);
    }) || '';

  return { websiteUrl, inquiryUrl, instagramUrl, tiktokUrl, xUrl };
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

function pickNearLabel(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(new RegExp(label + '\\s*[:：]?\\s*([^\\s]{2,40})'));
    if (match?.[1]) {
      return clean(match[1]);
    }
  }

  return '';
}

function findFirst(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    pattern.lastIndex = 0;

    if (match?.[1]) {
      return clean(match[1]);
    }
  }

  return '';
}

function sanitizeName(value: string) {
  const text = clean(value);

  if (!text || text.length > 40) {
    return '';
  }

  if (/[。、「」]|メーカー|製造国|販売権|有する|http|CAMPFIRE/.test(text)) {
    return '';
  }

  return text;
}

function absolutize(href: string, origin: string) {
  if (!href) {
    return '';
  }

  try {
    return new URL(href, origin).toString();
  } catch {
    return '';
  }
}

function normalizeUrlForUnique(value: string) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return value;
  }
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function clean(value: string | undefined | null) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function parseInteger(value: string) {
  const number = Number((value || '').replace(/[^0-9]/g, ''));
  return Number.isFinite(number) ? number : 0;
}
