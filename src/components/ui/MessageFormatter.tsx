import React from "react";
import { Info } from "lucide-react";

export interface MessageFormatterProps {
  text: string;
  isUser?: boolean;
  className?: string;
}

/**
 * Formats inline text converting markdown styles (**bold**, *italic*, `code`, source tags `[REF]`)
 * into styled React elements, while ensuring no raw asterisks or syntax symbols leak.
 */
function renderInlineContent(content: string, isUser: boolean): React.ReactNode[] {
  // Regex to match inline code (`code`), bold (**bold** or __bold__), italic (*italic* or _italic_),
  // and reference tags [EVT-...] or [FR-...]
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[A-Za-z0-9_\-:\.]{2,40}\])/g;
  const parts = content.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Inline Code
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      const codeText = part.slice(1, -1);
      return (
        <code
          key={index}
          className={`px-1.5 py-0.5 rounded font-mono text-xs ${
            isUser
              ? "bg-slate-800 text-sky-200 border border-slate-700"
              : "bg-slate-100 text-sky-900 border border-slate-200"
          }`}
        >
          {codeText}
        </code>
      );
    }

    // Source Reference Tag: [EVT-EDA-LIVE-SAA], [FR-ECLSS-001], [astro-ASTRO-01], etc.
    if (part.startsWith("[") && part.endsWith("]") && part.length >= 4 && !part.includes("](")) {
      const refTag = part.slice(1, -1);
      return (
        <span
          key={index}
          className={`inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded font-mono text-[10px] font-bold tracking-tight border ${
            isUser
              ? "bg-slate-800 text-sky-200 border-slate-700"
              : "bg-slate-100 text-slate-700 border-slate-200/90 shadow-2xs"
          }`}
        >
          {refTag}
        </span>
      );
    }

    // Bold (**text** or __text__)
    if (
      (part.startsWith("**") && part.endsWith("**") && part.length >= 4) ||
      (part.startsWith("__") && part.endsWith("__") && part.length >= 4)
    ) {
      const boldText = part.slice(2, -2).replace(/\*/g, "").trim();
      return (
        <strong
          key={index}
          className={`font-semibold tracking-tight ${
            isUser ? "text-white font-bold" : "text-slate-950 font-bold"
          }`}
        >
          {boldText}
        </strong>
      );
    }

    // Italic (*text* or _text_)
    if (
      (part.startsWith("*") && part.endsWith("*") && part.length >= 2) ||
      (part.startsWith("_") && part.endsWith("_") && part.length >= 2)
    ) {
      const italicText = part.slice(1, -1).replace(/\*/g, "").trim();
      return (
        <em key={index} className="italic opacity-90">
          {italicText}
        </em>
      );
    }

    // Plain text chunk: strip any stray unparsed asterisks so no raw stars leak to the UI
    const cleanedText = part.replace(/\*/g, "");
    return <React.Fragment key={index}>{cleanedText}</React.Fragment>;
  });
}

/**
 * MessageFormatter renders conversational SI messages with clean typography,
 * properly formatted bold headers (#, ##, ###, ####), blockquotes (>), lists,
 * and reference badges with zero raw syntax leakage.
 */
export function MessageFormatter({
  text,
  isUser = false,
  className = "",
}: MessageFormatterProps) {
  if (!text) return null;

  const lines = text.split("\n");
  const renderedElements: React.ReactNode[] = [];
  let currentListItems: React.ReactNode[] = [];
  let isNumberedList = false;

  const flushList = () => {
    if (currentListItems.length > 0) {
      const ListTag = isNumberedList ? "ol" : "ul";
      renderedElements.push(
        <ListTag
          key={`list-${renderedElements.length}`}
          className={`my-2 space-y-1.5 pl-5 ${
            isNumberedList ? "list-decimal" : "list-disc"
          } ${isUser ? "text-slate-100 marker:text-sky-300" : "text-slate-800 marker:text-sky-600"}`}
        >
          {currentListItems}
        </ListTag>
      );
      currentListItems = [];
      isNumberedList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Empty lines act as paragraph separators
    if (!trimmed) {
      flushList();
      continue;
    }

    // Level 4 Heading (#### )
    if (trimmed.startsWith("#### ")) {
      flushList();
      const headingContent = trimmed.slice(5);
      renderedElements.push(
        <h5
          key={`h5-${i}`}
          className={`text-xs font-bold tracking-tight mt-3 mb-1 text-slate-900 flex items-center gap-1.5 pb-1 border-b border-slate-100`}
        >
          {renderInlineContent(headingContent, isUser)}
        </h5>
      );
      continue;
    }

    // Level 3 Heading (### )
    if (trimmed.startsWith("### ")) {
      flushList();
      const headingContent = trimmed.slice(4);
      renderedElements.push(
        <h4
          key={`h4-${i}`}
          className={`text-xs sm:text-sm font-bold uppercase tracking-wider mt-4 mb-2 flex items-center gap-1.5 ${
            isUser ? "text-sky-300" : "text-sky-900"
          }`}
        >
          {renderInlineContent(headingContent, isUser)}
        </h4>
      );
      continue;
    }

    // Level 2 Heading (## )
    if (trimmed.startsWith("## ")) {
      flushList();
      const headingContent = trimmed.slice(3);
      renderedElements.push(
        <h3
          key={`h3-${i}`}
          className={`text-sm sm:text-base font-black tracking-tight mt-5 mb-2 pb-1.5 border-b border-slate-200/80 flex items-center gap-2 ${
            isUser ? "text-white" : "text-slate-950"
          }`}
        >
          {renderInlineContent(headingContent, isUser)}
        </h3>
      );
      continue;
    }

    // Level 1 Heading (# )
    if (trimmed.startsWith("# ")) {
      flushList();
      const headingContent = trimmed.slice(2);
      renderedElements.push(
        <h2
          key={`h2-${i}`}
          className={`text-base sm:text-lg font-black tracking-tight mt-5 mb-2.5 pb-2 border-b border-slate-200 ${
            isUser ? "text-white" : "text-slate-950"
          }`}
        >
          {renderInlineContent(headingContent, isUser)}
        </h2>
      );
      continue;
    }

    // Blockquote (> )
    if (trimmed.startsWith("> ")) {
      flushList();
      const quoteContent = trimmed.slice(2);
      renderedElements.push(
        <blockquote
          key={`quote-${i}`}
          className="my-3 p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-950 text-xs sm:text-[13px] leading-relaxed shadow-2xs italic flex items-start gap-2"
        >
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 not-italic" />
          <div className="flex-1 not-italic">
            {renderInlineContent(quoteContent, isUser)}
          </div>
        </blockquote>
      );
      continue;
    }

    // Bullet List Item (- or *)
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (isNumberedList) flushList();
      isNumberedList = false;
      currentListItems.push(
        <li key={`li-${i}`} className="leading-relaxed">
          {renderInlineContent(bulletMatch[1], isUser)}
        </li>
      );
      continue;
    }

    // Numbered List Item (1. , 2. )
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      if (!isNumberedList && currentListItems.length > 0) flushList();
      isNumberedList = true;
      currentListItems.push(
        <li key={`li-${i}`} className="leading-relaxed">
          {renderInlineContent(numberedMatch[2], isUser)}
        </li>
      );
      continue;
    }

    // Standard paragraph or key-value line
    flushList();
    renderedElements.push(
      <p
        key={`p-${i}`}
        className={`leading-relaxed my-1 ${
          isUser ? "text-slate-100" : "text-slate-800"
        }`}
      >
        {renderInlineContent(rawLine, isUser)}
      </p>
    );
  }

  flushList();

  return (
    <div
      className={`font-sans text-sm sm:text-[14.5px] leading-relaxed space-y-1 ${className}`}
    >
      {renderedElements}
    </div>
  );
}
