"use client";

// Bridges the app's own thread state to an assistant-ui runtime.
//
// The backend is a custom SSE endpoint, not the Vercel AI SDK data stream, so
// the external store runtime is the right adapter: the app keeps owning
// messages and streaming, and assistant-ui's primitives render them.

import { useMemo, type ReactNode } from "react";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import type { ChatMessage } from "@/components/assistant-chat/types";

function textOf(message: AppendMessage): string {
  if (typeof message.content === "string") return message.content;
  return message.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

function toThreadMessage(message: ChatMessage, running: boolean, isLast: boolean): ThreadMessageLike {
  const parts = message.content.map((part) => {
    if (part.type === "text") return { type: "text" as const, text: part.text };
    if (part.type === "reasoning") return { type: "reasoning" as const, text: part.text };
    return {
      type: "tool-call" as const,
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      args: part.args,
      ...(part.result !== undefined ? { result: part.result } : {}),
    };
  });

  // assistant-ui rejects a status on user messages, so it is only set for
  // assistant turns.
  const status: ThreadMessageLike["status"] =
    message.role === "assistant"
      ? running && isLast
        ? { type: "running" }
        : { type: "complete", reason: "stop" }
      : undefined;

  return {
    id: message.id,
    role: message.role,
    createdAt: message.createdAt,
    content: parts as ThreadMessageLike["content"],
    ...(status ? { status } : {}),
  };
}

export function ResearchRuntimeProvider({
  messages,
  running,
  onSend,
  onCancel,
  onReload,
  children,
}: {
  messages: ChatMessage[];
  running: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
  onReload: () => void;
  children: ReactNode;
}) {
  const converted = useMemo(
    () => messages.map((message, index) => toThreadMessage(message, running, index === messages.length - 1)),
    [messages, running],
  );

  const runtime = useExternalStoreRuntime<ThreadMessageLike>({
    messages: converted,
    isRunning: running,
    convertMessage: (message) => message,
    onNew: async (message: AppendMessage) => {
      const text = textOf(message);
      if (text) onSend(text);
    },
    onCancel: async () => {
      onCancel();
    },
    onReload: async () => {
      onReload();
    },
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
