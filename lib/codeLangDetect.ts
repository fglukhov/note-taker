/**
 * Milkdown plugin: auto-detect language for code_block nodes that have no
 * language set (e.g. after pasting plain fenced code).
 *
 * Uses highlight.js core + a curated set of popular languages (~35 KB gzip).
 * Only fires when a transaction introduces new code_block nodes without a language.
 */
import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';

import hljs from 'highlight.js/lib/core';

// Popular languages — add more as needed without bloating the bundle
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml'; // html, xml, svg
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import sql from 'highlight.js/lib/languages/sql';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';
import csharp from 'highlight.js/lib/languages/csharp';
import plaintext from 'highlight.js/lib/languages/plaintext';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('go', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('css', css);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('php', php);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('plaintext', plaintext);

// Map hljs language names → CodeMirror / Crepe language names
const LANG_MAP: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  bash: 'Shell',
  rust: 'Rust',
  go: 'Go',
  java: 'Java',
  cpp: 'C++',
  css: 'CSS',
  xml: 'HTML',
  json: 'JSON',
  yaml: 'YAML',
  sql: 'SQL',
  php: 'PHP',
  ruby: 'Ruby',
  swift: 'Swift',
  kotlin: 'Kotlin',
  csharp: 'C#',
};

const pluginKey = new PluginKey('codeLangDetect');

/** Minimum relevance score — below this threshold we leave the language empty */
const MIN_RELEVANCE = 10;

/**
 * Heuristic pre-checks for languages with very distinct syntax markers.
 * Returns a Crepe language name, or null if no confident match.
 * These run BEFORE hljs to avoid hljs confusing e.g. JS with C++/C#.
 */
function heuristicDetect(code: string): string | null {
  // TypeScript — generic types, decorators, or strict TS-only constructs
  if (
    /:\s*(string|number|boolean|void|never|any|unknown)\b/.test(code) &&
    /\bconst\b|\blet\b|\bfunction\b/.test(code)
  )
    return 'TypeScript';

  // JavaScript — JS-specific operators that don't exist in C-family
  // ===, !==, =>, typeof, const, let, var function(...) {
  if (
    /===|!==/.test(code) ||
    /\bconst\b.*=.*=>/.test(code) ||
    (/\bconst\b|\blet\b/.test(code) && /\bfunction\b|\b=>\b/.test(code))
  )
    return 'JavaScript';

  // Python — indentation + def/import/print style
  if (
    /^\s*(def |class |import |from |if __name__)/.test(code) ||
    /\bprint\s*\(/.test(code) ||
    /:\s*$/.test(code.split('\n')[0] ?? '')
  )
    return 'Python';

  // Rust — unique keywords
  if (
    /\bfn\s+\w+\s*\(/.test(code) ||
    /\bimpl\b|\bpub\s+fn\b|\blet\s+mut\b/.test(code)
  ) {
    return 'Rust';
  }

  // Go
  if (/\bfunc\s+\w+\s*\(/.test(code) || /\bpackage\s+\w+/.test(code)) {
    return 'Go';
  }

  // Shell / Bash
  if (
    /^#!/.test(code) ||
    /\b(echo|grep|awk|sed|chmod|sudo|apt|brew)\b/.test(code)
  ) {
    return 'Shell';
  }

  // SQL
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/im.test(code)) {
    return 'SQL';
  }

  // JSON
  if (/^\s*[{[]/.test(code.trim()) && /[}\]]$/.test(code.trim())) {
    try {
      JSON.parse(code);
      return 'JSON';
    } catch {
      /* not json */
    }
  }

  // CSS
  if (
    /[.#][\w-]+\s*\{/.test(code) ||
    /@(media|keyframes|import|charset)/.test(code)
  ) {
    return 'CSS';
  }

  // YAML — key: value at root level, no braces
  if (/^\w[\w\s]*:\s+\S/.test(code) && !code.includes('{')) {
    return 'YAML';
  }

  // PHP
  if (/^\s*<\?php/.test(code)) return 'PHP';

  return null;
}

export const codeLangDetectPlugin = $prose(() => {
  return new Plugin({
    key: pluginKey,
    appendTransaction(transactions, _oldState, newState) {
      // Only react to transactions that actually changed the document
      const docChanged = transactions.some((tr) => tr.docChanged);
      if (!docChanged) return null;

      // Avoid reacting to our own transactions
      const isSelf = transactions.some((tr) => tr.getMeta(pluginKey));
      if (isSelf) return null;

      const tr = newState.tr;
      let updated = false;

      newState.doc.descendants((node, pos) => {
        if (node.type.name !== 'code_block') return;
        const lang: string = node.attrs.language ?? '';
        if (lang !== '') return; // already has a language

        const code = node.textContent.trim();
        if (code.length < 10) return; // too short to detect

        // 1. Fast heuristic check first
        const heuristic = heuristicDetect(code);
        if (heuristic) {
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            language: heuristic,
          });
          updated = true;
          return;
        }

        // 2. Fall back to hljs.highlightAuto with a higher confidence bar
        const result = hljs.highlightAuto(code);
        if (!result.language || (result.relevance ?? 0) < MIN_RELEVANCE) return;

        const mapped = LANG_MAP[result.language] ?? result.language;
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, language: mapped });
        updated = true;
      });

      if (!updated) return null;

      tr.setMeta(pluginKey, true);
      return tr;
    },
  });
});
