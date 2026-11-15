import React, { useMemo } from "react";
import { ExternalLink } from "lucide-react";

interface NasaDescriptionFormatterProps {
  rawDescription: string;
  className?: string;
}

/**
 * Safely parses NASA API descriptions containing embedded HTML tags (<b>, <a>, <p>, <br>)
 * and renders them with clean typography, styled clickable links, and readable paragraphs.
 */
export function NasaDescriptionFormatter({
  rawDescription,
  className = "",
}: NasaDescriptionFormatterProps) {
  const content = useMemo(() => {
    if (!rawDescription) {
      return <p className="text-slate-400 italic">No description provided by NASA.</p>;
    }

    // In SSR or fallback environments where DOMParser is not available
    if (typeof window === "undefined" || typeof DOMParser === "undefined") {
      // Basic fallback: strip raw HTML tags
      const plain = rawDescription.replace(/<[^>]*>/g, " ");
      return <p className="text-slate-700 leading-relaxed">{plain}</p>;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawDescription, "text/html");

      // Extract and clean child nodes safely
      function transformNode(node: Node, key: string | number): React.ReactNode {
        // Text node
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || "";
          return text;
        }

        // Element node
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tagName = el.tagName.toLowerCase();

          // Transform <a> tags into styled external links
          if (tagName === "a") {
            let href = el.getAttribute("href") || "#";
            if (href.startsWith("http://")) {
              href = href.replace("http://", "https://");
            }
            const linkText = el.textContent || href;
            return (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-700 hover:text-sky-900 underline font-semibold decoration-sky-300 hover:decoration-sky-600 transition-colors inline-flex items-center gap-0.5 mx-0.5"
              >
                <span>{linkText}</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-60 shrink-0" />
              </a>
            );
          }

          // Transform <b> or <strong> tags into styled bold
          if (tagName === "b" || tagName === "strong") {
            const children = Array.from(el.childNodes).map((child, i) =>
              transformNode(child, `${key}-${i}`)
            );
            return (
              <strong key={key} className="font-bold text-slate-900">
                {children}
              </strong>
            );
          }

          // Transform <p> or <div> tags
          if (tagName === "p" || tagName === "div") {
            const children = Array.from(el.childNodes).map((child, i) =>
              transformNode(child, `${key}-${i}`)
            );
            return (
              <p key={key} className="mb-3 leading-relaxed">
                {children}
              </p>
            );
          }

          // Transform line breaks
          if (tagName === "br") {
            return <br key={key} />;
          }

          // Default container
          const children = Array.from(el.childNodes).map((child, i) =>
            transformNode(child, `${key}-${i}`)
          );
          return <React.Fragment key={key}>{children}</React.Fragment>;
        }

        return null;
      }

      const bodyChildren = Array.from(doc.body.childNodes);
      return bodyChildren.map((child, i) => transformNode(child, i));
    } catch (err) {
      console.warn("Failed to parse NASA description HTML, falling back to plain text", err);
      const plain = rawDescription.replace(/<[^>]*>/g, " ");
      return <p className="text-slate-700 leading-relaxed">{plain}</p>;
    }
  }, [rawDescription]);

  return (
    <div
      className={`text-xs sm:text-sm text-slate-700 leading-relaxed space-y-3 font-normal break-words ${className}`}
    >
      {content}
    </div>
  );
}
