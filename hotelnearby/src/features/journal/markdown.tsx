import Link from "next/link";
import type { ReactNode } from "react";

// Small safe Markdown subset for editorial copy. Raw HTML is never interpreted.
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\[[^\]]+\]\((?:https?:\/\/|\/(?!\/))[^\s)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\(((?:https?:\/\/|\/(?!\/))[^\s)]+)\)$/);
    const label = link?.[1];
    const destination = link?.[2];
    if (label && destination) return destination.startsWith("/") ? <Link key={index} href={destination} className="font-semibold text-accent-text underline">{label}</Link> : <a key={index} href={destination} rel="nofollow noopener noreferrer" className="font-semibold text-accent-text underline">{label}</a>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export function JournalMarkdown({ content }: { content: string }) {
  const blocks = content.replace(/\r/g, "").split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  return <div className="journal-prose space-y-5 text-base leading-8 text-foreground">
    {blocks.map((block, index) => {
      const lines = block.split("\n");
      if (lines.every((line) => /^[-*] /.test(line))) return <ul key={index} className="list-disc space-y-2 pl-6">{lines.map((line, i) => <li key={i}>{inline(line.replace(/^[-*] /, ""))}</li>)}</ul>;
      if (lines.every((line) => /^\d+\. /.test(line))) return <ol key={index} className="list-decimal space-y-2 pl-6">{lines.map((line, i) => <li key={i}>{inline(line.replace(/^\d+\. /, ""))}</li>)}</ol>;
      const heading = block.match(/^(#{2,3})\s+(.+)$/);
     if (heading) {
  const headingLevel = heading[1]?.length;
  const headingText = heading[2] ?? "";
  const Tag = headingLevel === 2 ? "h2" : "h3";

  return (
    <Tag
      key={index}
      className="pt-3 text-2xl font-extrabold tracking-tight"
    >
      {headingText}
    </Tag>
  );
}
      return <p key={index}>{lines.map((line, i) => <span key={i}>{i > 0 ? <br /> : null}{inline(line)}</span>)}</p>;
    })}
  </div>;
}
