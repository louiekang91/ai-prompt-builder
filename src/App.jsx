import React, { useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  AlertCircle,
  Languages,
  Play,
  Save,
  FileText,
  X,
  Edit3,
  Plus,
  Trash2,
  RotateCw,
  Home,
} from "lucide-react";

/**
 * AI Prompt Builder – Single-file React prototype (JSX)
 * - Tailwind v4 (zero-config) + Vite
 * - No backend, client-only state
 * - Needs: `npm i lucide-react`
 *
 * 변경 사항(요청 반영)
 * 1) 모든 '다음' 버튼 글씨를 흰색 → 검정색으로 변경(화이트 배경/보더).
 * 2) 각 단계의 '이전'과 '다음' 사이에 "처음으로 돌아가기" 버튼 추가(1단계로 이동).
 * 3) 1단계 '입력'에 "AI 툴 선택" 필드 추가(ChatGPT, Claude, Gemini, Grok, SONA 등).
 * 4) 프롬프트 조립 시 선택한 AI 툴을 환경/제약에 반영(툴 최적화 가이드 문구 포함).
 * 5) 2단계 '질문'은 1단계 정보에 따라 동적으로 생성 + '질문 추가' 지원(수시 변경 가능).
 */

// ------- Types (JS 가벼운 주석용) -------
// Question: { id, label, placeholder?, type: 'text'|'select'|'textarea', options?: string[] }

// ------- Dynamic questions generator -------
function makeQuestions({ aiTool, mode, goalText }) {
  const base = [
    {
      id: "version",
      label: "버전/환경을 지정해주세요 (예: n8n 1.100.1 또는 사용 API 버전)",
      placeholder: "예: n8n 1.100.1",
      type: "text",
    },
    {
      id: "creds",
      label: "Credentials 상태는 어떤가요?",
      type: "select",
      options: ["모두 적용", "일부 적용", "미완료"],
    },
    {
      id: "sources",
      label:
        "입력/출력 데이터 소스는? (예: Google Drive OCR → Google Sheets → Notion)",
      placeholder: "예: Google Drive OCR → Google Sheets",
      type: "text",
    },
    {
      id: "deliverable",
      label:
        "최종 산출물 형식을 지정해주세요 (예: n8n workflow JSON + 주석 / Markdown 템플릿 / 스키마)",
      placeholder: "예: JSON + 주석 + 테스트 체크리스트",
      type: "text",
    },
    {
      id: "edge",
      label: "예외/에러 케이스를 지정해주세요",
      placeholder: "예: 인증 실패, 빈 데이터, 중복 데이터, 권한 오류",
      type: "textarea",
    },
  ];

  // AI 툴별 가이드/추가 질문
  const toolExtras = {
    ChatGPT: [
      {
        id: "chatgpt_model",
        label: "사용할 모델/엔진 이름(예: gpt-4o / o3 / o4-mini-high)",
        type: "text",
        placeholder: "예: gpt-4o",
      },
      {
        id: "chatgpt_output",
        label: "출력 형식 고정 필요 여부(JSON/Markdown/코드블록)",
        type: "select",
        options: ["JSON", "Markdown", "Code block", "상관없음"],
      },
    ],
    Claude: [
      {
        id: "claude_model",
        label: "사용할 모델/엔진 이름(예: Claude 3.5 Sonnet 등)",
        type: "text",
        placeholder: "예: Claude 3.5 Sonnet",
      },
      {
        id: "claude_style",
        label: "토큰 절약/간결성 우선 여부",
        type: "select",
        options: ["네", "아니오"],
      },
    ],
    Gemini: [
      {
        id: "gemini_model",
        label: "사용할 모델/엔진 이름(예: Gemini 1.5 Pro 등)",
        type: "text",
        placeholder: "예: Gemini 1.5 Pro",
      },
      {
        id: "gemini_safety",
        label: "세이프티 가이드(금칙/톤) 필요 여부",
        type: "select",
        options: ["필요", "불필요"],
      },
    ],
    Grok: [
      {
        id: "grok_model",
        label: "사용할 모델/엔진 이름",
        type: "text",
        placeholder: "예: Grok-2",
      },
    ],
    SONA: [
      {
        id: "sona_model",
        label: "사용할 모델/엔진 이름",
        type: "text",
        placeholder: "예: SONA-…",
      },
    ],
  };

  const extras = toolExtras[aiTool] ?? [
    {
      id: "llm_model",
      label: "사용할 모델/엔진 이름",
      type: "text",
      placeholder: "예: 모델명",
    },
  ];

  // 고급 모드: 추가 심화 질문
  const proOnly = [
    {
      id: "evaluation",
      label:
        "결과 검증 방법(스키마 검증, 샘플 데이터, 자동 재시도 규칙 등)을 구체적으로 적어주세요",
      type: "textarea",
      placeholder: "예: 샘플 3건, 실패 시 2회 재시도 후 요약 리포트",
    },
    {
      id: "limits",
      label: "성능/비용 제약(토큰/속도/요금 한도)",
      type: "text",
      placeholder: "예: 응답 8초 이내, 비용 1회 0.02$ 이내",
    },
  ];

  const toolContext =
    goalText && goalText.toLowerCase().includes("이미지")
      ? [
          {
            id: "vision",
            label: "이미지/파일 입력 여부와 처리 범위(해상도, OCR 등)",
            type: "textarea",
            placeholder: "예: JPG 300dpi, 영역 OCR 추출",
          },
        ]
      : [];

  return [...extras, ...base, ...toolContext, ...(mode === "pro" ? proOnly : [])];
}

// ------- Helpers -------
function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}
function scoreQuality(state) {
  let s = 50;
  if (state.goalText.trim().length > 10) s += 10;
  if ((state.answers.version || "").trim()) s += 8;
  if (state.sections.outputs.trim().length > 20) s += 10;
  if (state.sections.validation.trim().length > 20) s += 10;
  if (state.sections.exceptions.trim().length > 10) s += 8;
  return Math.min(100, s);
}

// ------- Initial State -------
const initialState = {
  step: 1, // 1~5
  mode: "beginner", // 'beginner' | 'pro'
  aiTool: "ChatGPT", // 새로 추가: 1단계 AI 툴 선택
  goalText: "",
  researchSummary:
    "초안 리서치: 사용 도구/버전, 인증 상태, 데이터 소스, 출력 형식, 예외 처리 항목을 정리합니다. 고급 모드에선 노드/성능/보안도 점검합니다.",
  answers: {},
  customQuestions: [], // 사용자 추가 질문
  sections: {
    role:
      "당신은 시니어 오토메이션 엔지니어입니다. 사용자의 목표를 빠르게 파악하고 구조화된 프롬프트를 작성하세요.",
    goal:
      "최종 산출물은 실행 가능한 프롬프트 또는 n8n 워크플로우 JSON 스켈레톤입니다.",
    environment: "(예) n8n 1.100.1 / Google Workspace 연동 / Vision API 사용",
    inputs:
      "(예) 스캔 이미지(JPG) → OCR → 파싱 스키마: 날짜, 품목, LotNo, 수량…",
    outputs: "(예) JSON 코드블록 + 주석, 또는 n8n 워크플로우 JSON 구조",
    constraints:
      "명확성, 재현성, 보안(비밀키 노출 금지), 성능(타임아웃 대비)",
    exceptions: "인증 실패, 빈 데이터, 중복/중첩 행, 시트 권한 오류 시의 분기",
    validation: "샘플 3건으로 시뮬레이션, 결과 스키마 검증, 실패시 재시도 규칙",
    examples: "입력 예시와 기대 출력 예시를 제공",
  },
  language: "ko", // 'ko' | 'en' | 'both'
};

// ------- App -------
export default function App() {
  const [state, setState] = useState(initialState);

  const questions = useMemo(
    () =>
      [
        ...makeQuestions({
          aiTool: state.aiTool,
          mode: state.mode,
          goalText: state.goalText,
        }),
        ...state.customQuestions, // 사용자 추가
      ],
    [state.aiTool, state.mode, state.goalText, state.customQuestions]
  );

  const qAnswered = (id) => Boolean((state.answers[id] || "").trim());
  const allQsAnswered = questions.every((q) => qAnswered(q.id));
  const qualScore = useMemo(() => scoreQuality(state), [state]);

  const next = () =>
    setState((s) => ({ ...s, step: Math.min(5, s.step + 1) }));
  const prev = () =>
    setState((s) => ({ ...s, step: Math.max(1, s.step - 1) }));
  const goFirst = () => setState((s) => ({ ...s, step: 1 }));

  const setAnswer = (id, v) =>
    setState((s) => ({ ...s, answers: { ...s.answers, [id]: v } }));
  const setSection = (id, v) =>
    setState((s) => ({ ...s, sections: { ...s.sections, [id]: v } }));

  const addCustomQuestion = (q) =>
    setState((s) => ({ ...s, customQuestions: [...s.customQuestions, q] }));
  const removeCustomQuestion = (id) =>
    setState((s) => ({
      ...s,
      customQuestions: s.customQuestions.filter((q) => q.id !== id),
    }));

  const assemblePrompt = () => {
    const a = state.answers;
    const s = state.sections;
    const langNote =
      state.language === "ko"
        ? "(언어: 한국어)"
        : state.language === "en"
        ? "(Language: English)"
        : "(언어: 한국어/영어 병기)";

    // AI 툴 최적화 힌트
    const toolGuide = {
      ChatGPT:
        "- 출력은 코드블록(```json)으로 고정하고 스키마를 준수하세요.\n- 불확실하면 추가 질문 후 진행.\n- 단계별 설명과 함께 결과를 제공합니다.",
      Claude:
        "- 간결/정확 위주로 답변하고, 불확실성은 명시하세요.\n- 토큰 효율을 고려해 중복 설명을 줄입니다.",
      Gemini:
        "- 멀티모달 입력(이미지/파일) 가능 여부를 고려하세요.\n- 세이프티 가이드 준수 및 금칙 표현 필터링을 적용합니다.",
      Grok:
        "- 최신성/재치 있는 톤 요청 시에도 사실 검증을 우선합니다.",
      SONA:
        "- 엔진 특성에 맞춘 예시/제약을 명시하고, 형식 일관성을 유지합니다.",
      default:
        "- 선택한 엔진에 맞춘 출력 형식과 제약을 엄격히 준수하세요.",
    };

    const toolNote = toolGuide[state.aiTool] ?? toolGuide.default;

    return [
      `# 역할\n${s.role}`,
      `# 목표/산출물\n${s.goal}`,
      `# 환경·버전\n${s.environment}\nAI 툴: ${state.aiTool}\n도구: ${
        a.tool ?? "n8n"
      }, 버전: ${a.version ?? "-"}, Credentials: ${a.creds ?? "-"}`,
      `# 입력 스펙\n${s.inputs}\n데이터 소스: ${a.sources ?? "-"}`,
      `# 출력 포맷\n${s.outputs}\n산출물: ${a.deliverable ?? "-"}`,
      `# 제약/정책\n${s.constraints}\n\n# AI 툴 최적화 가이드\n${toolNote}`,
      `# 예외 처리\n${s.exceptions}\n추가 예외: ${a.edge ?? "-"}`,
      `# 검증/테스트\n${s.validation}`,
      `# 예시\n${s.examples}`,
      `# 언어\n${langNote}`,
    ].join("\n\n");
  };

  const promptText = useMemo(assemblePrompt, [state]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopNav state={state} setState={setState} />
      <main className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-9 space-y-4">
          <Stepper step={state.step} />
          {state.step === 1 && (
            <GoalStep
              state={state}
              setState={setState}
              onNext={next}
            />
          )}
          {state.step === 2 && (
            <InterviewStep
              questions={questions}
              answers={state.answers}
              setAnswer={setAnswer}
              onNext={next}
              onPrev={prev}
              onFirst={goFirst}
              onAddCustom={addCustomQuestion}
              onRemoveCustom={removeCustomQuestion}
            />
          )}
          {state.step === 3 && (
            <SectionsStep
              sections={state.sections}
              setSection={setSection}
              onNext={next}
              onPrev={prev}
              onFirst={goFirst}
            />
          )}
          {state.step === 4 && (
            <BuildReviewStep
              promptText={promptText}
              quality={qualScore}
              onNext={next}
              onPrev={prev}
              onFirst={goFirst}
            />
          )}
          {state.step === 5 && (
            <ExportStep
              state={state}
              setState={setState}
              promptText={promptText}
              onPrev={prev}
              onFirst={goFirst}
            />
          )}
        </div>
        <div className="col-span-12 lg:col-span-3">
          <Inspector
            state={state}
            quality={qualScore}
            allQsAnswered={allQsAnswered}
          />
        </div>
      </main>
    </div>
  );
}

// ------- UI Parts -------
function TopNav({ state, setState }) {
  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
        <div className="font-bold text-lg">초보자도 쉽게 만드는 AI 프롬프트</div>
        <div className="ml-auto flex items-center gap-3">
          <ModeToggle
            mode={state.mode}
            onChange={(m) => setState((s) => ({ ...s, mode: m }))}
          />
          <LanguageToggle
            lang={state.language}
            onChange={(language) =>
              setState((s) => ({ ...s, language }))
            }
          />
          <button className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-slate-50">
            <Save className="h-4 w-4" /> 저장
          </button>
        </div>
      </div>
    </header>
  );
}

function ModeToggle({ mode, onChange }) {
  return (
    <div className="flex items-center gap-2">
      {/* 초보자 */}
      <button
        type="button"
        aria-pressed={mode === "beginner"}
        onClick={() => onChange("beginner")}
        className={classNames(
          "px-3 py-1.5 text-sm rounded-xl border transition-all select-none font-medium",
          "active:translate-y-[1px] active:shadow-inner",
          mode === "beginner"
            ? // 선택됨 = 눌린 상태 + 컬러 텍스트(흰색 아님)
              "bg-emerald-200 text-emerald-900 border-emerald-400 shadow-inner ring-2 ring-emerald-300 translate-y-[1px]"
            : // 미선택 = 라이트 버튼
              "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
        )}
      >
        초보자
      </button>

      {/* 고급 */}
      <button
        type="button"
        aria-pressed={mode === "pro"}
        onClick={() => onChange("pro")}
        className={classNames(
          "px-3 py-1.5 text-sm rounded-xl border transition-all select-none font-medium",
          "active:translate-y-[1px] active:shadow-inner",
          mode === "pro"
            ? "bg-indigo-200 text-indigo-900 border-indigo-400 shadow-inner ring-2 ring-indigo-300 translate-y-[1px]"
            : "bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100"
        )}
      >
        고급
      </button>
    </div>
  );
}


function LanguageToggle({ lang, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <Languages className="h-4 w-4" />
      <select
        className="border rounded-lg px-2 py-1"
        value={lang}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="ko">한국어</option>
        <option value="en">English</option>
        <option value="both">한국어+English</option>
      </select>
    </div>
  );
}

function Stepper({ step }) {
  const steps = ["입력", "질문", "구성", "리뷰", "결과"];
  return (
    <ol className="flex items-center gap-2">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n <= step;
        return (
          <li key={label} className="flex items-center gap-2">
            <div
              className={classNames(
                "h-6 w-6 grid place-items-center rounded-full text-xs",
                active ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-600"
              )}
            >
              {n}
            </div>
            <span className={classNames("text-sm", active ? "font-semibold" : "text-slate-500")}>
              {label}
            </span>
            {i < steps.length - 1 && (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function GoalStep({ state, setState, onNext }) {
  const aiOptions = ["ChatGPT", "Claude", "Gemini", "Grok", "SONA", "Other"];
  const canNext = state.goalText.trim().length > 0;

  return (
    <section className="bg-white rounded-2xl border p-4 md:p-6 space-y-4">
      <h2 className="text-xl font-semibold">1) 최종 목표 한 문장으로 입력</h2>

      {/* AI 툴 선택 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">AI 툴 선택</label>
          <select
            className="w-full border rounded-xl px-3 py-2 mt-1"
            value={state.aiTool}
            onChange={(e) => setState((s) => ({ ...s, aiTool: e.target.value }))}
          >
            {aiOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            선택한 툴에 맞춰 2단계 질문이 자동으로 최적화됩니다.
          </p>
        </div>
      </div>

      <p className="text-slate-600 text-sm mt-2">
        예: n8n으로 자동화 파이프라인을 JSON 파일로 만들어줘.
      </p>
      <textarea
        className="w-full min-h-[110px] rounded-xl border p-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
        placeholder="여기에 입력하세요"
        value={state.goalText}
        onChange={(e) => setState((s) => ({ ...s, goalText: e.target.value }))}
      />
      <div className="flex items-center justify-between">
        <div className="text-slate-500 text-sm">
          진행률: {Math.min(100, Math.round((state.goalText.trim().length / 20) * 100))}%
        </div>
        <div className="flex items-center gap-2">
          {/* 다음 버튼: 글씨 검정, 화이트 배경 */}
          <button
            onClick={onNext}
            disabled={!canNext}
            className={classNames(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 border",
              canNext ? "bg-white text-slate-900 hover:bg-slate-50" : "bg-slate-100 text-slate-400 cursor-not-allowed"
            )}
          >
            다음 <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

function InterviewStep({
  questions,
  answers,
  setAnswer,
  onNext,
  onPrev,
  onFirst,
  onAddCustom,
  onRemoveCustom,
}) {
  const allDone = questions.every((q) => Boolean((answers[q.id] || "").trim()));
  const [draft, setDraft] = useState({ label: "", type: "text", options: "" });

  const addCustom = () => {
    if (!draft.label.trim()) return;
    const id =
      "custom_" + draft.label.trim().toLowerCase().replace(/\s+/g, "_") + "_" + Math.random().toString(36).slice(2, 6);
    const q = {
      id,
      label: draft.label.trim(),
      type: draft.type,
      ...(draft.type === "select" && draft.options
        ? { options: draft.options.split(",").map((s) => s.trim()).filter(Boolean) }
        : {}),
    };
    onAddCustom(q);
    setDraft({ label: "", type: "text", options: "" });
  };

  return (
    <section className="bg-white rounded-2xl border p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">2) 요건 인터뷰(동적)</h2>
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <RotateCw className="h-3.5 w-3.5" />
          1단계 정보/모드에 따라 자동으로 질문이 최적화됩니다.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {questions.map((q) => (
          <div key={q.id} className="flex flex-col gap-2">
            <label className="text-sm font-medium flex items-center gap-2">
              {q.label}
              {String(q.id).startsWith("custom_") && (
                <button
                  className="ml-1 inline-flex items-center gap-1 text-xs text-rose-600 hover:underline"
                  onClick={() => onRemoveCustom(q.id)}
                  title="삭제"
                >
                  <Trash2 className="h-3 w-3" /> 삭제
                </button>
              )}
            </label>
            {q.type === "select" ? (
              <select
                className="border rounded-xl px-3 py-2"
                value={answers[q.id] || ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              >
                <option value="">선택</option>
                {q.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : q.type === "textarea" ? (
              <textarea
                className="border rounded-xl p-3 min-h-[90px]"
                placeholder={q.placeholder}
                value={answers[q.id] || ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              />
            ) : (
              <input
                className="border rounded-xl px-3 py-2"
                placeholder={q.placeholder}
                value={answers[q.id] || ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>

      {/* 사용자 정의 질문 추가 영역 */}
      <div className="rounded-xl border p-3 space-y-2">
        <div className="text-sm font-medium">질문 추가(수시 변경)</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            className="border rounded-xl px-3 py-2"
            placeholder="라벨(질문 내용)"
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          />
          <select
            className="border rounded-xl px-3 py-2"
            value={draft.type}
            onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
          >
            <option value="text">텍스트</option>
            <option value="textarea">긴 텍스트</option>
            <option value="select">선택</option>
          </select>
          {draft.type === "select" ? (
            <input
              className="border rounded-xl px-3 py-2"
              placeholder="옵션(쉼표로 구분)"
              value={draft.options}
              onChange={(e) => setDraft((d) => ({ ...d, options: e.target.value }))}
            />
          ) : (
            <div />
          )}
        </div>
        <button
          onClick={addCustom}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 border bg-white text-slate-900 hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          질문 추가
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 hover:bg-slate-50"
          >
            이전
          </button>
          <button
            onClick={onFirst}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 bg-white text-slate-900 hover:bg-slate-50"
            title="1단계로 이동"
          >
            <Home className="h-4 w-4" />
            처음으로 돌아가기
          </button>
        </div>
        <button
          onClick={onNext}
          disabled={!allDone}
          className={classNames(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 border",
            allDone
              ? "bg-white text-slate-900 hover:bg-slate-50"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          )}
        >
          다음 <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function SectionsStep({ sections, setSection, onNext, onPrev, onFirst }) {
  const order = [
    "role",
    "goal",
    "environment",
    "inputs",
    "outputs",
    "constraints",
    "exceptions",
    "validation",
    "examples",
  ];
  return (
    <section className="bg-white rounded-2xl border p-4 md:p-6 space-y-4">
      <h2 className="text-xl font-semibold">
        3) 섹션별 구성 (각 섹션은 독립 채팅처럼 간단히 조정)
      </h2>
      <div className="space-y-4">
        {order.map((id) => (
          <div key={id} className="rounded-xl border">
            <details>
              <summary className="cursor-pointer px-4 py-3 font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" /> {sectionTitles[id]}
              </summary>
              <div className="p-4 space-y-2">
                <textarea
                  className="w-full min-h-[100px] rounded-xl border p-3"
                  value={sections[id]}
                  onChange={(e) => setSection(id, e.target.value)}
                />
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Edit3 className="h-3.5 w-3.5" />
                  섹션 톤/길이/예시를 자유롭게 수정하세요.
                </div>
              </div>
            </details>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 hover:bg-slate-50"
          >
            이전
          </button>
          <button
            onClick={onFirst}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 bg-white text-slate-900 hover:bg-slate-50"
          >
            <Home className="h-4 w-4" />
            처음으로 돌아가기
          </button>
        </div>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 border bg-white text-slate-900 hover:bg-slate-50"
        >
          다음 <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function BuildReviewStep({ promptText, quality, onNext, onPrev, onFirst }) {
  const level = quality >= 90 ? "A" : quality >= 75 ? "B" : quality >= 60 ? "C" : "D";
  const warnings = [];
  if (quality < 90) warnings.push("출력 포맷과 검증 단계를 더 구체화하면 점수가 상승합니다.");

  return (
    <section className="bg-white rounded-2xl border p-4 md:p-6 space-y-4">
      <h2 className="text-xl font-semibold">4) 프롬프트 조립 & 리뷰</h2>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          <textarea
            className="w-full min-h-[360px] rounded-xl border p-3 font-mono text-sm"
            value={promptText}
            readOnly
          />
        </div>
        <div className="lg:col-span-4 space-y-3">
          <div className="rounded-xl border p-4">
            <div className="text-sm text-slate-500">품질 점수</div>
            <div className="text-3xl font-bold">
              {quality}
              <span className="text-base font-medium text-slate-500"> / 100</span>
              <span className="ml-2 text-slate-600">({level})</span>
            </div>
          </div>
          <div className="rounded-xl border p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="h-4 w-4" /> 개선 제안
            </div>
            {warnings.length === 0 ? (
              <div className="text-slate-500 text-sm">큰 이슈 없음. 필요 시 예시를 더 추가하세요.</div>
            ) : (
              <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            <button className="mt-2 inline-flex items-center gap-2 rounded-xl border px-3 py-2 bg-white text-slate-900 hover:bg-slate-50">
              자동 보완 실행 <Play className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 hover:bg-slate-50"
          >
            이전
          </button>
          <button
            onClick={onFirst}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 bg-white text-slate-900 hover:bg-slate-50"
          >
            <Home className="h-4 w-4" />
            처음으로 돌아가기
          </button>
        </div>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 border bg-white text-slate-900 hover:bg-slate-50"
        >
          다음 <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function ExportStep({ state, setState, promptText, onPrev, onFirst }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  return (
    <section className="bg-white rounded-2xl border p-4 md:p-6 space-y-4">
      <h2 className="text-xl font-semibold">5) 결과 내보내기</h2>
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-slate-600 text-sm">언어 선택 후 내보내기</div>
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4" />
            <select
              className="border rounded-lg px-2 py-1"
              value={state.language}
              onChange={(e) => setState((s) => ({ ...s, language: e.target.value }))}
            >
              <option value="ko">한국어</option>
              <option value="en">English</option>
              <option value="both">한국어+English</option>
            </select>
          </div>
        </div>

        <textarea
          className="w-full min-h-[260px] rounded-xl border p-3 font-mono text-sm"
          value={promptText}
          readOnly
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onPrev}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 hover:bg-slate-50"
            >
              이전
            </button>
            <button
              onClick={onFirst}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 bg-white text-slate-900 hover:bg-slate-50"
            >
              <Home className="h-4 w-4" />
              처음으로 돌아가기
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copy}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 bg-white text-slate-900 hover:bg-slate-50"
            >
              {copied ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />} 복사하기
            </button>
            <a
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(promptText)}`}
              download={`prompt_${Date.now()}.txt`}
              className="inline-flex items-center gap-2 rounded-xl border bg-white text-slate-900 px-4 py-2 hover:bg-slate-50"
            >
              다운로드
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Inspector({ state, quality, allQsAnswered }) {
  const checklist = [
    { label: "목표 입력", ok: Boolean(state.goalText.trim()) },
    { label: "요건 Q&A", ok: allQsAnswered },
    { label: "섹션 편집", ok: true },
    { label: "품질 점수 75+", ok: quality >= 75 },
  ];

  return (
    <aside className="sticky top-16 space-y-3">
      <div className="rounded-2xl border bg-white p-4">
        <div className="text-sm text-slate-500">리서치 요약</div>
        <div className="mt-1 text-sm leading-relaxed">{state.researchSummary}</div>
      </div>
      <div className="rounded-2xl border bg-white p-4">
        <div className="text-sm text-slate-500 mb-2">체크리스트</div>
        <ul className="space-y-1">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-sm">
              {c.ok ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <X className="h-4 w-4 text-rose-600" />
              )}
              <span className={c.ok ? "text-slate-700" : "text-slate-500"}>{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border bg-white p-4">
        <div className="text-sm text-slate-500">품질 점수</div>
        <div className="text-2xl font-bold">
          {quality}
          <span className="text-base font-medium text-slate-500"> / 100</span>
        </div>
      </div>
    </aside>
  );
}

const sectionTitles = {
  role: "역할 정의",
  goal: "목표/산출물",
  environment: "환경·버전",
  inputs: "입력 스펙",
  outputs: "출력 포맷",
  constraints: "제약/정책",
  exceptions: "예외 처리",
  validation: "검증/테스트",
  examples: "예시",
};
