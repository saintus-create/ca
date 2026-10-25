# assistant-ui and Cartesia voice: implementation and verification

Date: 2026-10-25. Branch: `arena/07c8ff66-ca`.
Libraries: `@assistant-ui/react` 0.15.31 (with `@assistant-ui/core` 0.3.31),
Next 15.5.28, React 19, Node 22.

Everything the chat shows is an assistant-ui primitive, and both voice
directions run on Cartesia: Sonic for listening, Ink for dictation, each
surfaced to the library as an adapter rather than a bespoke button.

## Test status

| Layer | Command | Result |
| --- | --- | --- |
| Types | `npx tsc --noEmit` | clean |
| Production build | `npm run build` | 14 routes |
| SSE reader | `npm run test:sse` | 8 passed |
| Turn reducer | `npm run test:chat` | 12 passed |
| Chat screen, browser-level (jsdom) | `npm run test:ui` | 21 passed |
| Routes + server render | `npm run smoke` | 60 passed |
| Lint | `npx next lint` | no findings |

`npm test` runs the four suites in that order (build first: the smoke suite
serves `.next`).

The UI suite bundles `scripts/ui-harness-entry.tsx` (which mounts the real
`AssistantChat`) with esbuild for the browser and drives it with real DOM
events in jsdom. The assistant-ui runtime, primitives, adapters and SSE reader
all run; only `fetch` and the media layer (a fake `Audio`, `MediaRecorder` and
microphone) are stubbed.

Not covered by any of this: pixels, real browser hydration, Safari's
non-MediaSource path, and live provider calls. The smoke suite exercises the
routes against local stand-ins for Sarvam, Firecrawl and Cartesia.

## What the screen is built from

Routes: `/` (the chat), `/corpus`, `/faq`, `/open-researcher`, and the API
routes under `/api` (research, follow-up, corpus-search, scrape, check-env and
four voice routes). The old `/api/tts` was a duplicate of `/api/voice/tts` with
no callers and is deleted.

`components/assistant-chat/`:

| File | Role |
| --- | --- |
| `chat-store.tsx` | Data: threads, persistence, the research run, voice availability |
| `thread-view.tsx` | `AssistantRuntimeProvider`, thread/viewport, composer, adapters |
| `messages.tsx` | `MessagePrimitive.Root` + `ActionBarPrimitive` for user and assistant turns, edit composer |
| `message-parts.tsx` | The `Text`, `Reasoning`, tool-call and empty part renderers |
| `voice-controls.tsx` | `ComposerPrimitive.Dictate`/`StopDictation`, dictation status, the voice picker |

Primitives in use: `AssistantRuntimeProvider`, `ThreadPrimitive.Root`,
`Viewport`, `Messages`, `Suggestion`, `ScrollToBottom`, `MessagePrimitive.Root`,
`Parts`, `Error`, `ActionBarPrimitive.Root/Copy/Reload/Edit/Speak/StopSpeaking`,
`ComposerPrimitive.Root/Input/Send/Cancel/Dictate/StopDictation/DictationTranscript`,
`AuiIf`, `useAuiState`, `useThreadViewport`, and `useExternalStoreRuntime` with
`messages`, `isRunning`, `onNew`, `onEdit`, `onReload`, `onCancel`,
`setMessages`, `convertMessage` and `adapters`.

Message state that is not a part (the sources behind an answer, its error)
travels in `metadata.custom`, which is the library's channel for app data, and
the failure itself is modelled as `status: { type: 'incomplete', reason: 'error' }`
so `MessagePrimitive.Error` renders the error card.

Not wired: attachments (no attachment adapter, no upload endpoint), branches
(the runtime falls back to linear history), and feedback (no `FeedbackAdapter`,
since there is nowhere to send it). Editing, reloading, cancelling, copying and
speaking are all wired.

## Cartesia voice

`lib/voice/` is framework-free except for the types it implements.

- **`speech-adapter.ts`** implements `SpeechSynthesisAdapter`. `speak(text)`
  posts to `/api/voice/tts` and streams the MP3 into an `<audio>` element,
  reporting `starting` → `running` → `ended` so `ActionBarPrimitive.Speak`
  and `StopSpeaking` follow playback. Starting a second answer cancels the
  first. The voice and speed are read from the preference at press time, so
  the picker applies without remounting the runtime. When the deployment has no
  Cartesia key it degrades to `WebSpeechSynthesisAdapter` (after stripping
  markdown), and when the browser has no speech at all it returns `undefined`,
  which turns the Listen button off.
- **`dictation-adapter.ts`** implements `DictationAdapter`. It uses the
  browser's recogniser when there is one (interim results fill the composer as
  you talk) and otherwise records with `MediaRecorder` and posts the clip to
  `/api/voice/stt`, which is Cartesia Ink. `disableInputDuringDictation` is
  false so the transcript can be edited before sending.
- **`playback.ts`** owns audio: MediaSource streaming where `audio/mpeg` is
  supported, a buffered blob where it is not, one append at a time, and
  clean cancellation.

Server side: `app/api/voice/status` tells the screen what is available;
`/api/voice/tts`, `/api/voice/stt`, `/api/voice/voices` and `/api/voice/preview`
proxy Cartesia, so the key never reaches the browser.

Deployments without a key keep working: Listen uses the browser's voice, the
picker is hidden, and the microphone appears only if the browser has a
recogniser (the Ink path needs the key).

## Defects found during this work and fixed

1. **The build was broken by assistant-ui's globals.** Its
   `Window.SpeechRecognition` declaration is narrower than the browser's, and
   the old `mic-button.tsx` intersected `Window`, so `next build` failed. The
   file is gone; the adapter reads the constructor through a local cast.
2. **SSE frames were parsed per network chunk**, dropping any frame a chunk
   boundary split — including the answer, which arrives as one large frame. The
   chat now streams through `lib/sse.ts`; reverting it fails 7 UI tests.
3. **Answers only appeared when the whole run finished**; the per-step
   `response` events were ignored.
4. **Every assistant bubble was marked running**, so earlier answers had their
   research steps forced open and a Regenerate button that silently did nothing
   mid-run.
5. **`onReload` ignored `parentId`**, always regenerating the last turn.
6. **Firecrawl key handling**: `FIRECRAWL_BASE_URL` was ignored by the research
   agent, and a per-request `X-Firecrawl-API-Key` was written into
   `process.env`, leaking one request's key into the next on the same instance.
7. **Toasts never rendered**: no `<Toaster />` was mounted anywhere, so voice
   failures were silent. It is now mounted with the chat.

## Removed

The previous chat and the voice code it carried are deleted, so there is one
chat and one voice path: `components/research-chat.tsx`,
`components/speech-provider.tsx`, `components/speak-button.tsx`,
`components/mic-button.tsx`, `hooks/use-speech.ts`,
`components/spectrum/ai-assistants/*`, `components/elevenlabs/*` and
`components/screenshot-preview.tsx`.

## Still open

- **Follow-up suggestions** from `/api/open-researcher/follow-up` are not
  surfaced in the new screen.
- **Search screenshots** are returned by the tools but not displayed.
- **Threads live in localStorage**; the library's thread-list adapters are not
  used, and there is no server-side history.
- **Voice quality on iOS Safari** uses the buffered path (no MediaSource for
  `audio/mpeg`), so playback starts when the clip is complete.

## Re-running

```bash
npm ci
npm run build          # the smoke suite serves .next
npm test               # sse + chat + ui + smoke
DEBUG_UI=1 npm run test:ui   # prints the rendered screen for a failing case
```

`npm run dev` builds into `.next-dev` (via `NEXT_DIST_DIR`), so the dev server
and the smoke suite no longer fight over `.next` — before that, running the
tests while the preview was open rewrote the production build and the smoke
server exited with `routesManifest.dataRoutes is not iterable`.
