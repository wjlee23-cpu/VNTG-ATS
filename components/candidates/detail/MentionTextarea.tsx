'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { mentionTokenForUserId } from '@/lib/mention-tokens';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export type MentionableUser = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
};

function userDisplayLabel(u: MentionableUser): string {
  const n = u.name?.trim();
  if (n) return n;
  const local = u.email.split('@')[0];
  return local || u.email;
}

function findMentionQuery(value: string, caret: number): { at: number; query: string } | null {
  if (caret <= 0) return null;
  const before = value.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0) {
    const prev = before[at - 1];
    if (prev && /\S/.test(prev) && !/[\s([{'"]/.test(prev)) return null;
  }
  const afterAt = before.slice(at + 1);
  if (/[\s\n]/.test(afterAt)) return null;
  return { at, query: afterAt };
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  users: MentionableUser[];
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
}

export function MentionTextarea({
  value,
  onChange,
  users,
  disabled,
  rows = 3,
  placeholder,
  className,
}: MentionTextareaProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [mentionAnchor, setMentionAnchor] = useState<{ at: number; query: string } | null>(null);
  const composingRef = useRef(false);

  const filtered = useMemo(() => {
    const q = (mentionAnchor?.query ?? '').trim().toLowerCase();
    if (!q) return users.slice(0, 12);
    return users
      .filter((u) => {
        const name = (u.name || '').toLowerCase();
        const email = u.email.toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 12);
  }, [users, mentionAnchor?.query]);

  const syncMentionMenu = useCallback(() => {
    const el = taRef.current;
    if (!el || disabled) {
      setMenuOpen(false);
      setMentionAnchor(null);
      return;
    }
    // ✅ 한글 IME 조합 중에는 caret/텍스트가 계속 변하면서 메뉴가 깜빡일 수 있어
    //    조합이 끝난 뒤에 한 번만 동기화합니다.
    if (composingRef.current) return;
    const caret = el.selectionStart ?? 0;
    const anchor = findMentionQuery(value, caret);
    if (anchor) {
      setMentionAnchor(anchor);
      setMenuOpen(true);
      setHighlight(0);
    } else {
      setMentionAnchor(null);
      setMenuOpen(false);
    }
  }, [value, disabled]);

  const insertMention = (u: MentionableUser) => {
    const el = taRef.current;
    if (!el || !mentionAnchor) return;
    const caret = el.selectionStart ?? value.length;
    const { at } = mentionAnchor;
    const before = value.slice(0, at);
    const after = value.slice(caret);
    const token = `${mentionTokenForUserId(u.id)} `;
    const next = `${before}${token}${after}`;
    onChange(next);
    setMenuOpen(false);
    setMentionAnchor(null);
    requestAnimationFrame(() => {
      const pos = before.length + token.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!menuOpen || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((i) => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      insertMention(filtered[highlight]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMenuOpen(false);
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        value={value}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
          requestAnimationFrame(syncMentionMenu);
        }}
        onChange={(e) => {
          onChange(e.target.value);
          requestAnimationFrame(syncMentionMenu);
        }}
        onKeyDown={onKeyDown}
        onClick={syncMentionMenu}
        onKeyUp={syncMentionMenu}
        className={cn(
          'w-full bg-neutral-50/50 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm text-neutral-800 outline-none resize-none placeholder:text-neutral-400 focus:bg-white focus:border-neutral-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        )}
      />
      {menuOpen && filtered.length > 0 ? (
        <ul
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-xl shadow-slate-900/10"
          role="listbox"
        >
          {filtered.map((u, idx) => {
            const label = userDisplayLabel(u);
            const initial = label.slice(0, 1).toUpperCase();
            const active = idx === highlight;
            return (
              <li key={u.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                    active ? 'bg-slate-100' : 'hover:bg-slate-50/80',
                  )}
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    insertMention(u);
                  }}
                  onMouseEnter={() => setHighlight(idx)}
                >
                  <Avatar className="h-8 w-8 shrink-0 border border-neutral-200">
                    <AvatarImage src={u.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="text-[10px] font-semibold">{initial}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-neutral-900">{label}</span>
                    <span className="block truncate text-xs text-neutral-500">{u.email}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function buildMentionUserMap(users: MentionableUser[]): Map<string, { displayLabel: string }> {
  const m = new Map<string, { displayLabel: string }>();
  for (const u of users) {
    m.set(u.id.toLowerCase(), { displayLabel: userDisplayLabel(u) });
  }
  return m;
}
