import * as cheerio from 'cheerio';

export const MAKUAKE_ORIGIN = 'https://www.makuake.com';

const MAKUAKE_CATEGORIES = [
  'プロダクト',
  'ガジェット',
  'フード',
  'ファッション',
  'ビューティー',
  'スポーツ',
  'アウトドア',
  'インテリア',
  '地域活性',
  '音楽',
  'アート',
  '映画',
  '出版',
  '教育'
];

const PREFECTURES = [
  '北海道',
  '青森',
  '岩手',
  '宮城',
  '秋田',
  '山形',
  '福島',
  '茨城',
  '栃木',
  '群馬',
  '埼玉',
  '千葉',
  '東京',
  '神奈川',
  '新潟',
  '富山',
  '石川',
  '福井',
  '山梨',
  '長野',
  '岐阜',
  '静岡',
  '愛知',
  '三重',
  '滋賀',
  '京都',
  '大阪',
  '兵庫',
  '奈良',
  '和歌山',
  '鳥取',
  '島根',
  '岡山',
  '広島',
  '山口',
  '徳島',
  '香川',
  '愛媛',
  '高知',
  '福岡',
  '佐賀',
  '長崎',
  '熊本',
  '大分',
  '宮崎',
  '鹿児島',
  '沖縄'
];

export function clean(value?: string) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export function absolutize(value: string) {
  try {
    return new URL(value, MAKUAKE_ORIGIN).toString();
  } catch {
    return '';
  }
}

export function extractAmountText(text: string) {
  const match =
    extractNumberAfterLabels(text, ['応援購入総額', '集まっている金額', '現在の支援総額', '購入総額', '支援総額'], ['円'], 160) ||
    matchYenAmount(text) ||
    text.match(/([0-9,]+)\s*円/);
  return match?.[0] || null;
}

export function extractSupporterCountText(text: string) {
  const match =
    extractNumberAfterLabels(text, ['サポーター', '寄附者', '寄付者', 'サポーター数', '支援者数', '応援購入者数', '支援者', '応援購入者'], ['人', '名'], 160) ||
    text.match(/(?:寄附者|寄付者|サポーター数|支援者数|応援購入者数|サポーター|支援者|応援購入者)\s*[:：]?\s*([0-9,]+)\s*(?:人|名)?/) ||
    text.match(/([0-9,]+)\s*(?:人|名)\s*(?:の)?(?:寄附者|寄付者|サポーター|応援購入者|購入者|支援者)/);
  return match?.[0] || null;
}

export function extractDaysLeftText(text: string) {
  const match =
    extractNumberAfterLabels(text, ['募集終了まで残り', '終了まで残り', '残り', 'あと'], ['日'], 80) ||
    text.match(/(?:残り|あと)\s*([0-9]{1,3})\s*日/);
  if (match?.[0]) return match[0];

  const compactAmountDays = clean(text).match(/[¥￥]\s*[0-9]{1,3}(?:,[0-9]{3})+\s*(?:円)?\s*([0-9]{1,3})\s*日\s*[0-9]{1,6}\s*%/);
  if (compactAmountDays?.[1]) return `${compactAmountDays[1]}日`;

  const compactNumber = clean(text).match(/[¥￥]\s*([0-9]+)\s*日\s*[0-9]{1,6}\s*%/);
  if (compactNumber?.[1]) {
    for (const digitLength of [3, 2, 1]) {
      if (compactNumber[1].length <= digitLength) continue;
      const days = Number(compactNumber[1].slice(-digitLength));
      if (days >= 1 && days <= 365) return `${days}日`;
    }
  }

  const cardMatch = clean(text).match(/(?:^|[^0-9,¥￥])([0-9]{1,3})\s*日\s*[0-9]{1,6}\s*%/);
  if (cardMatch?.[1]) return `${cardMatch[1]}日`;
  const daysBeforeRate = clean(text).match(/(?:^|[^0-9,¥￥])([0-9]{1,3})\s*日\s*(?:達成率|[0-9]{1,6}\s*%)/);
  return daysBeforeRate?.[1] ? `${daysBeforeRate[1]}日` : null;
}

export function extractCategory(text: string) {
  return MAKUAKE_CATEGORIES.find((item) => text.includes(item)) || '';
}

export function extractLocation(text: string) {
  const normalized = clean(text);
  const locationLabelMatch = normalized.match(/(?:所在地|活動拠点|拠点|地域)\s*[:：]?\s*([^\s　、。/#]{2,12})/);
  if (locationLabelMatch?.[1]) {
    const labeled = normalizePrefecture(locationLabelMatch[1]);
    if (labeled) return labeled;
  }
  for (const prefecture of PREFECTURES) {
    const suffixPattern = prefecture === '北海道' ? '北海道' : `${prefecture}(?:都|府|県)?`;
    if (new RegExp(`(?:^|\\s|#|、|。)${suffixPattern}(?:\\s|#|、|。|$)`).test(normalized)) return prefecture;
  }
  return '';
}

export function extractExecutorName($: cheerio.CheerioAPI, text: string) {
  const labelMatch = text.match(/(?:実行者|販売者|メーカー|起案者|事業者)\s*[:：]?\s*([^\s　]{2,40})/);
  if (labelMatch?.[1]) return clean(labelMatch[1]);
  return clean($('[class*="owner"], [class*="seller"], [class*="maker"], [class*="executor"], [class*="profile"]').first().text()).slice(0, 60);
}

export function extractExternalUrls($: cheerio.CheerioAPI, currentUrl: string) {
  return uniqueBy(
    $('a[href^="http"]')
      .toArray()
      .map((element) => $(element).attr('href') || '')
      .filter((url) => url && url !== currentUrl),
    (url) => normalizeUrlForUnique(url)
  ).slice(0, 20);
}

export function extractMemberUrl($: cheerio.CheerioAPI, currentUrl: string) {
  const href = $('a[href*="/member/index/"]').first().attr('href') || '';
  return href ? absolutize(href) : inferMemberUrlFromText($('body').html() || '', currentUrl);
}

function inferMemberUrlFromText(html: string, currentUrl: string) {
  const match = html.match(/\/member\/index\/[0-9]+/);
  if (match?.[0]) return absolutize(match[0]);
  try {
    const current = new URL(currentUrl);
    const memberId = current.searchParams.get('member_id');
    return memberId ? absolutize(`/member/index/${memberId}/#project`) : '';
  } catch {
    return '';
  }
}

export function extractMemberDescription($: cheerio.CheerioAPI, text: string) {
  const candidates = [
    clean($('[class*="profile"], [class*="Profile"], [class*="description"], [class*="Description"], [class*="introduction"], [class*="Introduction"]').first().text()),
    text.match(/サポーター数\s*[0-9,]+人\s*(.{40,500})/)?.[1] || ''
  ];
  return candidates.find((value) => value && value.length >= 30)?.slice(0, 600) || '';
}

export function extractNumberAfterLabels(text: string, labels: string[], units: string[], windowSize = 80) {
  for (const label of labels) {
    const index = text.indexOf(label);
    if (index < 0) continue;
    const nearby = text.slice(index + label.length, index + label.length + windowSize);
    const unitPattern = units.map(escapeRegExp).join('|');
    const match = nearby.match(new RegExp(`([0-9,]+)\\s*(?:${unitPattern})`));
    if (match?.[1]) return match;
  }
  return null;
}

function matchYenAmount(text: string) {
  const commaAmountMatch = text.match(/[¥￥]\s*([0-9]{1,3}(?:,[0-9]{3})+)(?:円|[0-9]{1,3}\s*日|[0-9]{1,6}\s*%|$)/);
  if (commaAmountMatch?.[1]) return commaAmountMatch;
  const match = text.match(/[¥￥]\s*([0-9]+?)(?:円|(?=[0-9]{1,3}\s*日)|(?=[0-9]{1,6}\s*%))/);
  if (match?.[1]) return match;
  return text.match(/[¥￥]\s*([0-9]{1,3}(?:,[0-9]{3})+)/);
}

function normalizePrefecture(value: string) {
  const cleaned = clean(value).replace(/[都府県]$/, '');
  if (value.includes('北海道')) return '北海道';
  return PREFECTURES.find((prefecture) => prefecture === cleaned || value.includes(prefecture)) || '';
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeUrlForUnique(value: string) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return value;
  }
}

export function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function firstUsefulLine(text: string) {
  return text.split(/\s+/).find((line) => line.length >= 6 && line.length <= 80) || '';
}
