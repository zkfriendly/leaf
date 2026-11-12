// A small formatter: preserve literals, comments, and relative body indentation.
function format(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  let block = 0, quote = null, escapes = false;
  const lines = text.split(/\r?\n/).map(raw => {
    const locked = block > 0 || quote !== null;
    const indent = raw.match(/^[ \t]*/)[0];
    let out = '', code = '', syntax = '', keepTail = false;
    const flush = () => {
      syntax += code;
      out += code.replace(/(?<![:=<>!+*/|&^%~?.\-])[ \t]*(:=|=>|->|:|→|←|×)[ \t]*(?![:=<>!+*/|&^%~?.\-])/gu,
        ' $1 ').replace(/([∑∏])(?=[\p{L}_])/gu, '$1 ');
      code = '';
    };
    for (let i = locked ? 0 : indent.length; i < raw.length;) {
      if (block) {
        if (raw.startsWith('/-', i)) { block++; out += '/-'; i += 2; }
        else if (raw.startsWith('-/', i)) { block--; out += '-/'; i += 2; }
        else out += raw[i++];
      } else if (quote) {
        if (escapes && raw[i] === '\\') { out += raw.slice(i, i + 2); i += 2; }
        else if (raw.startsWith(quote, i)) { out += quote; i += quote.length; quote = null; }
        else out += raw[i++];
      } else if (raw.startsWith('--', i)) {
        flush(); out += raw.slice(i); keepTail = true; break;
      } else if (raw.startsWith('/-', i)) {
        flush(); block = 1; out += '/-'; i += 2;
      } else {
        const literal = raw.slice(i).match(/^r(#+)?"|^"|^«|^'(?:\\.|[^'\\])'/u);
        if (literal) {
          flush(); out += literal[0]; i += literal[0].length;
          if (literal[0] === '«') quote = '»';
          else if (!literal[0].startsWith("'")) {
            quote = '"' + (literal[1] || '');
            escapes = literal[0] === '"';
          }
        } else code += raw[i++];
      }
    }
    flush();
    return { text: locked ? raw : indent + (keepTail || quote || block ? out : out.trimEnd()), syntax, locked,
      indent: indent.replace(/\t/g, '  ').length };
  });

  // Shift complete bodies together. Do not guess indentation inside proofs.
  const declaration = /^(?:(?:noncomputable|private|protected|public|unsafe|partial)\s+)*(?:def|abbrev|theorem|lemma|example|structure|class|instance)\b/u;
  for (let start = 0; start < lines.length; start++) {
    if (lines[start].locked || lines[start].indent || !declaration.test(lines[start].syntax)) continue;
    let end = start + 1;
    while (end < lines.length && (lines[end].locked || lines[end].indent || !lines[end].syntax.trim())) end++;
    let body = -1;
    for (let i = start; i < end; i++) {
      if (/(?:\bwhere|:=\s*(?:by|do)?)\s*$/u.test(lines[i].syntax)) { body = i + 1; break; }
    }
    if (body < 0 || lines.slice(start, end).some(line => line.locked)) continue;
    const headers = lines.slice(start + 1, body).filter(line => line.syntax.trim());
    if (headers.length) {
      const base = Math.min(...headers.map(line => line.indent));
      for (const line of headers) line.text = ' '.repeat(4 + line.indent - base) + line.text.trimStart();
    }
    const indices = Array.from({ length: end - body }, (_, i) => body + i)
      .filter(i => lines[i].syntax.trim());
    if (!indices.length) continue;
    const base = Math.min(...indices.map(i => lines[i].indent));
    for (let i = body; i < end; i++) {
      if (lines[i].text.trim() && lines[i].indent >= base) {
        lines[i].text = ' '.repeat(2 + lines[i].indent - base) + lines[i].text.trimStart();
      }
    }
    start = end - 1;
  }
  return lines.map(line => line.text).join(eol);
}

function activate(context) {
  const vscode = require('vscode');
  const edits = document => {
    if (document.languageId !== 'lean4' ||
        !vscode.workspace.getConfiguration('leanBasicFormat', document.uri).get('enabled')) return [];
    const original = document.getText(), formatted = format(original);
    return original === formatted ? [] : [vscode.TextEdit.replace(
      new vscode.Range(document.positionAt(0), document.positionAt(original.length)), formatted)];
  };
  context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(
    { language: 'lean4', scheme: 'file' }, { provideDocumentFormattingEdits: edits }));
  // Cursor skips normal format-on-save during delayed autosaves.
  context.subscriptions.push(vscode.workspace.onWillSaveTextDocument(event => {
    if (event.reason === vscode.TextDocumentSaveReason.AfterDelay) {
      event.waitUntil(Promise.resolve(edits(event.document)));
    }
  }));
}

module.exports = { activate, format };
