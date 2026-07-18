import { LeadStatus, ReplyCategory } from '@prisma/client';

export type ReplyClassification = {
  category: ReplyCategory;
  confidence: number;
  summary: string;
  nextAction: string;
  leadStatus: LeadStatus;
  nextActionAt?: Date;
};

export function classifyReplyText(body: string, now = new Date()): ReplyClassification {
  const text = body.replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  const tomorrow = daysFrom(now, 1);

  if (/クレーム|苦情|迷惑|不快|二度と|法的|通報/.test(lower)) {
    return {
      category: 'complaint',
      confidence: 0.9,
      summary: 'クレームまたは強い不満を含む返信です。',
      nextAction: '内容を確認し、責任者へ共有して対応方針を決める。',
      leadStatus: 'replied',
      nextActionAt: now
    };
  }

  if (/配信停止|メール.*停止|連絡.*停止|unsubscribe|今後.*(?:連絡|メール).*不要/.test(lower)) {
    return {
      category: 'unsubscribe',
      confidence: 0.9,
      summary: '配信停止または今後不要の返信です。',
      nextAction: '対象外にし、以後の連絡を止める。',
      leadStatus: 'rejected'
    };
  }

  if (/打ち合わせ|商談|面談|日程|候補日|zoom|ミーティング|meeting/.test(lower)) {
    return {
      category: 'meeting_request',
      confidence: 0.86,
      summary: '面談または日程調整につながる返信です。',
      nextAction: '日程候補または調整リンクを送る。',
      leadStatus: 'meeting_candidate',
      nextActionAt: now
    };
  }

  if (/興味ありません|不要です|結構です|お断り|見送|予算.*ない|時期.*違/.test(lower)) {
    return {
      category: 'not_interested',
      confidence: 0.82,
      summary: '現時点では見送りまたは不要の返信です。',
      nextAction: '無理に追わず、必要なら時期を空けて再確認する。',
      leadStatus: 'no_response'
    };
  }

  if (/興味あります|関心があります|ぜひ|前向き|検討したい|話を聞きたい/.test(lower)) {
    return {
      category: 'interested',
      confidence: 0.82,
      summary: '提案への興味または前向きな反応がある返信です。',
      nextAction: '相手の関心事項を確認し、次の案内を送る。',
      leadStatus: 'replied',
      nextActionAt: now
    };
  }

  if (/資料|詳しく|詳細|料金|費用|教えて|知りたい|興味|検討/.test(lower)) {
    return {
      category: 'need_info',
      confidence: 0.78,
      summary: '追加情報や資料を求めている可能性があります。',
      nextAction: '質問に回答し、必要なら資料や説明を送る。',
      leadStatus: 'replied',
      nextActionAt: tomorrow
    };
  }

  if (/自動返信|不在|休暇|auto.?reply|out of office/.test(lower)) {
    return {
      category: 'auto_reply',
      confidence: 0.88,
      summary: '自動返信の可能性があります。',
      nextAction: '通常返信を待ち、必要なら数日後に確認する。',
      leadStatus: 'contacted',
      nextActionAt: daysFrom(now, 3)
    };
  }

  return {
    category: 'unknown',
    confidence: 0.4,
    summary: text.slice(0, 120) || '返信内容を確認してください。',
    nextAction: '返信内容を確認し、次対応を判断する。',
    leadStatus: 'replied',
    nextActionAt: now
  };
}

function daysFrom(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}
