/**
 * @file AssistantPanel
 * @description Conversational AI assistant, docked as a right-hand side panel
 * (VS Code style) that shifts the page content rather than overlaying it. Sends
 * messages to the backend agent loop, streams the reply token-by-token over
 * WebSocket, and surfaces a confirmation gate for any write action the agent
 * proposes before it runs. Controlled by the Layout header toggle; kept mounted
 * (hidden when closed) so conversation state survives open/close.
 *
 * Input modalities:
 *  - Text (typed).
 *  - Voice: record a note → Whisper transcribes it → the text drops into the box
 *    for the user to review and send (never auto-sent).
 *  - Photo: attach image(s) → sent as vision input. A challan photo can drive the
 *    extract→create-challan tools (the agent decides, user confirms the write).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '../../context/WebSocketContext';
import { useCurrentBusiness } from '../../hooks/useCurrentBusiness';
import {
  useSendAssistantMessageMutation,
  useConfirmAssistantActionMutation,
  useTranscribeAssistantAudioMutation,
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
  /** Object URLs for images the user attached to this (user) message. */
  images?: string[];
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

const MAX_IMAGES = 4;

/* Inline line-icons — monochrome, currentColor, square caps to match the terminal
   theme (no emoji). Sized 16px to sit in the 34px icon buttons. */
const svgProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.3,
  strokeLinecap: 'square' as const,
  strokeLinejoin: 'miter' as const,
  'aria-hidden': true,
};

/** Paperclip — attach photo. */
function AttachIcon() {
  return (
    <svg {...svgProps}>
      <path d="M12.5 7 7 12.5a2.6 2.6 0 0 1-3.7-3.7l6-6a1.7 1.7 0 0 1 2.4 2.4l-6 6a0.8 0.8 0 0 1-1.1-1.1L10 7" />
    </svg>
  );
}

/** Microphone — record voice. */
function MicIcon() {
  return (
    <svg {...svgProps}>
      <rect x="5.5" y="1.5" width="5" height="8" rx="2" />
      <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0" />
      <line x1="8" y1="12" x2="8" y2="14.3" />
      <line x1="5.5" y1="14.4" x2="10.5" y2="14.4" />
    </svg>
  );
}

/** Filled square — stop recording. */
function StopIcon() {
  return (
    <svg {...svgProps} fill="currentColor" stroke="none">
      <rect x="4" y="4" width="8" height="8" />
    </svg>
  );
}

export default function AssistantPanel({ open, onClose }: AssistantPanelProps) {
  const { currentBusinessId } = useCurrentBusiness();
  const { socket } = useSocket();
  const [sendMessage] = useSendAssistantMessageMutation();
  const [confirmAction] = useConfirmAssistantActionMutation();
  const [transcribeAudio] = useTranscribeAssistantAudioMutation();

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState('');
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<AssistantProposedAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Attachments staged for the next message.
  const [attachments, setAttachments] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // Voice input.
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const conversationId = useRef<string | undefined>(undefined);
  const busyRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  useEffect(scrollToBottom, [messages, streaming, pending, previews, scrollToBottom]);

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

  // --- Image attachments ---
  const onPickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-picking the same file
    if (!picked.length) return;
    setAttachments((prev) => {
      const next = [...prev, ...picked].slice(0, MAX_IMAGES);
      setPreviews(next.map((f) => URL.createObjectURL(f)));
      return next;
    });
  };

  // Revoke staged previews (not the ones already handed to a sent message).
  const clearStagedPreviews = useCallback(() => {
    setPreviews((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
  }, []);

  const removeImage = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => {
      const url = prev[idx];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || !currentBusinessId || busy) return;

    const sentImages = previews; // ownership of these object URLs moves to the message
    const sentFiles = attachments;
    setMessages((m) => [...m, { role: 'user', content: trimmed, images: sentImages.length ? sentImages : undefined }]);
    setInput('');
    setAttachments([]);
    setPreviews([]); // don't revoke — the message still displays them
    setPending(null);
    setBusyState(true);
    try {
      const result = await sendMessage({
        businessId: currentBusinessId,
        message: trimmed,
        conversationId: conversationId.current,
        images: sentFiles.length ? sentFiles : undefined,
      }).unwrap();
      applyResult(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyState(false);
    }
  };

  // --- Voice input (record → transcribe → fill the box) ---
  const startRecording = async () => {
    if (!currentBusinessId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) return;
        setTranscribing(true);
        setError(null);
        try {
          const { text } = await transcribeAudio({ businessId: currentBusinessId, audio: blob }).unwrap();
          if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
        } catch (err) {
          setError(getErrorMessage(err));
        } finally {
          setTranscribing(false);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError('Microphone access was blocked. Allow mic access to use voice input.');
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const toggleRecording = () => (recording ? stopRecording() : startRecording());

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
    setAttachments([]);
    clearStagedPreviews();
    if (recording) stopRecording();
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const isEmpty = messages.length === 0 && !streaming;
  const inputLocked = busy || !!pending;
  const canSend = !inputLocked && (!!input.trim() || attachments.length > 0);

  /**
   * Enter sends, Shift+Enter inserts a newline (desktop chat convention). On
   * touch devices the on-screen Enter key inserts a newline and the user taps
   * Send instead. Ignore Enter while an IME composition is in progress.
   */
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    e.preventDefault();
    if (canSend) send(input);
  };

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
            <p className={styles.emptyTitle}>Ask about your business, attach a challan photo, or speak.</p>
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
            {m.images && m.images.length > 0 && (
              <div className={styles.messageImages}>
                {m.images.map((src, k) => (
                  <img key={k} src={src} alt="attachment" className={styles.messageImage} />
                ))}
              </div>
            )}
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

      {previews.length > 0 && (
        <div className={styles.attachmentStrip}>
          {previews.map((src, i) => (
            <div key={i} className={styles.thumb}>
              <img src={src} alt="pending attachment" className={styles.thumbImg} />
              <button
                type="button"
                className={styles.thumbRemove}
                onClick={() => removeImage(i)}
                aria-label="Remove attachment"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <form className={styles.composer} onSubmit={onSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className={styles.hiddenFile}
          onChange={onPickImages}
        />
        <textarea
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onInputKeyDown}
          rows={3}
          placeholder={
            pending
              ? 'Confirm or cancel above…'
              : recording
                ? 'Recording… tap ■ to stop'
                : transcribing
                  ? 'Transcribing…'
                  : 'Ask anything…'
          }
          aria-label="Message the assistant"
          disabled={inputLocked}
        />
        <div className={styles.composerBar}>
          <div className={styles.composerTools}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={inputLocked || attachments.length >= MAX_IMAGES}
              title="Attach photo"
              aria-label="Attach photo"
            >
              <AttachIcon />
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${recording ? styles.recording : ''}`}
              onClick={toggleRecording}
              disabled={inputLocked || transcribing}
              title={recording ? 'Stop recording' : 'Record voice'}
              aria-label={recording ? 'Stop recording' : 'Record voice'}
            >
              {recording ? <StopIcon /> : <MicIcon />}
            </button>
          </div>
          <span className={styles.composerHint}>Shift+Enter for new line</span>
          <button type="submit" className={styles.sendBtn} disabled={!canSend}>
            Send
          </button>
        </div>
      </form>
    </aside>
  );
}
