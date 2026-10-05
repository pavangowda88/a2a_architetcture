import React from 'react';
import { X, Bot, ChevronDown } from 'lucide-react';

export interface CommandToolStep {
  tool?: string;
  status?: string;
  duration_ms?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
}

interface CommandOutputPanelProps {
  command: string;
  markdown: string;
  steps: CommandToolStep[];
  onClose: () => void;
}

function inlineMarkdown(text: string): React.ReactNode[] {
  const token = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g;
  const result: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = token.exec(text))) {
    if (match.index > cursor) result.push(text.slice(cursor, match.index));
    const value = match[0];
    const key = `${match.index}-${value}`;
    if (value.startsWith('`')) result.push(<code key={key}>{value.slice(1, -1)}</code>);
    else if (value.startsWith('**')) result.push(<strong key={key}>{value.slice(2, -2)}</strong>);
    else if (value.startsWith('*')) result.push(<em key={key}>{value.slice(1, -1)}</em>);
    else {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(value);
      if (link) result.push(<a key={key} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>);
    }
    cursor = token.lastIndex;
  }
  if (cursor < text.length) result.push(text.slice(cursor));
  return result;
}

export function markdownBlocks(markdown: string): React.ReactNode[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (line.startsWith('```')) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) code.push(lines[index++]);
      index += 1;
      blocks.push(<pre key={`code-${index}`}><code>{code.join('\n')}</code></pre>);
      continue;
    }
    if (line.includes('|') && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      const headings = cells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes('|')) rows.push(cells(lines[index++]));
      blocks.push(
        <div className="markdown-table-wrap" key={`table-${index}`}>
          <table>
            <thead><tr>{headings.map((heading, cellIndex) => <th key={`th-${cellIndex}`}>{inlineMarkdown(heading)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={`tr-${rowIndex}`}>{headings.map((_, cellIndex) => <td key={`td-${cellIndex}`}>{inlineMarkdown(row[cellIndex] || '')}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push(<hr key={`hr-${index}`} />);
      index += 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const Tag = `h${heading[1].length}` as 'h1' | 'h2' | 'h3';
      blocks.push(<Tag key={`heading-${index}`}>{inlineMarkdown(heading[2])}</Tag>);
      index += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(<li key={`li-${index}`}>{inlineMarkdown(lines[index].replace(/^\s*[-*]\s+/, ''))}</li>);
        index += 1;
      }
      blocks.push(<ul key={`ul-${index}`}>{items}</ul>);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(<li key={`oli-${index}`}>{inlineMarkdown(lines[index].replace(/^\s*\d+\.\s+/, ''))}</li>);
        index += 1;
      }
      blocks.push(<ol key={`ol-${index}`}>{items}</ol>);
      continue;
    }
    if (line.startsWith('> ')) {
      blocks.push(<blockquote key={`quote-${index}`}>{inlineMarkdown(line.slice(2))}</blockquote>);
      index += 1;
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,3}\s|```|\s*[-*]\s+|\s*\d+\.\s+|> )/.test(lines[index])) paragraph.push(lines[index++]);
    blocks.push(<p key={`p-${index}`}>{paragraph.map(inlineMarkdown).flatMap((nodes, i) => i ? [<br key={`br-${index}-${i}`} />, ...nodes] : nodes)}</p>);
  }
  return blocks;
}

export const CommandOutputPanel: React.FC<CommandOutputPanelProps> = ({ command, markdown, steps, onClose }) => (
  <div className="command-output-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="command-output-panel" role="dialog" aria-modal="true" aria-labelledby="command-output-title">
      <header className="command-output-header">
        <div className="command-output-icon"><Bot size={17} /></div>
        <div><h2 id="command-output-title">Command response</h2><p>Markdown preview · factory assistant</p></div>
        <button type="button" onClick={onClose} aria-label="Close command response"><X size={17} /></button>
      </header>
      <div className="command-output-request"><span>Your command</span><p>{command}</p></div>
      <article className="markdown-preview">{markdownBlocks(markdown || 'No response text was returned.')}</article>
      {steps.length > 0 && (
        <details className="command-tool-details">
          <summary><span>Tool execution</span><span>{steps.length} step{steps.length === 1 ? '' : 's'}</span><ChevronDown size={14} /></summary>
          <div className="command-tool-list">
            {steps.map((step, index) => (
              <div className="command-tool-step" key={`${step.tool || 'tool'}-${index}`}>
                <div><strong>{step.tool || 'Tool call'}</strong><span>{step.status || 'complete'}{step.duration_ms ? ` · ${step.duration_ms} ms` : ''}</span></div>
                {step.error && <p className="tool-error">{step.error}</p>}
                {step.input !== undefined && <details className="command-tool-json"><summary>Arguments</summary><pre>{JSON.stringify(step.input, null, 2)}</pre></details>}
                {step.output !== undefined && <details className="command-tool-json"><summary>Result</summary><pre>{JSON.stringify(step.output, null, 2)}</pre></details>}
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  </div>
);
