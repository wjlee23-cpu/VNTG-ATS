# VNTG Design System 2.0 (Ultra-Modern SaaS)

## 1. Core Philosophy (핵심 철학)

VNTG 디자인 시스템은 **'압도적인 깔끔함'**과 **'전문가용 도구(Pro-tool)로서의 신뢰감'**을 목표로 합니다.

- **Color Diet:** 불필요한 브랜드 컬러와 파스텔 톤을 제거하고, 흑백(Black & White)의 대비로 정보의 위계를 잡습니다.
- **Content is UI:** 선(Border)과 박스(Box) 안에 컨텐츠를 가두지 않고, 여백(Spacing)과 타이포그래피 자체가 UI를 구분하는 기준이 됩니다.
- **AI-Native:** AI가 개입하는 요소는 일반 UI와 명확히 구분되는 섬세한 스타일링(Gradients, Sparkles)을 적용합니다.

---

## 2. Brand Colors (색상 시스템)

색상은 극도로 절제하며, Tailwind CSS의 `Neutral` 팔레트를 기본으로 사용합니다. (`Slate`나 `Gray` 대신 약간의 따뜻함이 도는 `Neutral`을 권장합니다.)

### Base & Surfaces

- **Background**: `#F7F7F8` (앱 전체의 배경색. 하얀색 모달/카드를 돋보이게 함)
- **Surface**: `#FFFFFF` (카드, 모달, 폼 등 컨텐츠가 올라가는 메인 바탕)
- **Subtle Surface**: `#FCFCFC` (사이드바, 비활성 폼 배경 등 미세한 구분용)

### Typography & Actions (Neutral Scale)

- **Primary Action / Title**: `text-neutral-900` (`#171717`) - 가장 강조되는 제목, 블랙 버튼
- **Secondary Text**: `text-neutral-600` (`#525252`) - 일반 본문
- **Tertiary/Muted Text**: `text-neutral-400` (`#a3a3a3`) - 부가 설명, 비활성 아이콘
- **Borders**: `border-neutral-200` (`#e5e5e5`) 또는 `100` (`#f5f5f5`) - 극도로 얇고 연한 구분선

### Semantic Colors (상태 컬러)

전체 면적을 덮지 않고, **점(Dot), 아이콘, 옅은 배경의 뱃지** 등 최소한의 면적에만 사용합니다.

- **Success (합격/여유)**: Emerald (`text-emerald-600`, `bg-emerald-50`)
- **Warning (보류/바쁨)**: Amber (`text-amber-600`, `bg-amber-50`)
- **Danger (거절/위험)**: Red (`text-red-600`, `bg-red-50`)
- **AI & Copilot**: Indigo & Blue (`text-indigo-600`, `bg-gradient-to-r from-indigo-500 to-blue-500`)

---

## 3. Typography (타이포그래피)

`Inter` 폰트를 사용하며, 크기와 굵기(Weight)의 대비를 확실하게 줍니다.

- **Title (대제목)**: `text-lg` or `text-xl`, `font-semibold`, `tracking-tight` (자간을 좁혀 밀도 있게)
- **Body (본문)**: `text-sm`, `font-medium` or `font-normal`, `leading-relaxed` (행간을 넓혀 가독성 확보)
- **Micro / Label**: `text-xs` or `text-[10px]`, `uppercase`, `tracking-wider`, `font-bold` (카테고리, 상태 뱃지 등 작은 요소는 대문자와 넓은 자간으로 엣지 있게 표현)

---

## 4. UI Components

### 4.1 Buttons

- **Primary**: Solid Black (`bg-neutral-900 text-white rounded-lg hover:bg-neutral-800`). 클릭 시 살짝 작아지는 액션(`active:scale-[0.98]`) 필수.
- **Secondary / Ghost**: 투명 배경에 호버 시 옅은 회색 (`hover:bg-neutral-100 text-neutral-600 rounded-lg`).
- **Segmented Control (토글 탭)**: 옅은 회색 배경(`bg-neutral-100/80 p-1 rounded-lg`) 안에 버튼들을 배치하고, 활성화된 버튼만 하얀 배경과 텍스트 강조(`bg-white text-neutral-900 shadow-sm`).

### 4.2 Forms & Settings Layout (Split View)

기존의 '카드(Box) 안에 폼 넣기' 방식을 엄격히 금지합니다.

- **Label-Input 1:1 구조**: 좌측에는 레이블과 설명(`w-[200px]`), 우측에는 입력 폼(`1fr`)을 배치하는 그리드(`grid-cols-[200px_1fr]`)를 기본으로 합니다.
- **항목 구분**: 항목 사이는 닫힌 네모 박스가 아니라, 하단 구분선(`border-b border-neutral-100`)과 넉넉한 상하 여백(`py-6`)으로만 나눕니다.
- **Inputs**: 폼 필드의 배경은 완전한 흰색보다 살짝 톤다운된 `#FCFCFC`를 사용하여 배경(`white`)과 미세하게 구분되도록 합니다. 포커스 시 브랜드 컬러 대신 검은색 링(`focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900`)을 사용합니다.

### 4.3 Chips & Badges

- 테두리가 강한 뱃지 대신, **배경이 아주 옅고 글자색이 진한(Soft Badge)** 스타일을 기본으로 합니다.
- 예: `bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-medium`
- 인물/참석자 칩: 작은 원형 아바타와 이름, 직책, (필요시) 삭제 X 버튼을 하나의 알약(Pill) 형태로 묶습니다.

---

## 5. Elevation & Shadows (깊이감)

투박한 `shadow-md` 사용을 지양하고, 다중 그림자(Layered shadow)로 극도의 부드러움을 연출합니다.

- **Main Container (모달/앱 메인)**: `shadow-[0_24px_60px_-15px_rgba(0,0,0,0.05)]` (아주 넓고 투명하게 퍼지는 그림자)
- **Floating Action Bar (하단 고정 바)**: `bg-white/90 backdrop-blur-md border-t border-neutral-100` (반투명 블러 효과로 떠있는 느낌)
- **Card Hover**: 카드를 호버할 때 선이 진해지거나 그림자가 진해지는 것보다, 요소가 미세하게 위로 떠오르는 트랜지션(`hover:-translate-y-[1px] transition-all duration-200`)을 적극 활용합니다.

---

## 6. AI & Copilot UI Pattern

Gemini 등 AI가 개입하는 요소는 일반 UI와 차별화된 "마법 같은" 느낌을 주어야 합니다.

- **Iconography**: 일반 기능 아이콘과 구분되도록 Sparkles(`✨`), Bot(`🤖`) 아이콘을 사용합니다.
- **Text & Gradients**: AI가 제안하거나 요약한 핵심 텍스트/영역은 은은한 보라-파랑 그라데이션(`bg-gradient-to-r from-indigo-500 to-blue-500`)을 1px 라인이나 텍스트 컬러로 활용합니다.
- **Proactive Alerts**: AI가 문제를 감지했을 때(예: 면접관 바쁨), 경고 텍스트만 띄우는 것이 아니라 **해결 가능한 Action 버튼(예: 대체 면접관 적용)을 함께 제공**하는 것을 원칙으로 합니다.

---

## 7. 다크모드 (Dark Mode)

다크모드도 동일한 철학을 따릅니다. Neutral 팔레트의 다크 톤을 사용하며, 과한 컬러 틴트를 피합니다.

- **Background**: Neutral 다크 계열 (예: `#0a0a0a` 또는 `#171717`)
- **Surface**: 약간 밝은 Neutral (`#1a1a1a`)
- **Text**: `text-neutral-100` (제목), `text-neutral-400` (본문), `text-neutral-500` (Muted)
- **Borders**: `border-neutral-800` (구분선은 여전히 얇고 연하게)
- **포커스 링**: 라이트와 동일하게 `ring-neutral-100` (다크 배경에서 대비 확보)

---

## 8. 마이그레이션 가이드 (기존 코드에서 전환 시)

### 제거해야 할 패턴

- ❌ `bg-primary`, `text-primary`, `border-primary` (브랜드 블루)
- ❌ `bg-gradient-to-r from-brand-dark to-brand-main` (일반 UI용 그라데이션)
- ❌ `focus:border-brand-main`, `focus:ring-brand-main/20` (브랜드 포커스)
- ❌ 카드 안에 폼을 넣는 패턴 (`<div className="bg-white border rounded-xl p-6">` 안에 폼 필드)

### 사용해야 할 패턴

- ✅ `bg-neutral-900 text-white` (Primary 버튼)
- ✅ `hover:bg-neutral-100` (Ghost/Secondary)
- ✅ `focus:border-neutral-900 focus:ring-neutral-900` (포커스)
- ✅ Split View FormRow 패턴 (레이블 좌측, 컨트롤 우측)
- ✅ Soft Badge (`bg-emerald-50 text-emerald-700` 등)
- ✅ 레이어드 섀도우 (`shadow-[0_24px_60px_-15px_rgba(0,0,0,0.05)]`)
