/**
 * @file AssistantPanel
 * @description Conversational AI assistant, docked as a right-hand side panel
 * (VS Code style) that shifts the page content rather than overlaying it. Sends
 * messages to the backend agent loop, streams the reply token-by-token over
 * WebSocket, and surfaces a confirmation gate for any write action the agent
 * proposes before it runs. Controlled by the Layout header toggle; kept mounted
 * (hidden when closed) so conversation state survives open/close.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '../../context/WebSocketContext';
import { useCurrentBusiness } from '../../hooks/useCurrentBusiness';
import {
  useSendAssistantMessageMutation,
  useConfirmAssistantActionMutation,
} from '../../api/assistantApi';
import { getErrorMessage } from '../../api/baseApi';
import type {
  AssistantProposedAction,
  AssistantDeltaEvent,
  AssistantToolEvent,
  AssistantErrorEvent,
  AssistantRunResult,
} from '../../types';
import styles from './AssistantPanel.module.css';

interface UIMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantPanelProps {
  open: boolean;
  onClose: () => void;
}

const SUGGESTIONS = [
  "What's the outstanding balance for my top client?",
  'Show me all overdue bills',
  'Search inventory for scaffolding pipes',
];

export default function AssistantPanel({ open, onClose }: AssistantPanelProps) {
  const { currentBusinessId } = useCurrentBusiness();
  const { socket } = useSocket();
  const [sendMessage] = useSendAssistantMessageMutation();
  const [confirmAction] = useConfirmAssistantActionMutation();

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState('');
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<AssistantProposedAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversationId = useRef<string | undefined>(undefined);
  const busyRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  useEffect(scrollToBottom, [messages, streaming, pending, scrollToBottom]);

  // --- WebSocket streaming subscription ---
  useEffect(() => {
    if (!socket) return;
    const onDelta = (e: AssistantDeltaEvent) => {
      if (!busyRef.current) return;
      setStreaming((prev) => prev + e.text);
    };
    const onTool = (e: AssistantToolEvent) => {
      if (!busyRef.current) return;
      setToolStatus(e.status === 'running' ? `Using ${e.name.replace(/_/g, ' ')}…` : null);
    };
    const onError = (e: AssistantErrorEvent) => {
      if (!busyRef.current) return;
      setError(e.error);
    };
    socket.on('assistant:delta', onDelta);
    socket.on('assistant:tool', onTool);
    socket.on('assistant:error', onError);
    return () => {
      socket.off('assistant:delta', onDelta);
      socket.off('assistant:tool', onTool);
      socket.off('assistant:error', onError);
    };
  }, [socket]);

  const setBusyState = (v: boolean) => {
    busyRef.current = v;
    setBusy(v);
    if (v) {
      setStreaming('');
      setToolStatus(null);
      setError(null);
    } else {
      setToolStatus(null);
    }
  };

  /** Apply the HTTP result of a chat/confirm turn. */
  const applyResult = (result: AssistantRunResult) => {
    conversationId.current = result.conversationId;
    if (result.status === 'completed') {
      setMessages((m) => [...m, { role: 'assistant', content: result.message }]);
      setPending(null);
    } else if (result.status === 'awaiting_confirmation') {
      setPending(result.action);
    } else {
      setError(result.error);
    }
    setStreaming('');
  };

  const send = async (text: string) => {
    if (!text.trim() || !currentBusinessId || busy) return;
    setMessages((m) => [...m, { role: 'user', content: text.trim() }]);
    setInput('');
    setPending(null);
    setBusyState(true);
    try {
      const result = await sendMessage({
        businessId: currentBusinessId,
        message: text.trim(),
        conversationId: conversationId.current,
      }).unwrap();
      applyResult(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyState(false);
    }
  };

  const respondToAction = async (approve: boolean) => {
    if (!currentBusinessId || !conversationId.current || busy) return;
    setPending(null);
    setBusyState(true);
    try {
      const result = await confirmAction({
        businessId: currentBusinessId,
        conversationId: conversationId.current,
        approve,
      }).unwrap();
      applyResult(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyState(false);
    }
  };

  const newConversation = () => {
    conversationId.current = undefined;
    setMessages([]);
    setStreaming('');
    setPending(null);
    setError(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const isEmpty = messages.length === 0 && !streaming;

  return (
    <aside className={`${styles.panel} ${open ? '' : styles.closed}`} aria-hidden={!open} aria-label="AI assistant">
      <header className={styles.header}>
        <span className={styles.title}>✦ ASSISTANT</span>
        <div className={styles.headerActions}>
          <button type="button" className={styles.headerBtn} onClick={newConversation} title="New conversation">
            NEW
          </button>
          <button type="button" className={styles.headerBtn} onClick={onClose} aria-label="Close assistant" title="Close">
            ✕
          </button>
        </div>
      </header>

      <div className={styles.messages} ref={scrollRef}>
        {isEmpty && (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Ask about your business, or request an action.</p>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className={styles.suggestion} onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`${styles.message} ${m.role === 'user' ? styles.user : styles.assistant}`}
          >
            {m.content}
          </div>
        ))}

        {busy && streaming && (
          <div className={`${styles.message} ${styles.assistant}`}>
            {streaming}
            <span className={styles.caret} />
          </div>
        )}

        {busy && !streaming && <div className={styles.status}>{toolStatus || 'Thinking…'}</div>}

        {pending && (
          <div className={styles.confirm}>
            <p className={styles.confirmTitle}>CONFIRM ACTION</p>
            <p className={styles.confirmSummary}>{pending.summary}</p>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.approve} onClick={() => respondToAction(true)}>
                Confirm
              </button>
              <button type="button" className={styles.decline} onClick={() => respondToAction(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}
      </div>

      <form className={styles.inputRow} onSubmit={onSubmit}>
        <input
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={pending ? 'Confirm or cancel above…' : 'Ask anything…'}
          disabled={busy || !!pending}
        />
        <button type="submit" className={styles.sendBtn} disabled={busy || !!pending || !input.trim()}>
          Send
        </button>
      </form>
    </aside>
  );
}
