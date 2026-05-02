// ==================== 查询结果类型 ====================

export type TranslationMap = {
  [key: string]: string[];
};

export type ExampleSentence = {
  en: string;
  zh: string;
};

export type QueryResult = {
  word: string;
  phonetic?: string;
  translation: TranslationMap;
  example: ExampleSentence[];
  isChinese?: boolean;  // 标记是否为中译英结果
};

export type SentenceTranslation = {
  type: 'sentence';
  original: string;
  translation: string;
  isChinese?: boolean;  // 标记是否为中译英结果
};

export type QueryResponse = QueryResult | SentenceTranslation;

// ==================== 收藏单词类型 ====================

export type FavoriteWord = {
  id: string;
  word: string;
  translation: string;
  phonetic?: string;
  createdAt: number;
  queryData: QueryResult;
  // 复习相关字段
  reviewCount: number;      // 复习次数
  lastReviewedAt?: number;  // 上次复习时间
  masteryLevel: number;     // 掌握程度 0-5，0=未复习，5=已掌握
};

// ==================== 历史记录类型 ====================

export type HistoryItemType = 'word' | 'sentence';

export type HistoryItem = {
  id: string;
  word: string;
  type: HistoryItemType;
  result: QueryResponse;
  timestamp: number;
};

// ==================== 用户配置类型 ====================

export type Settings = {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  historyLimit: number;
  clipboardTranslationEnabled: boolean;
  clipboardTranslationInterval: number;
  autoStart: boolean;
  silentStart: boolean;
};

export const defaultSettings: Settings = {
  apiBaseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  historyLimit: 100,
  clipboardTranslationEnabled: false,
  clipboardTranslationInterval: 1000,
  autoStart: false,
  silentStart: false,
};

// ==================== Toast 类型 ====================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type ToastState = {
  message: string;
  type: ToastType;
  duration: number;
  visible: boolean;
};

// ==================== 单词条目类型（IndexedDB 存储）====================

export type WordEntry = {
  id: string;              // 单词唯一标识（使用单词本身作为 ID）
  word: string;            // 单词
  phonetic?: string;       // 音标
  translation: TranslationMap;  // 翻译（可编辑）
  example: ExampleSentence[];   // 例句（可编辑）
  note?: string;           // 个人批注/备注
  createdAt: number;       // 首次查询时间
  updatedAt: number;       // 最后更新时间
  queryCount: number;      // 查询次数
}

// ==================== 应用状态类型 ====================

export type PageType = 'search' | 'favorites' | 'history' | 'review' | 'settings' | 'grammar';

// ==================== 语法检查结果类型 ====================

export type GrammarCorrectionType = 'grammar' | 'style' | 'word-choice' | 'spelling';

export interface GrammarCorrection {
  original: string;
  corrected: string;
  explanation: string;
  type: GrammarCorrectionType;
}

export interface GrammarCheckResult {
  originalText: string;
  correctedText: string;
  corrections: GrammarCorrection[];
  overallFeedback?: string;
}

export type AppState = {
  currentPage: PageType;
  queryResult: QueryResponse | null;
  isLoading: boolean;
  error: string | null;
  lastQuery: string;
  toast: ToastState | null;
  clipboardText: string;
};
