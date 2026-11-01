"use client";

import {
  ActionBarPrimitive,
  AttachmentPrimitive,
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import {
  ArrowUpIcon,
  BookOpen,
  CheckIcon,
  CopyIcon,
  EllipsisVertical,
  Lightbulb,
  KeyRound,
  Mic,
  PencilIcon,
  PenLine,
  Sparkles,
  PlusIcon,
  RefreshCwIcon,
  Telescope,
  ThumbsDown,
  ThumbsUp,
  XIcon,
} from "lucide-react";
import { type FC, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAttachmentSrc } from "@/hooks/use-attachment-src";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Gemini: FC<{
  onOpenKeys?: () => void;
  datasets?: Array<{ code: string; name: string; group: string }>;
  scope?: string;
  onScopeChange?: (scope: string) => void;
}> = ({ onOpenKeys, datasets = [], scope = "", onScopeChange }) => {
  return (
      <ThreadPrimitive.Root className="flex h-full flex-col overflow-hidden bg-background text-foreground">
        <AuiIf condition={(s) => s.thread.messages.length === 0}>
          <div className="relative flex grow flex-col">
            <div className="flex grow flex-col items-center justify-center px-4">
              <div className="flex w-full max-w-3xl flex-col">
                <h2 className="fade-in slide-in-from-bottom-3 motion-safe:animate-in fill-mode-both relative z-10 mb-6 text-center text-4xl font-normal text-foreground delay-500 duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]">
                  How can I help you today?
                </h2>
                <Suggestions />
                <div className="relative">
                  <div
                    aria-hidden="true"
                    className="fade-in zoom-in-40 blur-in-[90px] motion-safe:animate-in fill-mode-both pointer-events-none absolute top-1/2 left-1/2 h-[260px] w-[680px] max-w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-[140px] bg-brand/15 blur-[90px] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-brand/25"
                  />
                  <div className="relative z-10">
                    <Composer onOpenKeys={onOpenKeys} datasets={datasets} scope={scope} onScopeChange={onScopeChange} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AuiIf>

        <AuiIf condition={(s) => s.thread.messages.length > 0}>
          <ThreadPrimitive.Viewport className="flex grow flex-col overflow-y-scroll pt-12">
            <ThreadPrimitive.Messages components={{ Message: ChatMessage }} />
            <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto flex w-full flex-col items-center gap-1.5 bg-background px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <Composer onOpenKeys={onOpenKeys} datasets={datasets} scope={scope} onScopeChange={onScopeChange} />
              <p className="text-center text-xs text-muted-foreground">
                Not legal advice. Check the cited section before relying on it.
              </p>
            </ThreadPrimitive.ViewportFooter>
          </ThreadPrimitive.Viewport>
        </AuiIf>
      </ThreadPrimitive.Root>
  );
};

// Starter questions, so an empty thread offers a way in. These are the app's
// own prompts, not Google's.
const SUGGESTIONS = [
  { Icon: Sparkles, label: "What is the most controversial law in California?" },
  { Icon: PenLine, label: "How much notice must a landlord give before entering?" },
  { Icon: Lightbulb, label: "Summarise Penal Code section 148" },
];

const Suggestions: FC = () => {
  const aui = useAui();

  return (
    <div className="mb-5 flex w-full flex-col">
      {SUGGESTIONS.map(({ Icon, label }) => (
        <button
          key={label}
          type="button"
          onClick={() => {
            aui.composer().setText(label);
            aui.composer().send();
          }}
          className="flex items-center gap-4 rounded-2xl px-4 py-2.5 text-left text-[15px] text-foreground transition-colors hover:bg-muted"
        >
          <Icon className="size-[18px] shrink-0 text-muted-foreground" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};


const Composer: FC<{
  onOpenKeys?: () => void;
  datasets?: Array<{ code: string; name: string; group: string }>;
  scope?: string;
  onScopeChange?: (scope: string) => void;
}> = ({ onOpenKeys, datasets = [], scope = "", onScopeChange }) => {
  return (
    <ComposerPrimitive.Root className="mx-auto flex w-full max-w-2xl flex-col rounded-4xl border border-border/70 bg-card p-3">
      <AuiIf condition={(s) => s.composer.attachments.length > 0}>
        <div className="flex flex-row gap-2.5 overflow-x-auto px-1 pt-1 pb-2.5">
          <ComposerPrimitive.Attachments
            components={{ Attachment: GeminiAttachment }}
          />
        </div>
      </AuiIf>

      <div className="flex items-end gap-1">
        <GeminiPlusMenu onOpenKeys={onOpenKeys} datasets={datasets} scope={scope} onScopeChange={onScopeChange} />
        <ComposerPrimitive.Input
          rows={1}
          placeholder="Ask about California law"
          className="max-h-40 flex-1 resize-none rounded-md bg-transparent px-2 py-1.5 text-[17px] leading-6 text-foreground placeholder:text-muted-foreground"
        />
        <VoiceButton />
        <GeminiSendButton />
      </div>
    </ComposerPrimitive.Root>
  );
};

// Real destinations only: the Google tool rows the example ships with do not
// exist in this app.
const APP_LINKS = [
  { id: "corpus", label: "Codes & sources", Icon: Telescope, href: "/corpus" },
];

const GeminiPlusMenu: FC<{
  onOpenKeys?: () => void;
  datasets?: Array<{ code: string; name: string; group: string }>;
  scope?: string;
  onScopeChange?: (scope: string) => void;
}> = ({ onOpenKeys, datasets = [], scope = "", onScopeChange }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="More"
          className="size-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
        >
          <PlusIcon width={20} height={20} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="min-w-56">
        {APP_LINKS.map(({ id, label, Icon, href }) => (
          <DropdownMenuItem key={id} asChild>
            <a href={href}>
              <Icon className="size-4" />
              {label}
            </a>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {/* Scoping the search to one code was lost when the old thread view
            went; it lives here now. */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <BookOpen className="size-4" />
            Search scope
            <span className="text-muted-foreground ml-auto text-xs">
              {scope || "All"}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
            <DropdownMenuItem onSelect={() => onScopeChange?.("")}>
              <CheckIcon className={scope ? "size-4 opacity-0" : "size-4"} />
              All California law
            </DropdownMenuItem>
            {datasets.map((dataset) => (
              <DropdownMenuItem
                key={dataset.code}
                onSelect={() => onScopeChange?.(dataset.code)}
              >
                <CheckIcon className={scope === dataset.code ? "size-4" : "size-4 opacity-0"} />
                {dataset.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onOpenKeys?.()}>
          <KeyRound className="size-4" />
          API keys
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const sendBtnClass =
  "flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition-colors hover:bg-brand/90";

const GeminiSendButton: FC = () => {
  return (
    <>
      <AuiIf condition={(s) => !s.thread.isRunning && !s.composer.isEmpty}>
        <ComposerPrimitive.Send
          aria-label="Send message"
          className={`${sendBtnClass} disabled:bg-muted disabled:text-muted-foreground`}
        >
          <ArrowUpIcon width={20} height={20} />
        </ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={(s) => s.thread.isRunning}>
        <ComposerPrimitive.Cancel
          aria-label="Stop generating"
          className={sendBtnClass}
        >
          <span className="size-3 rounded-[3px] bg-current" />
        </ComposerPrimitive.Cancel>
      </AuiIf>
    </>
  );
};


// Dictation through the browser's own speech recognition, writing the
// transcript into the composer. No key and no server round trip.
type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex?: number }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function speechRecognition(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const VoiceButton: FC = () => {
  const aui = useAui();
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<RecognitionLike | null>(null);

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = speechRecognition();
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const index = event.resultIndex ?? 0;
      const transcript = event.results[index]?.[0]?.transcript?.trim();
      if (transcript) aui.composer().setText(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={listening ? "Stop dictation" : "Dictate"}
      aria-pressed={listening}
      onClick={toggle}
      className={`size-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground ${listening ? "bg-muted text-foreground" : ""}`}
    >
      <Mic width={20} height={20} />
    </Button>
  );
};

const actionBtnClass =
  "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

const ChatMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="group/message mx-auto mb-7 flex w-full max-w-3xl flex-col px-4">
      <AuiIf condition={(s) => s.message.role === "user"}>
        <div className="flex items-center justify-end gap-1">
          <ActionBarPrimitive.Root className="flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100">
            <ActionBarPrimitive.Copy className={actionBtnClass}>
              <CopyIcon width={16} height={16} />
            </ActionBarPrimitive.Copy>
            <ActionBarPrimitive.Edit className={actionBtnClass}>
              <PencilIcon width={16} height={16} />
            </ActionBarPrimitive.Edit>
          </ActionBarPrimitive.Root>
          <div className="max-w-[75%] rounded-3xl bg-muted px-5 py-3 wrap-break-word text-foreground">
            <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
          </div>
        </div>
      </AuiIf>

      <AuiIf condition={(s) => s.message.role === "assistant"}>
        <div className="flex flex-col">
          <div className="wrap-break-word text-foreground">
            <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
          </div>
          <MessagePrimitive.Error>
            <ErrorPrimitive.Root className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <ErrorPrimitive.Message className="line-clamp-3" />
            </ErrorPrimitive.Root>
          </MessagePrimitive.Error>
          <ActionBarPrimitive.Root className="mt-1.5 -ml-2 flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100">
            <ActionBarPrimitive.FeedbackPositive className={actionBtnClass}>
              <ThumbsUp width={16} height={16} />
            </ActionBarPrimitive.FeedbackPositive>
            <ActionBarPrimitive.FeedbackNegative className={actionBtnClass}>
              <ThumbsDown width={16} height={16} />
            </ActionBarPrimitive.FeedbackNegative>
            <ActionBarPrimitive.Copy className={actionBtnClass}>
              <AuiIf condition={(s) => s.message.isCopied}>
                <CheckIcon width={16} height={16} />
              </AuiIf>
              <AuiIf condition={(s) => !s.message.isCopied}>
                <CopyIcon width={16} height={16} />
              </AuiIf>
            </ActionBarPrimitive.Copy>
            <ActionBarPrimitive.Reload className={actionBtnClass}>
              <RefreshCwIcon width={16} height={16} />
            </ActionBarPrimitive.Reload>
            <button type="button" aria-label="More" className={actionBtnClass}>
              <EllipsisVertical width={16} height={16} />
            </button>
          </ActionBarPrimitive.Root>
        </div>
      </AuiIf>
    </MessagePrimitive.Root>
  );
};

const GeminiAttachment: FC = () => {
  const isImage = useAuiState(({ attachment }) => attachment.type === "image");
  const src = useAttachmentSrc();

  return (
    <AttachmentPrimitive.Root className="group/thumbnail relative">
      <div className="size-[72px] overflow-hidden rounded-xl border border-border bg-muted">
        {isImage && src ? (
          <img className="size-full object-cover" alt="Attachment" src={src} />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <AttachmentPrimitive.unstable_Thumb className="text-xs" />
          </div>
        )}
      </div>
      <AttachmentPrimitive.Remove
        className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 transition-all group-focus-within/thumbnail:opacity-100 group-hover/thumbnail:opacity-100 hover:bg-muted hover:text-foreground"
        aria-label="Remove attachment"
      >
        <XIcon width={14} height={14} />
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
};
