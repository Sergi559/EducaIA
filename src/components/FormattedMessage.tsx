import React from 'react';

interface FormattedMessageProps {
  content: string;
  isUser?: boolean;
}

function renderInlineFormatting(text: string, isUser: boolean): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong
          key={index}
          className={isUser ? 'font-semibold text-white' : 'font-semibold text-[#0A192F]'}
        >
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return (
        <code
          key={index}
          className={`font-mono text-[0.9em] px-1.5 py-0.5 rounded ${
            isUser ? 'bg-white/15 text-sky-100' : 'bg-slate-100 text-[#0A192F]'
          }`}
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={index}>{token}</React.Fragment>;
  });
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = parseTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

export function FormattedMessage({ content, isUser = false }: FormattedMessageProps) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: { ordered: boolean; items: string[] } | null = null;
  let tableRows: string[][] | null = null;

  const flushList = (keyPrefix: string) => {
    if (!listItems) return;
    if (listItems.ordered) {
      blocks.push(
        <ol key={`${keyPrefix}-ol`} className="list-decimal pl-5 space-y-1.5 my-2">
          {listItems.items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineFormatting(item, isUser)}
            </li>
          ))}
        </ol>
      );
    } else {
      blocks.push(
        <ul key={`${keyPrefix}-ul`} className="list-disc pl-5 space-y-1.5 my-2">
          {listItems.items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineFormatting(item, isUser)}
            </li>
          ))}
        </ul>
      );
    }
    listItems = null;
  };

  const flushTable = (keyPrefix: string) => {
    if (!tableRows || tableRows.length === 0) return;
    const [headerRow, ...bodyRows] = tableRows;
    blocks.push(
      <div
        key={`${keyPrefix}-table`}
        className="my-4 overflow-x-auto rounded-lg border border-slate-200 bg-white"
      >
        <table className="w-full border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="bg-[#0A192F] text-white">
              {headerRow.map((cell, idx) => (
                <th key={idx} className="px-3.5 py-2.5 font-semibold border-b border-slate-700">
                  {renderInlineFormatting(cell, true)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {bodyRows.map((row, rowIdx) => (
              <tr key={rowIdx} className={rowIdx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                {headerRow.map((_, colIdx) => (
                  <td
                    key={colIdx}
                    className="px-3.5 py-2.5 align-top text-slate-700 leading-relaxed"
                  >
                    {renderInlineFormatting(row[colIdx] ?? '', false)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = null;
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (line.startsWith('|') && line.includes('|')) {
      flushList(`table-list-${index}`);
      if (isTableSeparator(line)) {
        return;
      }
      if (!tableRows) {
        tableRows = [];
      }
      tableRows.push(parseTableRow(line));
      return;
    }

    flushTable(`non-table-${index}`);

    if (!line) {
      flushList(`empty-${index}`);
      return;
    }

    if (/^-{3,}$/.test(line)) {
      flushList(`hr-${index}`);
      blocks.push(
        <hr
          key={`hr-${index}`}
          className={`my-3 ${isUser ? 'border-white/20' : 'border-slate-200'}`}
        />
      );
      return;
    }

    const headingMatch = line.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      flushList(`heading-${index}`);
      blocks.push(
        <h4
          key={`h-${index}`}
          className={`font-display font-semibold text-base mt-4 mb-1.5 first:mt-0 ${
            isUser ? 'text-white' : 'text-[#0A192F]'
          }`}
        >
          {renderInlineFormatting(headingMatch[1], isUser)}
        </h4>
      );
      return;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      if (listItems && listItems.ordered) {
        flushList(`switch-${index}`);
      }
      if (!listItems) {
        listItems = { ordered: false, items: [] };
      }
      listItems.items.push(bulletMatch[1]);
      return;
    }

    const orderedMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      if (listItems && !listItems.ordered) {
        flushList(`switch-${index}`);
      }
      if (!listItems) {
        listItems = { ordered: true, items: [] };
      }
      listItems.items.push(orderedMatch[1]);
      return;
    }

    flushList(`p-${index}`);
    blocks.push(
      <p key={`p-${index}`} className="leading-relaxed my-1.5 first:mt-0 last:mb-0">
        {renderInlineFormatting(line, isUser)}
      </p>
    );
  });

  flushList('end');
  flushTable('end');

  return <div className="text-[15px] break-words">{blocks}</div>;
}
