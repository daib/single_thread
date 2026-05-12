"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

/**
 * Renders chat message body as Markdown (GFM). Sanitized to avoid HTML/script injection.
 */
export function MessageMarkdown({ body }: { body: string }) {
  return (
    <div className="message-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {body}
      </ReactMarkdown>
    </div>
  );
}
