import * as cheerio from 'cheerio';
import { ProjectParserResult, RawProjectPageSnapshot } from '../parser.types';
import { GreenFundingDetail } from './green-funding-parser.types';
import { absolutize, clean, extractExternalUrls } from './green-funding-parser.utils';

export function parseGreenFundingDetail(snapshot: RawProjectPageSnapshot): ProjectParserResult<GreenFundingDetail> {
  const $ = cheerio.load(snapshot.html);
  const dashboard = $('.project_sidebar_dashboard').first();
  const infoNumbers = dashboard.find('.project_sidebar_dashboard-info-number');
  const header = $('.project_header').first().length
    ? $('.project_header').first()
    : $('h1').filter((_, element) => $(element).find('a[href*="/projects/"]').length > 0).first().parent();
  const headerLinks = header.find('a[href*="/projects/search?category_id="]');
  const executorLink = header.find('a[data-planner-id]').first();
  const externalUrls = extractExternalUrls($, snapshot.url);
  const profileWebsiteUrl = externalUrls.find((value) => (
    !/instagram\.com|tiktok\.com|twitter\.com|x\.com|facebook\.com|youtube\.com/i.test(value)
  )) || '';
  const title = clean($('meta[property="og:title"]').attr('content') || header.find('h1').first().text() || $('h1').first().text());
  const metaDescription = clean($('meta[property="og:description"]').attr('content'));
  const storyRoot = $('.project-content').first().clone();
  storyRoot.find('script, style, template, code').remove();
  const storyText = clean(
    storyRoot.find('p')
      .toArray()
      .map((element) => clean($(element).text()))
      .filter((value) => value.length >= 20 && !isScriptLikeText(value))
      .slice(0, 10)
      .join(' ')
  );
  const supportButton = dashboard.find('a[href*="/supports/"]').length > 0;
  const endedText = clean(dashboard.text());
  const metaDays = clean($('meta[property="product:custom_label_0"]').attr('content'));
  const metaSupporters = clean($('meta[property="product:custom_label_1"]').attr('content'));
  const metaAmount = clean($('meta[property="product:custom_label_3"]').attr('content'));
  const availability = clean($('meta[property="product:availability"]').attr('content')).toLowerCase();
  const categories = headerLinks.toArray().map((element) => clean($(element).text())).filter(Boolean);
  const safeMetaDescription = isScriptLikeText(metaDescription) ? '' : metaDescription;
  const isUnavailable = /out[\s_-]*of[\s_-]*stock|discontinued|sold[\s_-]*out/.test(availability);

  return {
    value: {
      title,
      url: snapshot.url,
      executorName: clean(
        $('meta[property="product:brand"]').attr('content')
        || executorLink.text()
        || $('.project_sidebar_profile-name').first().text()
      ),
      amountText: metaAmount || clean(dashboard.find('.project_sidebar_dashboard-amount').first().text()) || null,
      daysLeftText: metaDays || clean(infoNumbers.eq(0).text()) || null,
      supporterCountText: metaSupporters || clean(infoNumbers.eq(1).text()) || null,
      statusText: /終了/.test(metaDays) || dashboard.find('.button-end').length > 0 || isUnavailable
        ? '終了'
        : supportButton || availability === 'preorder'
          ? '募集中'
          : /終了|募集終了/.test(endedText)
            ? '終了'
            : '',
      description: (safeMetaDescription && safeMetaDescription !== title ? safeMetaDescription : storyText).slice(0, 1600),
      category: categories[0] || '',
      categories,
      thumbnailUrl: absolutize($('meta[property="og:image"]').attr('content') || ''),
      websiteUrl: profileWebsiteUrl,
      inquiryUrl: absolutize($('.project_sidebar_profile-button[href*="project_inquiries"]').first().attr('href') || ''),
      externalUrls
    },
    fallbacksUsed: []
  };
}

function isScriptLikeText(value: string) {
  const normalized = clean(value);
  return /^(?:\(?function\b|\(\s*function\b|(?:const|let|var)\s+\w+\s*=)/
    .test(normalized)
    || /(?:window|document)\.[A-Za-z_$]|=>|<\s*script\b|function\s*\([^)]*\)\s*\{/
      .test(normalized);
}
