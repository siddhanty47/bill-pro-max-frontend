import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { Socket } from 'socket.io-client';
import AssistantPanel from './AssistantPanel';
import { WebSocketContext } from '../../context/socketContext';
import { renderWithProviders, signedIn } from '../../test/render';
import { server } from '../../test/msw/server';
import { apiUrl, ok } from '../../test/msw/handlers';
import type { AssistantRunResult } from '../../types';

if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};

type Handler = (payload: unknown) => void;

function makeSocket() {
  const handlers = new Map<string, Handler>();
  const socket = {
    on: vi.fn((event: string, fn: Handler) => handlers.set(event, fn)),
    off: vi.fn((event: string) => handlers.delete(event)),
  };
  return {
    socket: socket as unknown as Socket,
    emit: (event: string, payload: unknown) => act(() => handlers.get(event)?.(payload)),
  };
}

function renderPanel(opts: { socket?: Socket | null; onClose?: () => void } = {}) {
  const onClose = opts.onClose ?? vi.fn();
  const utils = renderWithProviders(
    <WebSocketContext.Provider value={{ socket: opts.socket ?? null, isConnected: true }}>
      <AssistantPanel open onClose={onClose} />
    </WebSocketContext.Provider>,
    { preloadedState: signedIn() }
  );
  return { ...utils, onClose };
}

const reply = (result: AssistantRunResult) =>
  http.post(apiUrl('/businesses/biz-1/assistant/chat'), () => ok(result));

async function ask(user: ReturnType<typeof renderPanel>['user'], text: string) {
  await user.type(screen.getByLabelText('Message the assistant'), text);
  await user.click(screen.getByRole('button', { name: 'Send' }));
}

// Globals the tests replace; restored after each test so nothing leaks into other files.
const originalMatchMedia = window.matchMedia;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

beforeEach(() => {
  server.use(http.get(apiUrl('/businesses'), () => ok([])));
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof matchMedia;
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.matchMedia = originalMatchMedia;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  if (originalMediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
  } else {
    delete (navigator as { mediaDevices?: unknown }).mediaDevices;
  }
});

describe('AssistantPanel', () => {
  it('shows sentence-case chrome and suggestions when empty', () => {
    renderPanel();

    expect(screen.getByText('Assistant')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New chat' })).toBeInTheDocument();
    expect(screen.getByText('Show me all overdue bills')).toBeInTheDocument();
  });

  it('closes from the header button', async () => {
    const { user, onClose } = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Close assistant' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('sends a message and shows the assistant reply', async () => {
    server.use(
      reply({ status: 'completed', conversationId: 'c1', message: 'You have 3 overdue.' })
    );
    const { user } = renderPanel();

    await ask(user, 'overdue?');

    expect(await screen.findByText('You have 3 overdue.')).toBeInTheDocument();
    expect(screen.getByText('overdue?')).toBeInTheDocument();
  });

  it('sends a suggestion when clicked', async () => {
    server.use(reply({ status: 'completed', conversationId: 'c1', message: 'Here you go.' }));
    const { user } = renderPanel();

    await user.click(screen.getByText('Show me all overdue bills'));

    expect(await screen.findByText('Here you go.')).toBeInTheDocument();
  });

  it('sends on Enter but not Shift+Enter', async () => {
    server.use(reply({ status: 'completed', conversationId: 'c1', message: 'Sent.' }));
    const { user } = renderPanel();
    const box = screen.getByLabelText('Message the assistant');

    await user.type(box, 'hello{Shift>}{Enter}{/Shift}more');
    expect(screen.queryByText('Sent.')).not.toBeInTheDocument();
    await user.type(box, '{Enter}');

    expect(await screen.findByText('Sent.')).toBeInTheDocument();
  });

  it('shows an error result', async () => {
    server.use(reply({ status: 'error', conversationId: 'c1', error: 'Model unavailable' }));
    const { user } = renderPanel();

    await ask(user, 'hi');

    expect(await screen.findByText('Model unavailable')).toBeInTheDocument();
  });

  it('shows a request failure', async () => {
    server.use(
      http.post(apiUrl('/businesses/biz-1/assistant/chat'), () =>
        HttpResponse.json({ success: false, message: 'Boom' }, { status: 500 })
      )
    );
    const { user } = renderPanel();

    await ask(user, 'hi');

    expect(await screen.findByText('Boom')).toBeInTheDocument();
  });

  it('asks for confirmation and applies the approved result', async () => {
    let approved: unknown;
    server.use(
      reply({
        status: 'awaiting_confirmation',
        conversationId: 'c1',
        action: { summary: 'Create challan CH-1', calls: [] },
      }),
      http.post(apiUrl('/businesses/biz-1/assistant/confirm'), async ({ request }) => {
        approved = await request.json();
        return ok({ status: 'completed', conversationId: 'c1', message: 'Created.' });
      })
    );
    const { user } = renderPanel();

    await ask(user, 'make a challan');
    expect(await screen.findByText('Confirm action')).toBeInTheDocument();
    expect(screen.getByText('Create challan CH-1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('Created.')).toBeInTheDocument();
    expect(approved).toEqual({ conversationId: 'c1', approve: true });
  });

  it('declines a proposed action', async () => {
    let body: unknown;
    server.use(
      reply({
        status: 'awaiting_confirmation',
        conversationId: 'c1',
        action: { summary: 'Delete bill', calls: [] },
      }),
      http.post(apiUrl('/businesses/biz-1/assistant/confirm'), async ({ request }) => {
        body = await request.json();
        return ok({ status: 'completed', conversationId: 'c1', message: 'Cancelled.' });
      })
    );
    const { user } = renderPanel();

    await ask(user, 'delete');
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Cancelled.')).toBeInTheDocument();
    expect(body).toEqual({ conversationId: 'c1', approve: false });
  });

  it('streams text and tool status over the socket while busy', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>(r => (release = r));
    server.use(
      http.post(apiUrl('/businesses/biz-1/assistant/chat'), async () => {
        await gate;
        return ok({ status: 'completed', conversationId: 'c1', message: 'Final.' });
      })
    );
    const { socket, emit } = makeSocket();
    const { user } = renderPanel({ socket });

    await ask(user, 'go');
    await screen.findByText('Thinking…');
    emit('assistant:tool', { conversationId: 'c1', name: 'search_bills', status: 'running' });
    expect(await screen.findByText('Using search bills…')).toBeInTheDocument();
    emit('assistant:delta', { conversationId: 'c1', text: 'Partial ' });
    emit('assistant:delta', { conversationId: 'c1', text: 'text' });
    expect(await screen.findByText('Partial text')).toBeInTheDocument();
    emit('assistant:tool', { conversationId: 'c1', name: 'search_bills', status: 'done' });
    emit('assistant:error', { conversationId: 'c1', error: 'Stream hiccup' });
    expect(await screen.findByText('Stream hiccup')).toBeInTheDocument();
    release();

    expect(await screen.findByText('Final.')).toBeInTheDocument();
  });

  it('ignores socket events when idle and unsubscribes on unmount', () => {
    const { socket, emit } = makeSocket();
    const { unmount } = renderPanel({ socket });

    emit('assistant:delta', { conversationId: 'c1', text: 'stray' });
    expect(screen.queryByText('stray')).not.toBeInTheDocument();
    unmount();

    expect(socket.off).toHaveBeenCalledWith('assistant:delta', expect.any(Function));
  });

  it('starts a new chat, clearing messages', async () => {
    server.use(reply({ status: 'completed', conversationId: 'c1', message: 'Old answer.' }));
    const { user } = renderPanel();
    await ask(user, 'first');
    await screen.findByText('Old answer.');

    await user.click(screen.getByRole('button', { name: 'New chat' }));

    expect(screen.queryByText('Old answer.')).not.toBeInTheDocument();
    expect(screen.getByText('Show me all overdue bills')).toBeInTheDocument();
  });

  describe('photo attachments', () => {
    beforeEach(() => {
      let n = 0;
      URL.createObjectURL = vi.fn(() => `blob:preview-${n++}`);
      URL.revokeObjectURL = vi.fn();
    });

    const pick = (...names: string[]) => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const files = names.map(n => new File(['x'], n, { type: 'image/png' }));
      fireEvent.change(input, { target: { files } });
    };

    it('stages, removes and sends images', async () => {
      server.use(reply({ status: 'completed', conversationId: 'c1', message: 'Got it.' }));
      const { user } = renderPanel();

      pick('a.png', 'b.png');
      expect(screen.getAllByAltText('pending attachment')).toHaveLength(2);
      await user.click(screen.getAllByRole('button', { name: 'Remove attachment' })[0]);
      expect(screen.getAllByAltText('pending attachment')).toHaveLength(1);
      await user.click(screen.getByRole('button', { name: 'Send' }));

      expect(await screen.findByText('Got it.')).toBeInTheDocument();
      expect(screen.getByAltText('attachment')).toBeInTheDocument();
    });

    it('caps attachments at four and clears them on new chat', async () => {
      const { user } = renderPanel();

      pick('1.png', '2.png', '3.png', '4.png', '5.png');
      expect(screen.getAllByAltText('pending attachment')).toHaveLength(4);
      expect(screen.getByRole('button', { name: 'Attach photo' })).toBeDisabled();
      await user.click(screen.getByRole('button', { name: 'New chat' }));

      expect(screen.queryByAltText('pending attachment')).not.toBeInTheDocument();
    });

    it('opens the file picker from the attach button and ignores an empty pick', async () => {
      const { user } = renderPanel();
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const click = vi.spyOn(input, 'click');

      await user.click(screen.getByRole('button', { name: 'Attach photo' }));
      fireEvent.change(input, { target: { files: [] } });

      expect(click).toHaveBeenCalled();
      expect(screen.queryByAltText('pending attachment')).not.toBeInTheDocument();
    });
  });

  describe('voice input', () => {
    class FakeRecorder {
      static last: FakeRecorder | null = null;
      mimeType = 'audio/webm';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => Promise<void>) | null = null;
      constructor() {
        FakeRecorder.last = this;
      }
      start() {}
      stop() {
        this.ondataavailable?.({ data: new Blob(['audio']) });
        void this.onstop?.();
      }
    }

    beforeEach(() => {
      vi.stubGlobal('MediaRecorder', FakeRecorder);
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
        },
      });
    });

    it('records, transcribes and fills the message box', async () => {
      server.use(
        http.post(apiUrl('/businesses/biz-1/assistant/transcribe'), () =>
          ok({ text: 'show overdue bills' })
        )
      );
      const { user } = renderPanel();

      await user.click(screen.getByRole('button', { name: 'Record voice' }));
      await user.click(await screen.findByRole('button', { name: 'Stop recording' }));

      await waitFor(() =>
        expect(screen.getByLabelText('Message the assistant')).toHaveValue('show overdue bills')
      );
    });

    it('shows plain-language recording guidance without a glyph', async () => {
      const { user } = renderPanel();

      await user.click(screen.getByRole('button', { name: 'Record voice' }));

      const input = await screen.findByLabelText('Message the assistant');
      expect(input).toHaveAttribute('placeholder', expect.stringContaining('Tap stop to end'));
      expect(input.getAttribute('placeholder')).not.toContain('■');
    });

    it('reports a transcription failure', async () => {
      server.use(
        http.post(apiUrl('/businesses/biz-1/assistant/transcribe'), () =>
          HttpResponse.json({ success: false, message: 'No speech' }, { status: 422 })
        )
      );
      const { user } = renderPanel();

      await user.click(screen.getByRole('button', { name: 'Record voice' }));
      await user.click(await screen.findByRole('button', { name: 'Stop recording' }));

      expect(await screen.findByText('No speech')).toBeInTheDocument();
    });

    it('explains when microphone access is blocked', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: vi.fn().mockRejectedValue(new Error('denied')) },
      });
      const { user } = renderPanel();

      await user.click(screen.getByRole('button', { name: 'Record voice' }));

      expect(
        await screen.findByText(
          'Microphone access was blocked. Allow mic access to use voice input.'
        )
      ).toBeInTheDocument();
    });

    it('stops an active recording when starting a new chat', async () => {
      const { user } = renderPanel();

      await user.click(screen.getByRole('button', { name: 'Record voice' }));
      await screen.findByRole('button', { name: 'Stop recording' });
      await user.click(screen.getByRole('button', { name: 'New chat' }));

      expect(screen.getByRole('button', { name: 'Record voice' })).toBeInTheDocument();
    });
  });
});
