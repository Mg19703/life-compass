import { useEffect, useRef, useState } from 'react';
import type { TabProps } from '../types';
import { buildCoachContext, COACH_SETUP_INCOMPLETE } from '../coach/coachContext';
import { callCoach } from '../coach/callCoach';

// ─── Disclosure modal (Hard Gate: product-counsel) ────────────────────────────
// Shown once before any data is sent to Anthropic's API.

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

interface Message {
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
}

// ─── STORY-021: Coach Tab ─────────────────────────────────────────────────────

export function CoachTab({ state }: TabProps) {
  // One-time disclosure before any API call
  const [disclosed, setDisclosed] = useState(
    () => localStorage.getItem(DISCLOSURE_KEY) === 'true'
  );

  const handleAccept = () => {
    localStorage.setItem(DISCLOSURE_KEY, 'true');
    setDisclosed(true);
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Guard checks
  const hasApiKey    = Boolean(state.apiKey);
  const context      = buildCoachContext(state);
  const setupDone    = context !== COACH_SETUP_INCOMPLETE;
  const canSend      = hasApiKey && setupDone && !loading && input.trim().length > 0;

  const handleSend = async () => {
    if (!canSend) return;
    const text = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);

    const response = await callCoach(text, state);
    setMessages(prev => [...prev, { role: 'assistant', text: response.text, error: response.error }]);
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Shift+Enter inserts a newline (default textarea behaviour)
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {!disclosed && <DisclosureModal onAccept={handleAccept} />}

      {/* Guard banners — shown when prerequisites are missing */}
      {!hasApiKey && (
        <div style={{ padding: '10px 14px', background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
          Add your Claude API key in <strong>Setup</strong> to enable the Coach.
        </div>
      )}
      {hasApiKey && !setupDone && (
        <div style={{ padding: '10px 14px', background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
          Complete your profile and goals in <strong>Setup</strong> before using the Coach.
        </div>
      )}

      {/* Message thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, padding: '40px 16px' }}>
            Try: "What should my 3 MITs be this week?"
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            padding: '4px 16px',
          }}>
            <div style={{
              maxWidth: '72%',
              padding: '10px 14px',
              borderRadius: 6,
              fontSize: 13,
              lineHeight: 1.65,
              background: msg.role === 'user'
                ? 'color-mix(in srgb, var(--color-accent) 15%, var(--color-surface))'
                : 'var(--color-surface)',
              color: msg.error ? 'var(--color-danger)' : 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ padding: '4px 16px' }}>
            <div style={{
              display: 'inline-block',
              padding: '10px 14px',
              borderRadius: 6,
              fontSize: 13,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
              fontStyle: 'italic',
            }}>
              Thinking…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{
        borderTop: '1px solid var(--color-border)',
        padding: '12px 16px',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={inputRef}
            className="input-base"
            rows={2}
            maxLength={500}
            placeholder={!hasApiKey ? 'Add API key in Setup first' : !setupDone ? 'Complete Setup first' : 'Ask the Coach…'}
            value={input}
            disabled={!hasApiKey || !setupDone || loading}
            style={{ resize: 'none', paddingBottom: 18 }}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span style={{
            position: 'absolute', bottom: 4, right: 8,
            fontSize: 10, color: 'var(--color-text-muted)',
            pointerEvents: 'none',
          }}>
            {input.length}/500
          </span>
        </div>

        <button
          className="btn-primary"
          style={{ flexShrink: 0, height: 36 }}
          disabled={!canSend}
          onClick={handleSend}
        >
          {loading ? 'Thinking…' : 'Ask Coach'}
        </button>
      </div>
    </div>
  );
}
