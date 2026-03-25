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
    vocab: "Vocabulary",
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
    hotkeys: "Space · ← → · V · Esc",
    loading: "Loading...",
    loadingTalk: "Loading talk...",
    github: "GitHub",
    footer: "Non-commercial open source project · for English learners",
    errorInvalidUrl: "Please enter a valid TED Talk URL.",
    settings: "Settings",
    display: "Display",
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
    saveWord: "加入生词本",
    close: "关闭",
    vocab: "生词本",
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
    hotkeys: "空格 · ← → · V · Esc",
    loading: "加载中...",
    loadingTalk: "正在加载演讲...",
    github: "GitHub",
    footer: "非商业开源项目 · 为英语学习者打造",
    errorInvalidUrl: "请输入有效的 TED 演讲链接。",
    settings: "设置",
    display: "显示",
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
    saveWord: "加入單字本",
    close: "關閉",
    vocab: "單字本",
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
    hotkeys: "空格 · ← → · V · Esc",
    loading: "載入中...",
    loadingTalk: "正在載入演講...",
    github: "GitHub",
    footer: "非商業開源專案 · 為英語學習者打造",
    errorInvalidUrl: "請輸入有效的 TED 演講連結。",
    settings: "設置",
    display: "顯示",
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
    saveWord: "単語帳に追加",
    close: "閉じる",
    vocab: "単語帳",
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
    hotkeys: "スペース · ← → · V · Esc",
    loading: "読み込み中...",
    loadingTalk: "トークを読み込み中...",
    github: "GitHub",
    footer: "非商用オープンソースプロジェクト · 英語学習者のために",
    errorInvalidUrl: "有効なTEDトークURLを入力してください。",
    settings: "設定",
    display: "表示",
  },
} as const;

type Translations = { [K in keyof typeof T.en]: string };

interface AppContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  toggleTheme: () => void;
  t: Translations;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [theme, setTheme] = useState<Theme>("dark");

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

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("tm_theme", next);
  };

  return (
    <AppContext.Provider value={{ lang, setLang, theme, toggleTheme, t: T[lang] }}>
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
