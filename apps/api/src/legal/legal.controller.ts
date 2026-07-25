import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';

@Controller()
@SkipThrottle()
export class LegalController {
  @Get('privacy')
  @Public()
  @Header('Content-Type', 'text/html; charset=utf-8')
  privacy() {
    return renderLegalPage('プライバシーポリシー', privacySections(operatorConfig()));
  }

  @Get('terms')
  @Public()
  @Header('Content-Type', 'text/html; charset=utf-8')
  terms() {
    return renderLegalPage('利用規約', termsSections(operatorConfig()));
  }
}

type OperatorConfig = {
  name: string;
  address: string;
  contactEmail: string;
  effectiveDate: string;
};

function operatorConfig(env: NodeJS.ProcessEnv = process.env): OperatorConfig {
  return {
    name: env.LEGAL_OPERATOR_NAME?.trim() || '運営事業者',
    address: env.LEGAL_POSTAL_ADDRESS?.trim() || '本番環境の運営者情報に記載',
    contactEmail: env.LEGAL_CONTACT_EMAIL?.trim() || '本番環境の窓口にお問い合わせください',
    effectiveDate: env.LEGAL_EFFECTIVE_DATE?.trim() || '2026-07-25'
  };
}

function privacySections(config: OperatorConfig) {
  return [
    ['運営者', `${config.name}（所在地: ${config.address}）`],
    ['取得する情報', '利用者の氏名・メールアドレス・所属組織、営業先の公開情報・連絡先、営業案件・メール・返信・操作履歴、端末・IPアドレスを不可逆化した識別子、サービス利用状況を取得します。'],
    ['利用目的', '営業案件の管理、メール下書き・レビュー・送信、返信対応、本人確認、不正利用防止、障害対応、サービス改善、契約・請求・問い合わせ対応のために利用します。'],
    ['AI・外部サービス', '利用者が実行した機能に応じて、案件情報や指示内容をOpenAIまたはGoogleのAIサービスへ送信する場合があります。メール送信にはGoogle Gmail API、案件候補取得には公開クラウドファンディングサイトを利用します。秘密情報や不要な個人情報を入力しないでください。'],
    ['メール計測', '営業メールの開封・リンククリックを計測する場合があります。セキュリティ製品による自動アクセスと短時間の重複アクセスを除外し、計測結果だけで商談状態を自動確定しません。各メールの配信停止リンクから以後の送信を停止できます。'],
    ['第三者提供・委託', '法令に基づく場合を除き、本人の同意なく個人データを第三者へ販売しません。サービス提供に必要な範囲で、契約上の安全管理措置を講じたクラウド・AI・メール事業者へ取扱いを委託します。'],
    ['安全管理', '組織単位のアクセス分離、役割別権限、監査ログ、暗号化されたバックアップ、秘密情報の分離、送信前の人による承認を実施します。'],
    ['保存・削除', '契約、法令、監査、不正防止に必要な期間だけ保存し、目的達成後は削除または匿名化します。バックアップは所定の保持期間後に削除します。開示・訂正・利用停止・削除の請求は下記窓口で受け付けます。'],
    ['お問い合わせ', config.contactEmail],
    ['施行日', config.effectiveDate]
  ];
}

function termsSections(config: OperatorConfig) {
  return [
    ['適用', `本規約は、${config.name}が提供する営業支援システムの利用条件を定めます。個別の申込書・見積書・注文書と本規約が異なる場合は、個別合意が優先します。`],
    ['サービスの性質', '本サービスは営業候補、分析、メール下書き、進行管理を支援します。AI出力や外部サイト情報の正確性・最新性を保証するものではなく、送信・契約・法令適合性の最終判断は利用者が行います。'],
    ['アカウント管理', '利用者は認証情報を適切に管理し、自組織に付与された権限の範囲で利用します。退職者や不要なアカウントは速やかに無効化してください。'],
    ['禁止事項', '法令・第三者の権利・外部サービスの規約に反する利用、迷惑メール、不正アクセス、過度な自動取得、差別・詐欺・なりすまし、セキュリティ機能の回避を禁止します。'],
    ['メール送信', '広告・営業メールの送信根拠、表示義務、配信停止、対象者の適法性を利用者が確認し、承認済みかつチェックリスト完了のメールだけを送信します。配信停止・苦情・ブロック済みの宛先には送信できません。'],
    ['料金・契約期間', '料金、利用上限、支払条件、契約期間、更新、解約は個別の申込書・見積書・注文書に定めます。'],
    ['データ', '利用者は入力データに必要な権利を有することを保証します。契約終了時の出力・削除・保持期間は個別合意およびプライバシーポリシーに従います。'],
    ['停止・変更', '保守、障害、セキュリティ上の必要、外部サービスの停止等によりサービスを一時停止・変更する場合があります。重大な障害は合理的な範囲で速やかに通知します。'],
    ['責任', '故意または重過失がある場合を除き、責任の範囲と上限は個別契約に従います。利用者による未確認送信、外部サービス、AI出力の採用結果について運営者は責任を負いません。'],
    ['準拠法・協議', '日本法を準拠法とし、紛争が生じた場合は誠実に協議し、個別契約で定める裁判所を第一審の専属的合意管轄裁判所とします。'],
    ['お問い合わせ', config.contactEmail],
    ['施行日', config.effectiveDate]
  ];
}

function renderLegalPage(title: string, sections: string[][]) {
  const content = sections
    .map(([heading, body]) => `<section><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(body)}</p></section>`)
    .join('');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:56px auto;padding:0 24px;color:#172033;line-height:1.8}h1{font-size:2rem}h2{font-size:1.15rem;margin-top:2rem}nav a{margin-right:16px;color:#1f5eff}footer{margin:48px 0;color:#687087}</style></head><body><nav><a href="/privacy">プライバシーポリシー</a><a href="/terms">利用規約</a></nav><main><h1>${escapeHtml(title)}</h1>${content}</main><footer>© ${new Date().getUTCFullYear()} ${escapeHtml(operatorConfig().name)}</footer></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character] || character);
}
