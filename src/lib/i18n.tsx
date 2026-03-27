"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "en" | "zh" | "zh-tw" | "ja";
export type Theme = "dark" | "light";

const T = {
  en: {
    appName: "TEDMaster",
    tagline: "AI-Powered English Learning",
    hero: "Master English with TED Talks",
    heroSub: "AI vocabulary lookup, grammar analysis, and shadowing practice — all in one focused reading environment.",
    placeholder: "Paste a TED Talk URL to get started...",
    analyze: "Analyze",
    analyzing: "Analyzing...",
    startLearning: "Start Learning →",
    by: "by",
    f1Title: "Syntax Analysis",
    f1Desc: "AI breaks down complex sentences into digestible grammar components with Chinese explanations.",
    f2Title: "Shadow Practice",
    f2Desc: "Record yourself sentence by sentence and compare rhythm with the original speaker.",
    f3Title: "Vocabulary Builder",
    f3Desc: "Click any word for instant definition, IPA, synonyms, collocations, and example sentences.",
    transcript: "Transcript",
    analyzeBtn: "Analyze",
    saveWord: "Save to Vocabulary",
    close: "Close",
    vocab: "Learning Hub",
    exportLabel: "Export",
    mainSize: "Main Font Size",
    subSize: "Sub Font Size",
    syncOffset: "Subtitle Offset",
    downloadVideo: "Download Video",
    exportPdf: "Export PDF",
    exportSrt: "Export SRT",
    meaning: "Meaning",
    synonyms: "Synonyms",
    antonyms: "Antonyms",
    collocations: "Collocations",
    example: "Example",
    structure: "Sentence Structure",
    insights: "Learning Points",
    vocabEmpty: "No words saved yet.\nClick any word while studying to add it.",
    sentences: "Sentences",
    saveSentence: "Save Sentence",
    note: "Note",
    addNote: "Add Note",
    notePlaceholder: "Write your thoughts here...",
    saveNote: "Save Note",
    wordsTab: "Words",
    sentencesTab: "Sentences",
    sentEmpty: "No sentences saved yet.\nClick AI Analyze and save key points.",
    hotkeys: "Space · ← → · V · Esc",
    notesTab: "Notes",
    aiAnalysis: "AI Analysis",
    recordBtn: "Record",
    recording: "Recording...",
    exportConfig: "Export Options",
    includeVocab: "Include Learning Hub",
    includeScript: "Include Full Script",
    includeAnalysis: "Include AI Analysis",
    includeNotes: "Include My Notes",
    confirmPrint: "Generate PDF",
    volume: "Volume",
    mainColor: "Main Color",
    subColor: "Sub Color",
    fullscreen: "Fullscreen",
    pip: "PiP",
    loading: "Loading...",
    loadingTalk: "Loading talk...",
    balance: "Balance",
    login: "Sign In",
    logout: "Log Out",
    github: "GitHub",
    footer: "Non-commercial open source project · for English learners",
    errorInvalidUrl: "Please enter a valid TED Talk URL.",
    settings: "Settings",
    display: "Display",
    history: "History",
    aiTranscribe: "AI Local Transcribe",
    aiTranscribing: "AI Transcribing...",
    aiTranslate: "AI Translate",
    aiTranslating: "AI Translating...",
    preparingAudio: "Preparing audio data...",
    subtitleLangLabel: "Subtitle Language",
    loadingSubtitles: "Loading subtitles...",
    continueLearning: "Continue Learning",
    tryExample: "Try an example",
    register: "Register",
  },
  zh: {
    appName: "TEDMaster",
    tagline: "AI 驱动的英语精读平台",
    hero: "用 TED 演讲精读英语",
    heroSub: "AI 词汇解析、语法拆句、跟读练习，沉浸式学习最地道的英语表达。",
    placeholder: "粘贴 TED 演讲链接开始学习...",
    analyze: "解析",
    analyzing: "解析中...",
    startLearning: "进入学习 →",
    by: "主讲人",
    f1Title: "句法透视",
    f1Desc: "AI 将复杂长句拆解为主谓宾等语法成分，并配中文说明。",
    f2Title: "跟读练习",
    f2Desc: "逐句录音与原声对比，训练语调、节奏与连读。",
    f3Title: "智能生词本",
    f3Desc: "点击任意单词，即时获取音标、释义、近义词与例句。",
    transcript: "逐句对照",
    analyzeBtn: "AI 分析",
    saveWord: "加入知识库",
    close: "关闭",
    vocab: "知识库",
    exportLabel: "导出",
    mainSize: "主字号",
    subSize: "译文字号",
    syncOffset: "字幕偏移",
    downloadVideo: "下载视频",
    exportPdf: "导出 PDF",
    exportSrt: "导出字幕",
    meaning: "释义",
    synonyms: "近义词",
    antonyms: "反义词",
    collocations: "常用搭配",
    example: "例句",
    structure: "句子结构",
    insights: "学习要点",
    vocabEmpty: "生词本为空\n学习时点击单词即可加入。",
    sentences: "重点句",
    saveSentence: "收藏此句",
    note: "笔记",
    addNote: "记笔记",
    notePlaceholder: "在这里写下你的学习心得...",
    saveNote: "保存笔记",
    wordsTab: "单词",
    sentencesTab: "句子",
    sentEmpty: "重点句本为空\n点击 AI 分析并收藏中心思想。",
    hotkeys: "空格 · ← → · V · Esc",
    notesTab: "笔记",
    aiAnalysis: "AI 解析",
    recordBtn: "跟读",
    recording: "正在录音...",
    exportConfig: "导出设置",
    includeVocab: "包含知识库",
    includeScript: "包含全文脚本",
    includeAnalysis: "包含 AI 句子解析",
    includeNotes: "包含我的笔记",
    confirmPrint: "生成 PDF",
    volume: "音量",
    mainColor: "主字幕颜色",
    subColor: "副字幕颜色",
    fullscreen: "全屏",
    pip: "画中画",
    loading: "加载中...",
    loadingTalk: "正在加载演讲...",
    balance: "账户余额",
    login: "登录账户",
    logout: "安全退出",
    github: "GitHub",
    footer: "非商业开源项目 · 为英语学习者打造",
    errorInvalidUrl: "请输入有效的 TED 演讲链接。",
    settings: "设置",
    display: "显示",
    history: "播放历史",
    aiTranscribe: "AI 本地转录",
    aiTranscribing: "AI 转录中...",
    aiTranslate: "AI 翻译",
    aiTranslating: "AI 翻译中...",
    preparingAudio: "正在准备音频数据...",
    subtitleLangLabel: "字幕语言",
    loadingSubtitles: "正在加载字幕...",
    continueLearning: "继续学习",
    tryExample: "快速体验",
    register: "注册",
  },
  "zh-tw": {
    appName: "TEDMaster",
    tagline: "AI 驅動的英語精讀平台",
    hero: "用 TED 演講精讀英語",
    heroSub: "AI 詞彙解析、語法拆句、跟讀練習，沉浸式學習最道地的英語表達。",
    placeholder: "貼上 TED 演講連結開始學習...",
    analyze: "解析",
    analyzing: "解析中...",
    startLearning: "進入學習 →",
    by: "主講人",
    f1Title: "句法透視",
    f1Desc: "AI 將複雜長句拆解為主謂賓等語法成分，並配中文說明。",
    f2Title: "跟讀練習",
    f2Desc: "逐句錄音與原聲對比，訓練語調、節奏與連讀。",
    f3Title: "智能單字本",
    f3Desc: "點擊任意單詞，即時獲取音標、釋義、近義詞與例句。",
    transcript: "逐句對照",
    analyzeBtn: "AI 分析",
    saveWord: "加入知識庫",
    close: "關閉",
    vocab: "知識庫",
    exportLabel: "匯出",
    mainSize: "主字號",
    subSize: "譯文字號",
    syncOffset: "字幕偏移",
    downloadVideo: "下載影片",
    exportPdf: "匯出 PDF",
    exportSrt: "匯出字幕",
    meaning: "釋義",
    synonyms: "近義詞",
    antonyms: "反義詞",
    collocations: "常用搭配",
    example: "例句",
    structure: "句子結構",
    insights: "學習要點",
    vocabEmpty: "單字本為空\n學習時點擊單詞即可加入。",
    sentences: "重點句",
    saveSentence: "收藏此句",
    note: "筆記",
    addNote: "記筆記",
    notePlaceholder: "在這裡寫下你的學習心得...",
    saveNote: "保存筆記",
    wordsTab: "單詞",
    sentencesTab: "句子",
    sentEmpty: "重點句本為空\n點擊 AI 分析並收藏中心思想。",
    hotkeys: "空格 · ← → · V · Esc",
    notesTab: "筆記",
    aiAnalysis: "AI 解析",
    recordBtn: "跟讀",
    recording: "正在錄音...",
    exportConfig: "匯出設置",
    includeVocab: "包含知識庫",
    includeScript: "包含全文腳本",
    includeAnalysis: "包含 AI 句子解析",
    includeNotes: "包含我的筆記",
    confirmPrint: "生成 PDF",
    volume: "音量",
    mainColor: "主字幕顏色",
    subColor: "副字幕顏色",
    fullscreen: "全屏",
    pip: "畫中畫",
    loading: "載入中...",
    loadingTalk: "正在載入演講...",
    balance: "賬戶餘額",
    login: "登錄賬戶",
    logout: "安全退出",
    github: "GitHub",
    footer: "非商業開源專案 · 為英語學習者打造",
    errorInvalidUrl: "請輸入有效的 TED 演講連結。",
    settings: "設置",
    display: "顯示",
    history: "播放歷史",
    aiTranscribe: "AI 本地轉錄",
    aiTranscribing: "AI 轉錄中...",
    aiTranslate: "AI 翻譯",
    aiTranslating: "AI 翻譯中...",
    preparingAudio: "正在準備音訊數據...",
    subtitleLangLabel: "字幕語言",
    loadingSubtitles: "正在載入字幕...",
    continueLearning: "繼續學習",
    tryExample: "快速體驗",
    register: "注冊",
  },
  ja: {
    appName: "TEDMaster",
    tagline: "AIを活用したTED英語精読",
    hero: "TEDトークで英語を精読しよう",
    heroSub: "AI語彙解析・文法分解・シャドーイング練習を一つの環境で。本物の英語表現を身につける。",
    placeholder: "TEDトークのURLを貼り付け...",
    analyze: "解析",
    analyzing: "解析中...",
    startLearning: "学習を始める →",
    by: "スピーカー",
    f1Title: "文法解析",
    f1Desc: "AIが複雑な文を主語・動詞・目的語などの文法要素に分解し、中国語で解説します。",
    f2Title: "シャドーイング",
    f2Desc: "一文ずつ録音してオリジナルと比較、イントネーションとリズムを練習。",
    f3Title: "スマート単語帳",
    f3Desc: "単語をクリックしてIPA・意味・類義語・コロケーションを即座に確認。",
    transcript: "対訳",
    analyzeBtn: "AI分析",
    saveWord: "学習ノートに追加",
    close: "閉じる",
    vocab: "学習ハブ",
    exportLabel: "出力",
    mainSize: "メインサイズ",
    subSize: "サブサイズ",
    syncOffset: "字幕オフセット",
    downloadVideo: "動画ダウンロード",
    exportPdf: "PDF出力",
    exportSrt: "字幕出力",
    meaning: "意味",
    synonyms: "類義語",
    antonyms: "対義語",
    collocations: "コロケーション",
    example: "例文",
    structure: "文章構造",
    insights: "学習ポイント",
    vocabEmpty: "単語帳は空です\n学習中に単語をクリックして追加。",
    sentences: "重要文",
    saveSentence: "文を保存",
    note: "ノート",
    addNote: "ノートを取る",
    notePlaceholder: "ここに学習のポイントを記入...",
    saveNote: "ノートを保存",
    wordsTab: "単語",
    sentencesTab: "文章",
    sentEmpty: "保存された文章はありません\nAI分析をクリックして保存してください。",
    hotkeys: "スペース · ← → · V · Esc",
    notesTab: "ノート",
    aiAnalysis: "AI解析",
    recordBtn: "録音",
    recording: "録音中...",
    exportConfig: "エクスポート設定",
    includeVocab: "学習ハブを含める",
    includeScript: "スクリプトを含める",
    includeAnalysis: "AI解析を含める",
    includeNotes: "ノートを含める",
    confirmPrint: "PDFを生成",
    volume: "音量",
    mainColor: "主字幕の色",
    subColor: "副字幕の色",
    fullscreen: "全画面",
    pip: "画中画",
    loading: "読み込み中...",
    loadingTalk: "トークを読み込み中...",
    balance: "残高",
    login: "ログイン",
    logout: "ログアウト",
    github: "GitHub",
    footer: "非商用オープンソースプロジェクト · 英語学習者のために",
    errorInvalidUrl: "有効なTEDトークURLを入力してください。",
    settings: "設定",
    display: "表示",
    history: "再生履歴",
    aiTranscribe: "Local AI文字起こし",
    aiTranscribing: "AI文字起こし中...",
    aiTranslate: "AI翻訳",
    aiTranslating: "AI翻訳中...",
    preparingAudio: "音声データを準備中...",
    subtitleLangLabel: "字幕言語",
    loadingSubtitles: "字幕を読み込み中...",
    continueLearning: "学習を続ける",
    tryExample: "サンプルを試す",
    register: "登録",
  },
} as const;

type Translations = { [K in keyof typeof T.en]: string };

interface AppContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  subtitleLang: string;
  setSubtitleLang: (l: string) => void;
  theme: Theme;
  toggleTheme: () => void;
  t: Translations;
}

const AppContext = createContext<AppContextType | null>(null);

// Default subtitle lang derived from UI lang (used when no saved preference)
const UI_TO_SUBTITLE: Record<string, string> = {
  zh: "zh-cn", "zh-tw": "zh-tw", ja: "ja", en: "en",
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [theme, setTheme] = useState<Theme>("dark");
  // Lazy init: read localStorage synchronously so the value is correct on first render,
  // preventing a double-fetch in the watch page.
  const [subtitleLang, setSubtitleLangState] = useState<string>(() => {
    if (typeof window === "undefined") return "zh-cn";
    const saved = localStorage.getItem("tm_subtitle_lang");
    if (saved) return saved;
    const uiLang = localStorage.getItem("tm_lang");
    return UI_TO_SUBTITLE[uiLang || ""] || "zh-cn";
  });

  useEffect(() => {
    const savedLang = localStorage.getItem("tm_lang") as Lang | null;
    const savedTheme = localStorage.getItem("tm_theme") as Theme | null;
    if (savedLang && T[savedLang]) setLangState(savedLang);
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("tm_lang", l);
  };

  const setSubtitleLang = (l: string) => {
    setSubtitleLangState(l);
    localStorage.setItem("tm_subtitle_lang", l);
  };

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("tm_theme", next);
  };

  return (
    <AppContext.Provider value={{ lang, setLang, subtitleLang, setSubtitleLang, theme, toggleTheme, t: T[lang] }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export const LANGS: { value: Lang; label: string; short: string }[] = [
  { value: "en", label: "English", short: "EN" },
  { value: "zh", label: "简体中文", short: "简" },
  { value: "zh-tw", label: "繁體中文", short: "繁" },
  { value: "ja", label: "日本語", short: "日" },
];

// Subtitle language options — TED translation language codes
export const SUBTITLE_LANGS: { value: string; label: string; short: string }[] = [
  { value: "en",    label: "English only", short: "EN" },
  { value: "zh-cn", label: "简体中文",      short: "简" },
  { value: "zh-tw", label: "繁體中文",      short: "繁" },
  { value: "ja",    label: "日本語",        short: "日" },
  { value: "ko",    label: "한국어",        short: "한" },
  { value: "fr",    label: "Français",      short: "FR" },
  { value: "es",    label: "Español",       short: "ES" },
  { value: "pt",    label: "Português",     short: "PT" },
  { value: "de",    label: "Deutsch",       short: "DE" },
];
