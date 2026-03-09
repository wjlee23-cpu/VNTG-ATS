# VNTG Design System Documentation

## Overview

The VNTG Design System is a modern, minimal, and accessible design framework built for the VNTG hiring platform. It leverages Tailwind CSS for utility-first styling and Radix UI primitives for accessible component behavior.

## Brand Colors

The VNTG brand uses a sophisticated blue palette with a high-energy yellow accent.

### Primary Colors
- **Main Brand Color**: `#5287FF` (`--primary`, `--brand-main`)
  - Used for primary actions, active states, and key highlights.
- **Deep Blue**: `#0248FF` (`--secondary`, `--brand-dark`)
  - Used for contrast, headers, and secondary brand elements.
- **Accent Yellow**: `#FFBA22` (`--accent`, `--brand-warning`)
  - Used for notifications, warnings, and high-priority callouts.

### ATS Status Colors (Soft & Modern)
채용 단계와 상태를 부드럽고 명확하게 보여주기 위한 파스텔 톤 팔레트입니다. Badge나 Label 배경에 주로 사용합니다.
- **Success (합격/완료)**: `bg-emerald-100 text-emerald-700`
- **Processing (진행중)**: `bg-blue-100 text-blue-700`
- **Warning (보류/대기)**: `bg-amber-100 text-amber-700`
- **Danger (불합격/거절)**: `bg-rose-100 text-rose-700`
- **Neutral (기본/종료)**: `bg-slate-100 text-slate-700`

### Neutral Colors
- **Background**: `#FFFFFF` (`--background`)
- **Surface/Card**: `#FFFFFF` (`--card`)
- **Text/Foreground**: `#020817` (`--foreground`)
- **Muted Text**: `#64748B` (`--muted-foreground`)
- **Borders**: `#E2E8F0` (`--border`)

### Gradients
- **VNTG Gradient**: `linear-gradient(135deg, #0248FF 0%, #5287FF 100%)`
  - Used for primary buttons, active indicators, and Match Score progress bars.
- **Subtle Gradient**: `linear-gradient(135deg, rgba(82, 135, 255, 0.05) 0%, rgba(82, 135, 255, 0.1) 100%)`
  - Used for background accents, Table Row hover states, and active list items.

## Typography

The system uses a clean, sans-serif font stack prioritizing readability.
- **Font Family**: `Inter`, `system-ui`, `sans-serif`
- **Headings**: h1 (2xl, Medium), h2 (xl, Medium), h3 (lg, Medium)
- **Body**: Base (16px), Small (14px), Micro (12px)

## Components (ATS Specific)

### Avatars (`<Avatar />`)
후보자 리스트와 상세 페이지에 사용되는 프로필 이미지 또는 이니셜 뱃지입니다.
- **스타일**: `bg-primary/10 text-primary font-medium` 조합을 사용하여 브랜드 아이덴티티를 유지합니다.

### Data Tables & Lists
후보자 목록을 보여주는 핵심 컴포넌트입니다. 투박한 선 대신 여백과 호버 액션으로 구분합니다.
- **Row Hover Effect**: 테이블 행에 마우스를 올리면 반드시 `Subtle Gradient` 배경색이 깔리며 커서가 포인터로 변경되어야 합니다 (`hover:bg-blue-50/50 transition-colors`).
- **Borders**: 테이블 헤더와 행 사이의 구분선은 아주 옅은 색상(`border-border/50`)을 사용합니다.
- **Match Score Bar**: 단순한 단색 막대가 아니라 `bg-gradient-to-r from-brand-dark to-brand-main` 클래스를 사용하여 트렌디한 그라데이션 프로그레스 바를 구현합니다. 끝을 둥글게 처리합니다 (`rounded-full`).

### Drawers & Timelines (Side Panels)
후보자 상세 정보를 보여주는 우측 슬라이드 패널입니다.
- **Overlay Blur**: 패널이 열릴 때 뒤에 깔리는 어두운 배경은 반드시 블러 처리(`backdrop-blur-sm`)를 하여 입체감을 줍니다.
- **Timeline Nodes**: 액티비티 타임라인의 각 점은 메인 컬러를 활용해 빛나는 효과를 줍니다 (`w-2 h-2 rounded-full bg-primary ring-4 ring-primary/20`).

### Buttons (`<Button />`) & Badges (`<Badge />`)
- **Buttons**: Primary (Brand gradient or solid), Secondary (Deep blue), Outline, Ghost, Destructive.
- **Badges**: 상태 뱃지는 테두리(outline) 방식보다는, `ATS Status Colors`에 정의된 옅은 배경 + 진한 글씨 조합(Soft Badge)을 기본으로 사용하여 트렌디하게 연출합니다.

## Utilities

### Shadows & Glassmorphism
- `shadow-sm`, `shadow-md`, `shadow-lg` for elevation.
- `shadow-blue`, `shadow-blue-lg` for colored glow effects.
- **Modern Card**: `.card-modern` (Shadow, 16px border-radius, hover lift).
- **Glass Card**: `.glass-card` (Translucency + Blur `bg-white/80 backdrop-blur-md border border-white/20`).