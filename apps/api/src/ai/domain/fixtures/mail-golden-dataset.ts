export type MailGoldenCase = {
  id: string;
  source: string;
  companyName: string;
  projectTitle: string;
  projectCategory: string;
  projectDescription: string;
  brandAnalysisMemo: string;
  expectedAppealWords: readonly string[];
  expectedTargetWords: readonly string[];
  forbiddenWords: readonly string[];
  forbiddenMailWords?: readonly string[];
};

export const mailGoldenDataset: readonly MailGoldenCase[] = [
  {
    id: 'rice-storage',
    source: 'CAMPFIRE',
    companyName: '株式会社米蔵',
    projectTitle: '真空保存できる米びつ「こめ守り」',
    projectCategory: 'キッチン',
    projectDescription: 'お米の鮮度を保ちながら、必要な分だけ分割保存できる米びつです。キッチン収納にも収まりやすい設計です。',
    brandAnalysisMemo: '商品の魅力: 真空保存でお米の鮮度を保ち、キッチン収納に収まりやすい点が魅力です。対象: お米の保存とキッチン収納を重視する方。',
    expectedAppealWords: ['真空保存', 'お米の鮮度', 'キッチン収納'],
    expectedTargetWords: ['お米の保存', 'キッチン収納'],
    forbiddenWords: ['サーモン', 'スモークサーモン', '醤油', '醤油差し', '有田焼', 'ライブ', '音楽', '20周年', '焼き鳥', '防災', '金庫']
  },
  {
    id: 'smoked-salmon',
    source: 'Makuake',
    companyName: '大山ハム株式会社',
    projectTitle: '職人仕込みのスモークサーモン',
    projectCategory: '食品',
    projectDescription: '伏流水で仕込み、職人が燻製したスモークサーモンを食卓で楽しめます。',
    brandAnalysisMemo: '商品の魅力: 伏流水と職人の燻製技術による味わいを食卓で楽しめる点が魅力です。対象: 食の品質や特別な味わいを楽しみたい方。',
    expectedAppealWords: ['伏流水', '燻製', 'スモークサーモン'],
    expectedTargetWords: ['食の品質', '味わい'],
    forbiddenWords: ['米', '米びつ', 'キッチン収納', '醤油', '醤油差し', '有田焼', 'ライブ', '音楽', '20周年', '焼き鳥', '防災', '金庫']
  },
  {
    id: 'arita-soy-sauce-cruet',
    source: 'CAMPFIRE',
    companyName: '有田陶器製作所',
    projectTitle: '食卓を彩る有田焼の醤油差し「NEO CLAY」',
    projectCategory: '生活雑貨',
    projectDescription: '有田焼の質感を生かした醤油差しです。残量が見えやすく、サイフォン構造で食卓を整えます。',
    brandAnalysisMemo: '魅力: 有田焼の醤油差しで残量が見やすい点が魅力です。対象: 食卓の調味料を整えたい方。',
    expectedAppealWords: ['有田焼', '醤油差し'],
    expectedTargetWords: ['調味料', '食卓'],
    forbiddenWords: ['米', '米びつ', 'キッチン収納', 'サーモン', 'スモークサーモン', 'ライブ', '音楽', '20周年', '焼き鳥', '防災', '金庫']
  },
  {
    id: 'music-anniversary-event',
    source: 'Makuake',
    companyName: '株式会社音楽企画',
    projectTitle: '結成20周年記念ライブをファンと作る音楽イベント',
    projectCategory: '音楽イベント',
    projectDescription: '結成20周年を迎える音楽グループが、ファンと記念ライブを作るイベントです。会場で特別な時間を共有します。',
    brandAnalysisMemo: '魅力: 結成20周年の節目を音楽とライブでファンと共有できる点が魅力です。対象: これまで活動を応援してきたファンの方。',
    expectedAppealWords: ['20周年', '音楽', 'ライブ'],
    expectedTargetWords: ['ファン'],
    forbiddenWords: ['米', '米びつ', 'キッチン収納', 'サーモン', 'スモークサーモン', '醤油', '醤油差し', '有田焼', '焼き鳥', '防災', '金庫'],
    forbiddenMailWords: ['商品', '使用シーン', '子育て家族', '子ども', '家族']
  },
  {
    id: 'yakitori-renovation',
    source: 'CAMPFIRE',
    companyName: '炭火やきとり鳥清',
    projectTitle: '創業30年の焼き鳥店を改装',
    projectCategory: '飲食店',
    projectDescription: '地域に根ざした焼き鳥店が、創業30年の味と店内の雰囲気を守りながら改装します。',
    brandAnalysisMemo: '魅力: 焼き鳥と地域のつながりを守る改装です。対象: 地域の飲食店を応援したい方。',
    expectedAppealWords: ['焼き鳥', '地域'],
    expectedTargetWords: ['地域', '飲食店'],
    forbiddenWords: ['米', '米びつ', 'キッチン収納', 'サーモン', 'スモークサーモン', '醤油', '醤油差し', '有田焼', 'ライブ', '音楽', '20周年', '防災', '金庫']
  },
  {
    id: 'disaster-safe',
    source: 'Makuake',
    companyName: '防災保管株式会社',
    projectTitle: '大切な物を守る防災金庫',
    projectCategory: '防災',
    projectDescription: '災害時にも重要書類や思い出の品を守れる、防災備えのための金庫です。',
    brandAnalysisMemo: '魅力: 防災金庫で大切な品を保管できる安心感が魅力です。対象: 防災の備えを重視する方。',
    expectedAppealWords: ['防災', '保管', '安心感'],
    expectedTargetWords: ['防災'],
    forbiddenWords: ['米', '米びつ', 'キッチン収納', 'サーモン', 'スモークサーモン', '醤油', '醤油差し', '有田焼', 'ライブ', '音楽', '20周年', '焼き鳥']
  }
];
