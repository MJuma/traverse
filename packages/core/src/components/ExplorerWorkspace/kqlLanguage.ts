import type { Monaco } from '@monaco-editor/react';

import { getSchema, KQL_FUNCTIONS, KQL_AGGREGATIONS, KQL_SCALAR_FUNCTIONS } from '../../services/schema';
import type { SchemaTable } from '../../services/schema';

let schemaResolver: () => SchemaTable[] = () => getSchema();

export function setKqlSchemaResolver(resolver: () => SchemaTable[]): void {
    schemaResolver = resolver;
}

export function registerKqlLanguage(monaco: Monaco) {
    if (monaco.languages.getLanguages().some((l: { id: string }) => l.id === 'kql')) {
        return;
    }

    monaco.languages.register({ id: 'kql' });

    monaco.languages.setMonarchTokensProvider('kql', {
        ignoreCase: true,
        keywords: KQL_FUNCTIONS,
        aggregations: KQL_AGGREGATIONS,
        scalarFunctions: KQL_SCALAR_FUNCTIONS,
        operators: ['==', '!=', '<', '>', '<=', '>=', '!~', '=~', 'in', 'has', 'contains', 'startswith', 'endswith', 'matches regex', 'between', 'and', 'or', 'not'],
        tokenizer: {
            root: [
                [/\/\/.*$/, 'comment'],
                [/"[^"]*"/, 'string'],
                [/'[^']*'/, 'string'],
                [/\b(true|false)\b/, 'keyword'],
                [/\b(datetime|timespan|long|int|real|string|bool|dynamic)\b/, 'type'],
                [/\b(ago|now|bin)\s*\(/, { token: 'function', next: '@root' }],
                [/\b\d+(\.\d+)?\b/, 'number'],
                [/[a-zA-Z_]\w*/, {
                    cases: {
                        '@keywords': 'keyword',
                        '@aggregations': 'function',
                        '@scalarFunctions': 'function',
                        '@default': 'identifier',
                    },
                }],
                [/\|/, 'delimiter'],
                [/[{}()[\]]/, 'bracket'],
                [/[,;]/, 'delimiter'],
            ],
        },
    });

    monaco.languages.registerCompletionItemProvider('kql', {
        triggerCharacters: ['.', '|', ' ', ','],
        provideCompletionItems: (model: any, position: any) => {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
                startColumn: word.startColumn, endColumn: word.endColumn,
            };

            const suggestions: {
                label: string; kind: number; insertText: string; detail?: string;
                sortText?: string;
                range: { startLineNumber: number; endLineNumber: number; startColumn: number; endColumn: number };
            }[] = [];

            // Find the current statement block around the cursor (delimited by blank lines)
            let blockStart = position.lineNumber;
            while (blockStart > 1 && model.getLineContent(blockStart - 1).trim() !== '') {
                blockStart--;
            }
            let blockEnd = position.lineNumber;
            const totalLines = model.getLineCount();
            while (blockEnd < totalLines && model.getLineContent(blockEnd + 1).trim() !== '') {
                blockEnd++;
            }
            const blockLines: string[] = [];
            for (let i = blockStart; i <= blockEnd; i++) {
                blockLines.push(model.getLineContent(i));
            }
            const blockText = blockLines.join('\n');
            const schema = schemaResolver();

            // Find the table referenced in this statement block (first non-keyword identifier)
            const tableMatch = blockText.match(/^\s*(?:let\s+\w+\s*=\s*)?(\w+)/);
            const statementTable = tableMatch ? schema.find((t) => t.name === tableMatch[1]) : null;

            // Text from start of current line to cursor position
            const lineText = model.getLineContent(position.lineNumber);
            const textBeforeCursor = lineText.substring(0, position.column - 1);

            // Detect if we're right after a pipe + operator (e.g., "| where ", "| project ")
            const afterPipe = /\|\s*\w*$/.test(textBeforeCursor);
            // Detect if we're after a column-accepting operator on the current line
            const afterColumnOperator = /\|\s*(?:where|project|extend|project-away|project-rename|project-reorder|sort\s+by|order\s+by|distinct|summarize|mv-expand|parse)\s+/i.test(textBeforeCursor);
            // Detect if we're after "by" keyword (e.g., "summarize count() by ")
            const afterBy = /\bby\s+/i.test(textBeforeCursor);
            // Detect if we're inside a function call (after an open paren or comma)
            const insideFunc = /(?:\(|,)\s*\w*$/.test(textBeforeCursor);

            if (afterPipe) {
                // Right after pipe — suggest KQL tabular operators
                KQL_FUNCTIONS.forEach((fn) => {
                    suggestions.push({ label: fn, kind: monaco.languages.CompletionItemKind.Keyword, insertText: fn + ' ', range });
                });
            } else if (afterColumnOperator || afterBy || insideFunc) {
                // Context where columns are expected — prioritize columns from the statement's table
                if (statementTable) {
                    statementTable.columns.forEach((col) => {
                        suggestions.push({ label: col.name, kind: monaco.languages.CompletionItemKind.Field, insertText: col.name, detail: `${col.type} · ${statementTable.name}`, sortText: '0' + col.name, range });
                    });
                }
                // Also suggest aggregation and scalar functions (useful inside summarize, extend, etc.)
                KQL_AGGREGATIONS.forEach((fn) => {
                    suggestions.push({ label: fn, kind: monaco.languages.CompletionItemKind.Function, insertText: fn + '()', detail: 'aggregation', sortText: '1' + fn, range });
                });
                KQL_SCALAR_FUNCTIONS.forEach((fn) => {
                    suggestions.push({ label: fn, kind: monaco.languages.CompletionItemKind.Function, insertText: fn + '()', detail: 'function', sortText: '1' + fn, range });
                });
            } else {
                // General context — suggest tables first, then columns from mentioned tables, then functions
                schema.forEach((table) => {
                    suggestions.push({ label: table.name, kind: monaco.languages.CompletionItemKind.Class, insertText: table.name, detail: `${table.columns.length} cols`, sortText: '0' + table.name, range });
                });
                if (statementTable) {
                    statementTable.columns.forEach((col) => {
                        suggestions.push({ label: col.name, kind: monaco.languages.CompletionItemKind.Field, insertText: col.name, detail: `${col.type} · ${statementTable.name}`, sortText: '1' + col.name, range });
                    });
                } else {
                    // No specific table found — suggest columns from all mentioned tables
                    const mentioned = schema.filter((t) => blockText.includes(t.name));
                    mentioned.forEach((table) => {
                        table.columns.forEach((col) => {
                            suggestions.push({ label: col.name, kind: monaco.languages.CompletionItemKind.Field, insertText: col.name, detail: `${col.type} · ${table.name}`, sortText: '1' + col.name, range });
                        });
                    });
                }
                KQL_AGGREGATIONS.forEach((fn) => {
                    suggestions.push({ label: fn, kind: monaco.languages.CompletionItemKind.Function, insertText: fn + '()', detail: 'aggregation', sortText: '2' + fn, range });
                });
                KQL_SCALAR_FUNCTIONS.forEach((fn) => {
                    suggestions.push({ label: fn, kind: monaco.languages.CompletionItemKind.Function, insertText: fn + '()', detail: 'function', sortText: '2' + fn, range });
                });
            }

            // Deduplicate by label
            const seen = new Set<string>();
            const unique = suggestions.filter((s) => {
                if (seen.has(s.label)) {
                    return false;
                }
                seen.add(s.label);
                return true;
            });
            return { suggestions: unique };
        },
    });
}
