import { useEffect, useRef, useState } from 'react';
import type { TabProps } from '../types';
import { buildCoachContext, COACH_SETUP_INCOMPLETE } from '../coach/coachContext';
import { callCoach } from '../coach/callCoach';
import { ProposalCard } from '../components/ProposalCard';
import type { ProposalCardSection } from '../components/ProposalCard';

function todayISO() { return new Date().toISOString().slice(0, 10); }

// ─── Disclosure modal (Hard Gate: product-counsel) ────────────────────────────

const DISCLOSURE_KEY = 'life-compass-coach-disclosed';

function DisclosureModal({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{ maxWidth: 480 }}>
        <p style={{ fontWeight: 700, marginBottom: 12, color: 'var(--color-accent)' }}>
          Before you use the Coach
        </p>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 12 }}>
          When you send a message, the Coach assembles your profile, goals, OKRs, recent MITs, and mood logs and sends them to <strong style={{ color: 'var(--color-text-primary)' }}>Anthropic's API</strong> to generate a response. This data leaves your device.
        </p>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 20 }}>
          Anthropic does not use API inputs to train their models by default. Your Life Compass data is never stored by this app on any server.
        </p>
        <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={onAccept}>
            Understood — open the Coach
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Message types ────────────────────────────────────────────────────────────

type ProposalType = 'suggest-mits' | 'weekly-review';

interface ProposalData {
  type: ProposalType;
  sections: { label: string; content: string }[];
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
  proposal?: ProposalData; // when set, renders ProposalCard instead of plain text
}

// ─── Structured action prompts ────────────────────────────────────────────────

const SUGGEST_MITS_PROMPT =
  'Based on my current weekly initiatives, habit streaks, and today\'s context, suggest exactly 3 MITs for today. ' +
  'Format your response as a numbered list with one MIT per line and a brief rationale (1 sentence) for each.';

const WEEKLY_REVIEW_PROMPT =
  'Review my week. Analyze: (1) MIT completion rate and patterns, (2) habit streak performance, ' +
  '(3) alignment between my dimension weights and actual completed MITs, (4) one key adjustment to make next week. ' +
  'Be concise — no more than 250 words total.';

const REVIEW_LABELS = ['MIT Completion', 'Habit Streaks', 'Dimension Alignment', 'Next Week Adjustment'] as const;

// ─── Parse helpers ────────────────────────────────────────────────────────────

function parseSuggestMITs(text: string): string[] | null {
  const matched = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => /^\d\.\s/.test(l))
    .map(l => l.replace(/^\d\.\s+/, '').trim());
  return matched.length >= 3 ? matched.slice(0, 3) : null;
}

function parseWeeklyReview(text: string): { label: string; content: string }[] | null {
  const sections: { label: string; content: string }[] = [];
  for (const label of REVIEW_LABELS) {
    const idx = text.search(new RegExp(label, 'i'));
    if (idx === -1) continue;
    const after = text.slice(idx + label.length).replace(/^[:\s\n]+/, '');
    const nextIdx = REVIEW_LABELS
      .filter(l => l !== label)
      .map(l => after.search(new RegExp(l, 'i')))
      .filter(i => i > 0)
      .sort((a, b) => a - b)[0] ?? after.length;
    sections.push({ label, content: after.slice(0, nextIdx).trim() });
  }
  return sections.length >= 4 ? sections : null;
}

// ─── STORY-021 + 039 + 040: Coach Tab ────────────────────────────────────────

interface CoachTabProps extends TabProps {
  navigateToSetup?: () => void;
}

export function CoachTab({ state, updateState, navigateToSetup }: CoachTabProps) {
  const [disclosed, setDisclosed] = useState(
    () => localStorage.getItem(DISCLOSURE_KEY) === 'true'
  );
  const handleAccept = () => { localStorage.setItem(DISCLOSURE_KEY, 'true'); setDisclosed(true); };

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  // Discriminated loading state — tracks which action is in flight so only
  // the triggered button shows "Thinking…". null = idle.
  const [loading, setLoading]   = useState<'chat' | 'mits' | 'review' | null>(null);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const hasApiKey = Boolean(state.apiKey);
  const context   = buildCoachContext(state);
  const setupDone = context !== COACH_SETUP_INCOMPLETE;
  const canAct    = hasApiKey && setupDone && loading === null;
  const canSend   = canAct && input.trim().length > 0;

  // ── Chat send ─────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!canSend) return;
    const text = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading('chat');
    const response = await callCoach(text, state);
    setMessages(prev => [...prev, { role: 'assistant', text: response.text, error: response.error }]);
    setLoading(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── STORY-039: Suggest MITs ───────────────────────────────────────────────

  const handleSuggestMITs = async () => {
    if (!canAct) return;
    setLoading('mits');
    const response = await callCoach(SUGGEST_MITS_PROMPT, state);
    setLoading(null);

    if (!response.error) {
      const mits = parseSuggestMITs(response.text);
      if (mits) {
        const proposal: ProposalData = {
          type: 'suggest-mits',
          sections: mits.map((content, i) => ({ label: `${i + 1}.`, content })),
        };
        // Replace prior suggest-mits card; append new one
        setMessages(prev => [
          ...prev.filter(m => m.proposal?.type !== 'suggest-mits'),
          { role: 'assistant', text: '', proposal },
        ]);
        return;
      }
    }
    // Fallback to plain bubble
    setMessages(prev => [...prev, { role: 'assistant', text: response.text, error: response.error }]);
  };

  // ── STORY-040: Weekly Review ──────────────────────────────────────────────

  const handleWeeklyReview = async () => {
    if (!canAct) return;
    setLoading('review');
    const response = await callCoach(WEEKLY_REVIEW_PROMPT, state);
    setLoading(null);

    if (!response.error) {
      const parsed = parseWeeklyReview(response.text);
      if (parsed) {
        const proposal: ProposalData = { type: 'weekly-review', sections: parsed };
        setMessages(prev => [
          ...prev.filter(m => m.proposal?.type !== 'weekly-review'),
          { role: 'assistant', text: '', proposal },
        ]);
        return;
      }
      // Fallback: render raw text + a note
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: response.text },
        { role: 'assistant', text: 'Could not format as structured review.', error: false },
      ]);
      return;
    }
    setMessages(prev => [...prev, { role: 'assistant', text: response.text, error: response.error }]);
  };

  // ── STORY-039: Add MIT from ProposalCard ──────────────────────────────────

  const handleAddMIT = (mitText: string) => {
    const today = todayISO();
    const createdCount = state.dailyMITs.filter(m => m.date === today && m.carriedOverFrom === null).length;
    if (createdCount >= 3) return;
    updateState({
      dailyMITs: [...state.dailyMITs, {
        id: crypto.randomUUID(), date: today, text: mitText,
        status: 'pending', carriedOverFrom: null, carriedForwardTo: null, initiativeId: null,
      }],
    });
  };

  // Derive "added" state from persistent AppState, not ephemeral local state.
  // This survives tab switches and prevents duplicate adds on re-entry.
  const getMITAdded = (mitText: string): boolean => {
    const today = todayISO();
    return state.dailyMITs.some(m => m.date === today && m.text === mitText && m.carriedOverFrom === null);
  };

  const todayMITCount = () =>
    state.dailyMITs.filter(m => m.date === todayISO() && m.carriedOverFrom === null).length;

  // ── Render ProposalCard sections with actions ─────────────────────────────

  const buildProposalSections = (msg: Message): ProposalCardSection[] => {
    if (!msg.proposal) return [];
    return msg.proposal.sections.map(s => {
      if (msg.proposal!.type !== 'suggest-mits') return s;
      const added = getMITAdded(s.content);
      const capReached = todayMITCount() >= 3;
      return {
        ...s,
        action: (
          <button
            className={added ? 'btn-ghost' : 'btn-primary'}
            style={added ? { fontSize: 12, padding: '2px 10px', color: 'var(--color-success)', borderColor: 'var(--color-success)' }
                         : { fontSize: 12, padding: '2px 10px' }}
            disabled={added || capReached}
            onClick={() => handleAddMIT(s.content)}
          >
            {added ? 'Added ✓' : capReached ? 'Full' : 'Add to Today'}
          </button>
        ),
      };
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {!disclosed && <DisclosureModal onAccept={handleAccept} />}

      {/* Guard banners */}
      {!hasApiKey && (
        <div style={{ padding: '10px 14px', background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)', borderLeft: '3px solid var(--color-accent)', borderBottom: '1px solid var(--color-border)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>Add your Claude API key in Setup to enable the Coach.</span>
          {navigateToSetup && <button className="btn-ghost" style={{ fontSize: 12, padding: '2px 10px', flexShrink: 0 }} onClick={navigateToSetup}>Go to Setup →</button>}
        </div>
      )}
      {hasApiKey && !setupDone && (
        <div style={{ padding: '10px 14px', background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)', borderLeft: '3px solid var(--color-danger)', borderBottom: '1px solid var(--color-border)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>Complete your profile and goals in Setup before using the Coach.</span>
          {navigateToSetup && <button className="btn-ghost" style={{ fontSize: 12, padding: '2px 10px', flexShrink: 0 }} onClick={navigateToSetup}>Go to Setup →</button>}
        </div>
      )}

      {/* Structured action buttons (STORY-039, STORY-040) */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
        <button className="btn-ghost" style={{ fontSize: 12 }}
          disabled={!canAct}
          title={!canAct ? 'Complete Setup first' : undefined}
          onClick={handleSuggestMITs}>
          {loading === 'mits' ? 'Thinking…' : 'Suggest MITs'}
        </button>
        <button className="btn-ghost" style={{ fontSize: 12 }}
          disabled={!canAct}
          title={!canAct ? 'Complete Setup first' : undefined}
          onClick={handleWeeklyReview}>
          {loading === 'review' ? 'Thinking…' : 'Weekly Review'}
        </button>
      </div>

      {/* Message thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 16px' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginBottom: 4 }}>Try asking…</p>
            {[
              'What should my MITs be tomorrow?',
              'How am I tracking against my goals?',
              'What am I avoiding right now?',
            ].map(prompt => (
              <button key={prompt}
                className="filter-chip"
                style={{ fontSize: 13 }}
                disabled={!canAct}
                onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            padding: '4px 16px',
          }}>
            {msg.proposal ? (
              <ProposalCard
                title={msg.proposal.type === 'suggest-mits' ? 'Proposed MITs' : 'Weekly Review'}
                sections={buildProposalSections(msg)}
              />
            ) : (
              <div style={{
                maxWidth: '72%', padding: '10px 14px', borderRadius: 6, fontSize: 13, lineHeight: 1.65,
                background: msg.role === 'user'
                  ? 'color-mix(in srgb, var(--color-accent) 15%, var(--color-surface))'
                  : 'var(--color-surface)',
                color: msg.error ? 'var(--color-danger)' : 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {msg.text}
              </div>
            )}
          </div>
        ))}

        {loading !== null && (
          <div style={{ padding: '4px 16px' }}>
            <div style={{ display: 'inline-block', padding: '10px 14px', borderRadius: 6, fontSize: 13, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ borderTop: '1px solid var(--color-border)', padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={inputRef}
            className="input-base"
            rows={2}
            maxLength={500}
            placeholder={!hasApiKey ? 'Add API key in Setup first' : !setupDone ? 'Complete Setup first' : 'Ask the Coach…'}
            value={input}
            disabled={!hasApiKey || !setupDone || loading !== null}
            style={{ resize: 'none', paddingBottom: 18 }}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span style={{ position: 'absolute', bottom: 4, right: 8, fontSize: 10, color: 'var(--color-text-muted)', pointerEvents: 'none' }}>
            {input.length}/500
          </span>
        </div>
        <button className="btn-primary" style={{ flexShrink: 0, height: 36 }} disabled={!canSend} onClick={handleSend}>
          {loading === 'chat' ? 'Thinking…' : 'Ask Coach'}
        </button>
      </div>
    </div>
  );
}
