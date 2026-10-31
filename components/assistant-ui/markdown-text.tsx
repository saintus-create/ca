"use client";

// The Text slot for assistant-ui's message parts.
//
// assistant-ui owns the layout, streaming and action bar; this only decides how
// one text part is rendered, which is the extension point their API expects.
// It reuses the app's existing markdown renderer so citations keep working.

import { memo } from "react";
import { MarkdownRenderer } from "@/components/markdown-renderer";

export const MarkdownText = memo(function MarkdownText({ text }: { text: string }) {
  return <MarkdownRenderer content={text} />;
});
