import * as cheerio from 'cheerio';
import { ProjectParserResult, RawProjectPageSnapshot } from '../parser.types';
import { CampfireProfile } from './campfire.types';

export const CAMPFIRE_PROFILE_SELECTORS = {
  name: 'profile.name.primary',
  nameFallback: 'profile.name.fallback.heading',
  projectCount: 'profile.projectCount.primary',
  projectCountFallback: 'profile.projectCount.fallback.label',
  projectCountFirst: 'profile.projectCount.fallback.first-project',
  projectCountVisibleText: 'profile.projectCount.fallback.visible-text'
} as const;

export function parseCampfireProfile(snapshot: RawProjectPageSnapshot): ProjectParserResult<CampfireProfile> {
  assertSnapshot(snapshot, 'profile');
  const $ = cheerio.load(snapshot.html);
  const htmlText = clean($('body').text());
  const visibleText = clean(snapshot.visibleText);
  const sourceText = htmlText || visibleText;
  const fallbacksUsed: string[] = [];

  const profileName = clean($('[data-profile-name]').first().text());
  const name = profileName || clean($('h1').first().text());
  if (!profileName && name) fallbacksUsed.push(CAMPFIRE_PROFILE_SELECTORS.nameFallback);

  const primaryCount = clean($('[data-profile-project-count]').first().text());
  let projectCount = primaryCount;
  let projectCountSource: 'html' | 'visible' | null = primaryCount ? 'html' : null;
  if (!projectCount && /初めてのプロジェクトです/.test(sourceText)) {
    projectCount = '0件';
    fallbacksUsed.push(CAMPFIRE_PROFILE_SELECTORS.projectCountFirst);
  }
  if (!projectCount) {
    projectCount = findFirst(htmlText, [
      /他に\s*([0-9,]+\s*件)のプロジェクトを掲載しています/g,
      /過去(?:の)?プロジェクト\s*([0-9,]+\s*件)/g,
      /([0-9,]+\s*件)のプロジェクト/g,
      /プロジェクト\s*([0-9,]+\s*件)/g,
      /([0-9,]+\s*projects?)/gi
    ]);
    if (projectCount) projectCountSource = 'html';
    if (!projectCount) {
      projectCount = findFirst(visibleText, [
        /他に\s*([0-9,]+\s*件)のプロジェクトを掲載しています/g,
        /過去(?:の)?プロジェクト\s*([0-9,]+\s*件)/g,
        /([0-9,]+\s*件)のプロジェクト/g,
        /プロジェクト\s*([0-9,]+\s*件)/g,
        /([0-9,]+\s*projects?)/gi
      ]);
      if (projectCount) projectCountSource = 'visible';
    }
    if (projectCountSource === 'html') fallbacksUsed.push(CAMPFIRE_PROFILE_SELECTORS.projectCountFallback);
    if (projectCountSource === 'visible') fallbacksUsed.push(CAMPFIRE_PROFILE_SELECTORS.projectCountVisibleText);
  }

  return { value: { executorName: name, projectCount: projectCount || null }, fallbacksUsed: unique(fallbacksUsed) };
}

function assertSnapshot(snapshot: RawProjectPageSnapshot, kind: 'profile') {
  if (snapshot.source !== 'campfire' || snapshot.kind !== kind) {
    throw new Error(`CAMPFIRE profile parser requires a ${kind} snapshot.`);
  }
}

function findFirst(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = new RegExp(pattern.source, pattern.flags.replace('g', '')).exec(text);
    if (match?.[1]) return clean(match[1]);
  }
  return '';
}

function clean(value: string | undefined | null) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function unique<T>(items: T[]) { return [...new Set(items)]; }
