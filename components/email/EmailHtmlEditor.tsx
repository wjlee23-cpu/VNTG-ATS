'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Code2,
  Columns3,
  Eye,
  Grid2X2,
  Link2,
  List,
  ListOrdered,
  Minus,
  Paintbrush,
  Rows3,
  Trash2,
  Type,
  Redo2,
  Undo2,
} from 'lucide-react';
import { Node } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import Heading from '@tiptap/extension-heading';
import Paragraph from '@tiptap/extension-paragraph';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

// TipTap 기본 TextStyle 익스텐션은 fontSize 속성을 지원하지 않습니다.
// 글자 크기 셀렉트가 실제로 HTML에 반영되려면 fontSize 속성을 추가한 확장이 필요합니다.
const FontSizeTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.fontSize || null,
        renderHTML: (attrs) => {
          if (!attrs.fontSize) return {};
          return { style: `font-size: ${attrs.fontSize}` };
        },
      },
    };
  },
});

// HTML 템플릿을 그대로 붙여넣는 경우, div/heading/paragraph에 인라인 style이 붙어있을 수 있습니다.
// TipTap 기본 노드는 style을 보존하지 않기 때문에, 이메일 템플릿 편집용으로 style 속성을 허용합니다.
const StyledHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('style') || null,
        renderHTML: (attrs) => (attrs.style ? { style: attrs.style } : {}),
      },
    };
  },
});

const StyledParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('style') || null,
        renderHTML: (attrs) => (attrs.style ? { style: attrs.style } : {}),
      },
    };
  },
});

const DivBlock = Node.create({
  name: 'divBlock',
  group: 'block',
  content: 'block*',
  defining: true,
  addAttributes() {
    return {
      style: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('style') || null,
        renderHTML: (attrs) => (attrs.style ? { style: attrs.style } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', HTMLAttributes, 0];
  },
});

function normalizeHtmlForEditor(raw: string) {
  const v = raw ?? '';
  const trimmed = v.trim();
  if (!trimmed) return '';

  // 전체 HTML 문서 형태면 body 내부만 추출합니다.
  const bodyMatch = trimmed.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) return bodyMatch[1].trim();

  // 혹시 head가 남아 있다면 제거합니다.
  const withoutHead = trimmed.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, '');
  // doctype/html/body 태그를 제거해 “편집 가능한 조각”으로 만듭니다.
  return withoutHead
    .replace(/<!doctype[\s\S]*?>/gi, '')
    .replace(/<\/?html\b[^>]*>/gi, '')
    .replace(/<\/?body\b[^>]*>/gi, '')
    .trim();
}

export type EmailHtmlEditorHandle = {
  insertTokenAtCursor: (token: string) => void;
};

type EmailHtmlEditorProps = {
  /** 항상 HTML 문자열로 관리합니다. */
  value: string;
  onChange: (nextHtml: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minEditorHeightPx?: number;
  /**
   * Editor/HTML 모드 전환(탭)을 노출할지 여부입니다.
   * - 기본값: `chromeLess`가 false면 true, `chromeLess`가 true면 false
   */
  showModeTabs?: boolean;
  /**
   * Editor 모드 툴바(굵게/기울임/링크/목록/표 등)를 노출할지 여부입니다.
   * - 기본값: `chromeLess`가 false면 true, `chromeLess`가 true면 false
   */
  showToolbar?: boolean;
  /**
   * 하단 도움말 문구(주의/설명)를 노출할지 여부입니다.
   * - 기본값: `chromeLess`가 false면 true, `chromeLess`가 true면 false
   */
  showHelperText?: boolean;
  /**
   * 상단 탭/툴바/도움말을 숨기고 “본문 작성 영역”만 보여주는 모드입니다.
   * - 기존 사용처 영향 방지를 위해 기본값은 false입니다.
   * - 외부 컨테이너(모달)에서 하단 얇은 바/액션을 구성할 때 사용합니다.
   */
  chromeLess?: boolean;
  className?: string;
};

function safeString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

export const EmailHtmlEditor = forwardRef<EmailHtmlEditorHandle, EmailHtmlEditorProps>(function EmailHtmlEditor(
  {
    value,
    onChange,
    disabled = false,
    placeholder = '메일 본문을 작성하세요…',
    minEditorHeightPx = 220,
    showModeTabs,
    showToolbar,
    showHelperText,
    chromeLess = false,
    className,
  },
  ref
) {
  const htmlValue = safeString(value);
  const normalizedHtmlForEditor = useMemo(() => normalizeHtmlForEditor(htmlValue), [htmlValue]);
  const [activeTab, setActiveTab] = useState<'editor' | 'html'>('editor');
  const [fontSize, setFontSize] = useState<string>('14px');
  const [fontFamily, setFontFamily] = useState<string>('inherit');
  const [textColor, setTextColor] = useState<string>('#171717');
  // 표 안에 커서가 있는지 여부 — true일 때만 표 편집 컨트롤이 노출됩니다.
  const [isTableActive, setIsTableActive] = useState<boolean>(false);
  const lastHtmlRef = useRef<string>(htmlValue);
  const htmlTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // chromeLess는 “전부 숨김” 레거시 옵션이므로, 새 옵션을 명시하지 않은 경우에만 기본값을 보정합니다.
  const isModeTabsVisible = showModeTabs ?? !chromeLess;
  const isToolbarVisible = showToolbar ?? !chromeLess;
  const isHelperTextVisible = showHelperText ?? !chromeLess;

  const editor = useEditor({
    // TipTap은 Next.js에서 SSR/hydration 환경을 감지하면 경고/에러를 띄울 수 있습니다.
    // 즉시 렌더링을 끄면(클라이언트에서 마운트된 뒤 렌더) 하이드레이션 불일치를 피할 수 있습니다.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // 기본 heading/paragraph 대신 style 보존 버전을 사용합니다.
        heading: false,
        paragraph: false,
      }),
      DivBlock,
      StyledHeading.configure({ levels: [1, 2, 3, 4] }),
      StyledParagraph,
      FontSizeTextStyle,
      Color,
      FontFamily,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ['http', 'https', 'mailto'],
      }),
      TextAlign.configure({
        types: ['paragraph'],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: normalizedHtmlForEditor || '',
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const next = editor.getHTML();
      lastHtmlRef.current = next;
      onChange(next);
      setIsTableActive(editor.isActive('table'));
    },
    onSelectionUpdate: ({ editor }) => {
      // 커서가 표 안/밖으로 이동할 때마다 상태를 갱신해 표 편집 툴바를 토글합니다.
      setIsTableActive(editor.isActive('table'));
    },
    editorProps: {
      attributes: {
        class:
          'email-editor-content min-h-[220px] outline-none whitespace-pre-wrap leading-relaxed text-sm text-neutral-800',
        'data-placeholder': placeholder,
      },
    },
  });

  // 외부에서 value가 바뀌면(템플릿 적용 등) 에디터 내용도 동기화합니다.
  useEffect(() => {
    if (!editor) return;
    if (activeTab !== 'editor') return;

    if (normalizedHtmlForEditor === lastHtmlRef.current) return;

    // TipTap v2 타입에서는 2번째 인자가 옵션 객체입니다.
    editor.commands.setContent(normalizedHtmlForEditor || '', { emitUpdate: false });
    lastHtmlRef.current = normalizedHtmlForEditor;
  }, [editor, normalizedHtmlForEditor, activeTab]);

  const insertTokenAtCursor = (token: string) => {
    if (!token) return;

    if (activeTab === 'html') {
      const el = htmlTextareaRef.current;
      const current = htmlValue || '';
      if (!el) {
        onChange(`${current}${token}`);
        return;
      }

      const start = el.selectionStart ?? current.length;
      const end = el.selectionEnd ?? current.length;
      const next = current.slice(0, start) + token + current.slice(end);
      onChange(next);

      requestAnimationFrame(() => {
        try {
          el.focus();
          const cursor = start + token.length;
          el.setSelectionRange(cursor, cursor);
        } catch {
          /* ignore */
        }
      });
      return;
    }

    if (!editor) return;
    editor.chain().focus().insertContent(token).run();
  };

  // 부모(Templates)에서 토큰 삽입을 호출할 수 있도록 ref를 노출합니다.
  // - HTML 탭: textarea selection 기준 삽입
  // - Editor 탭: TipTap 커서 위치에 삽입
  useImperativeHandle(ref, () => ({ insertTokenAtCursor }), [insertTokenAtCursor]);

  const toolbar = useMemo(() => {
    const run = (fn: () => void) => {
      if (disabled) return;
      fn();
    };

    const btnBase =
      'inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60';

    const iconBtn =
      'inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white p-2 text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60';

    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={iconBtn}
            onClick={() => run(() => editor?.chain().focus().undo().run())}
            disabled={disabled || !editor?.can().undo()}
            aria-label="되돌리기"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={iconBtn}
            onClick={() => run(() => editor?.chain().focus().redo().run())}
            disabled={disabled || !editor?.can().redo()}
            aria-label="다시 실행"
          >
            <Redo2 className="h-4 w-4" />
          </button>

          <div className="mx-1 h-5 w-px bg-neutral-200" />

          <button
            type="button"
            className={btnBase}
            onClick={() => run(() => editor?.chain().focus().toggleBold().run())}
            disabled={disabled}
            aria-pressed={!!editor?.isActive('bold')}
          >
            <span className="font-black">B</span>
          </button>
          <button
            type="button"
            className={btnBase}
            onClick={() => run(() => editor?.chain().focus().toggleItalic().run())}
            disabled={disabled}
            aria-pressed={!!editor?.isActive('italic')}
          >
            <span className="italic font-semibold">I</span>
          </button>
          <button
            type="button"
            className={btnBase}
            onClick={() => run(() => editor?.chain().focus().toggleUnderline().run())}
            disabled={disabled}
            aria-pressed={!!editor?.isActive('underline')}
          >
            <span className="underline font-semibold">U</span>
          </button>

          <div className="mx-1 h-5 w-px bg-neutral-200" />

          <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-2 py-1.5 shadow-sm">
            <Type className="h-4 w-4 text-neutral-500" />
            <select
              className="bg-transparent text-xs font-semibold text-neutral-700 outline-none"
              value={fontSize}
              onChange={(e) => {
                const next = e.target.value;
                setFontSize(next);
                run(() => editor?.chain().focus().setMark('textStyle', { fontSize: next }).run());
              }}
              disabled={disabled}
              aria-label="폰트 크기"
            >
              {['12px', '14px', '16px', '18px', '20px', '24px', '28px'].map((v) => (
                <option key={v} value={v}>
                  {v.replace('px', '')}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-2 py-1.5 shadow-sm">
            <Paintbrush className="h-4 w-4 text-neutral-500" />
            <input
              type="color"
              value={textColor}
              onChange={(e) => {
                const next = e.target.value;
                setTextColor(next);
                run(() => editor?.chain().focus().setColor(next).run());
              }}
              disabled={disabled}
              aria-label="글자 색"
              className="h-6 w-7 cursor-pointer rounded border border-neutral-200 bg-white p-0"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-2 py-1.5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              Font
            </span>
            <select
              className="bg-transparent text-xs font-semibold text-neutral-700 outline-none"
              value={fontFamily}
              onChange={(e) => {
                const next = e.target.value;
                setFontFamily(next);
                run(() => editor?.chain().focus().setFontFamily(next === 'inherit' ? '' : next).run());
              }}
              disabled={disabled}
              aria-label="폰트"
            >
              <option value="inherit">기본</option>
              <option value="Inter, Arial, sans-serif">Inter</option>
              <option value="Arial, sans-serif">Arial</option>
              <option value="'Malgun Gothic', Arial, sans-serif">맑은 고딕</option>
            </select>
          </div>

          <button
            type="button"
            className={btnBase}
            onClick={() => run(() => editor?.chain().focus().toggleBulletList().run())}
            disabled={disabled}
            aria-label="글머리"
          >
            <List className="h-4 w-4" />
            글머리
          </button>
          <button
            type="button"
            className={btnBase}
            onClick={() => run(() => editor?.chain().focus().toggleOrderedList().run())}
            disabled={disabled}
            aria-label="번호 목록"
          >
            <ListOrdered className="h-4 w-4" />
            번호
          </button>
          <button
            type="button"
            className={btnBase}
            onClick={() => run(() => editor?.chain().focus().setHorizontalRule().run())}
            disabled={disabled}
            aria-label="구분선"
          >
            <Minus className="h-4 w-4" />
            구분선
          </button>

          <button
            type="button"
            className={btnBase}
            onClick={() =>
              run(() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())
            }
            disabled={disabled}
            aria-label="테이블 삽입"
          >
            <Grid2X2 className="h-4 w-4" />
            테이블
          </button>

          {/* 표 안에 커서가 있을 때만 행/열 추가·삭제 컨트롤이 활성화됩니다. */}
          {isTableActive ? (
            <div className="flex items-center gap-1 rounded-xl border border-dashed border-neutral-300 bg-white px-1.5 py-1 shadow-sm">
              <span className="px-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                표
              </span>
              <button
                type="button"
                className={iconBtn}
                onClick={() => run(() => editor?.chain().focus().addRowBefore().run())}
                disabled={disabled}
                aria-label="행 위에 추가"
                title="행 위에 추가"
              >
                <Rows3 className="h-4 w-4 -scale-y-100" />
              </button>
              <button
                type="button"
                className={iconBtn}
                onClick={() => run(() => editor?.chain().focus().addRowAfter().run())}
                disabled={disabled}
                aria-label="행 아래에 추가"
                title="행 아래에 추가"
              >
                <Rows3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={iconBtn}
                onClick={() => run(() => editor?.chain().focus().addColumnBefore().run())}
                disabled={disabled}
                aria-label="열 왼쪽에 추가"
                title="열 왼쪽에 추가"
              >
                <Columns3 className="h-4 w-4 -scale-x-100" />
              </button>
              <button
                type="button"
                className={iconBtn}
                onClick={() => run(() => editor?.chain().focus().addColumnAfter().run())}
                disabled={disabled}
                aria-label="열 오른쪽에 추가"
                title="열 오른쪽에 추가"
              >
                <Columns3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={iconBtn}
                onClick={() => run(() => editor?.chain().focus().deleteRow().run())}
                disabled={disabled}
                aria-label="행 삭제"
                title="행 삭제"
              >
                <Rows3 className="h-4 w-4 text-red-500" />
                <span className="sr-only">행 삭제</span>
              </button>
              <button
                type="button"
                className={iconBtn}
                onClick={() => run(() => editor?.chain().focus().deleteColumn().run())}
                disabled={disabled}
                aria-label="열 삭제"
                title="열 삭제"
              >
                <Columns3 className="h-4 w-4 text-red-500" />
                <span className="sr-only">열 삭제</span>
              </button>
              <button
                type="button"
                className={iconBtn}
                onClick={() => run(() => editor?.chain().focus().deleteTable().run())}
                disabled={disabled}
                aria-label="표 삭제"
                title="표 전체 삭제"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className={btnBase}
            onClick={() => {
              if (disabled) return;
              const prev = editor?.getAttributes('link')?.href || '';
              const next = window.prompt('링크(URL)를 입력하세요', prev);
              if (next === null) return;
              const url = next.trim();
              if (!url) {
                editor?.chain().focus().unsetLink().run();
                return;
              }
              editor?.chain().focus().setLink({ href: url }).run();
            }}
            disabled={disabled}
            aria-label="링크"
          >
            <Link2 className="h-4 w-4" />
            링크
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-50/60 p-1">
            <span className="px-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              탭
            </span>
          </div>
        </div>
      </div>
    );
  }, [disabled, editor, fontFamily, fontSize, textColor, isTableActive]);

  return (
    <div className={className}>
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const nextTab = (v === 'html' ? 'html' : 'editor') as 'editor' | 'html';
          setActiveTab(nextTab);

          // HTML 탭 → Editor 탭으로 돌아올 때, HTML 내용을 에디터로 반영합니다.
          if (nextTab === 'editor' && editor) {
            const normalized = normalizeHtmlForEditor(htmlValue || '');
            editor.commands.setContent(normalized || '', { emitUpdate: false });
            lastHtmlRef.current = normalized;
            // HTML 문서 형태가 들어왔다면, 상태도 body 조각으로 정리해 둡니다.
            if (normalized && normalized !== htmlValue) {
              onChange(normalized);
            }
          }
        }}
        className="gap-3"
      >
        {isModeTabsVisible ? (
          <div className="flex items-center justify-between gap-3">
            <TabsList className="h-9 rounded-xl border border-neutral-200 bg-neutral-100/70">
              <TabsTrigger value="editor" className="text-sm">
                <Eye className="h-4 w-4" />
                Editor
              </TabsTrigger>
              <TabsTrigger value="html" className="text-sm">
                <Code2 className="h-4 w-4" />
                HTML
              </TabsTrigger>
            </TabsList>
            <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              저장 포맷: HTML
            </div>
          </div>
        ) : null}

        <TabsContent value="editor" className={chromeLess ? 'space-y-0' : 'space-y-3'}>
          {isToolbarVisible ? toolbar : null}
          <div
            className={chromeLess ? 'bg-transparent' : 'rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm'}
            style={{ minHeight: minEditorHeightPx }}
          >
            <EditorContent editor={editor} />
          </div>
          {isHelperTextVisible ? (
            <p className="text-[11px] font-medium text-neutral-400">
              이메일 클라이언트는 일부 스타일/태그를 제거할 수 있어요. 최종 화면은 ‘미리보기’에서 확인하세요.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="html" className={chromeLess ? 'space-y-0' : 'space-y-3'}>
          <Textarea
            value={htmlValue}
            onChange={(e) => {
              const next = e.target.value;
              lastHtmlRef.current = next;
              onChange(next);
            }}
            disabled={disabled}
            ref={(node) => {
              htmlTextareaRef.current = node;
            }}
            className={
              chromeLess
                ? 'min-h-[260px] rounded-xl border-neutral-200 bg-transparent font-mono text-xs leading-relaxed text-neutral-800'
                : 'min-h-[260px] rounded-xl border-neutral-200 bg-white font-mono text-xs leading-relaxed text-neutral-800 shadow-sm'
            }
            placeholder="<p>안녕하세요…</p>"
          />
          {isHelperTextVisible ? (
            <p className="text-[11px] font-medium text-neutral-400">
              HTML 탭에서 수정한 내용은 Editor 탭으로 돌아가면 자동 반영됩니다.
            </p>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
});

