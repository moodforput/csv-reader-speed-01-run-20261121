// SwiftCSV — a fast, dependency-free drop-in for csv-reader 1.0.0 (make.fun's own CSV reader).
// Same answers as readCsv for every input, reached faster: plain fields are sliced in bulk
// (indexOf for the next delimiter), and only quoted fields, stray CRs and other edges take
// the slow path. Pure and deterministic: no clock, no randomness, no state between calls.
// Node 22, ES module, no dependencies.

/** How a field ended: at a comma (the record goes on), at a line break or at the end of the text. */
const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input, faster: {columns, rows, errors}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (len > 0 && text[0] === '\uFEFF') pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters onto `initial` up to the next comma or line break: a CR not followed by LF is
  // dropped (stray_cr). Returns the field, how it ended, and `added`, the characters kept.
  function readUnquoted(initial) {
    let value = initial;
    let added = 0;
    let start = pos;
    for (;;) {
      const iC = text.indexOf(',', pos);
      const iN = text.indexOf('\n', pos);
      const iR = text.indexOf('\r', pos);
      let i = -1;
      let kind = -1; // 0 comma, 1 LF, 2 CR
      if (iC !== -1) { i = iC; kind = 0; }
      if (iN !== -1 && (i === -1 || iN < i)) { i = iN; kind = 1; }
      if (iR !== -1 && (i === -1 || iR < i)) { i = iR; kind = 2; }
      if (i === -1) {
        const seg = text.slice(start);
        if (seg.length !== 0) { value += seg; added += seg.length; }
        pos = len;
        return { value, ended: END, added };
      }
      if (kind === 0) {
        const seg = text.slice(start, i);
        if (seg.length !== 0) { value += seg; added += seg.length; }
        pos = i + 1;
        return { value, ended: COMMA, added };
      }
      if (kind === 1) {
        const seg = text.slice(start, i);
        if (seg.length !== 0) { value += seg; added += seg.length; }
        pos = i + 1;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      // A CR: CRLF ends the line, a lone CR is dropped (stray_cr) and the field goes on.
      if (i + 1 < len && text[i + 1] === '\n') {
        const seg = text.slice(start, i);
        if (seg.length !== 0) { value += seg; added += seg.length; }
        pos = i + 2;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      error('stray_cr');
      const seg = text.slice(start, i);
      if (seg.length !== 0) { value += seg; added += seg.length; }
      pos = i + 1;
      start = pos;
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    pos = open + 1;
    let start = pos;
    let closed = false;
    for (;;) {
      const q = text.indexOf('"', pos);
      const r = text.indexOf('\r', pos);
      const n = text.indexOf('\n', pos);
      let i = -1;
      let kind = -1; // 0 quote, 1 CR, 2 LF
      if (q !== -1) { i = q; kind = 0; }
      if (r !== -1 && (i === -1 || r < i)) { i = r; kind = 1; }
      if (n !== -1 && (i === -1 || n < i)) { i = n; kind = 2; }
      if (i === -1) break; // no closing quote before the end of the text
      if (kind === 0) {
        if (i + 1 < len && text[i + 1] === '"') {
          // A doubled quote is one quote.
          if (i > start) value += text.slice(start, i);
          value += '"';
          pos = i + 2;
          start = pos;
          continue;
        }
        // The closing quote.
        if (i > start) value += text.slice(start, i);
        pos = i + 1;
        closed = true;
        break;
      }
      if (kind === 1) {
        // CRLF and a lone CR inside quotes are each one LF.
        if (i > start) value += text.slice(start, i);
        value += '\n';
        line += 1;
        pos = (i + 1 < len && text[i + 1] === '\n') ? i + 2 : i + 1;
        start = pos;
        continue;
      }
      // An LF inside quotes is one LF.
      if (i > start) value += text.slice(start, i);
      value += '\n';
      line += 1;
      pos = i + 1;
      start = pos;
    }
    if (!closed) {
      // The quote never closes: it is a literal character, and the text after it is read again as unquoted.
      pos = open + 1;
      line = openLine;
      error('unterminated_quote');
      return readUnquoted('"');
    }
    if (pos >= len) return { value, ended: END, added: 0 };
    const c = text[pos];
    if (c === ',') { pos += 1; return { value, ended: COMMA, added: 0 }; }
    if (c === '\n') { pos += 1; line += 1; return { value, ended: LINE_BREAK, added: 0 }; }
    if (c === '\r' && pos + 1 < len && text[pos + 1] === '\n') { pos += 2; line += 1; return { value, ended: LINE_BREAK, added: 0 }; }
    // What follows the closing quote is appended as it stands, up to the next comma or line break.
    const junk = readUnquoted(value);
    if (junk.added > 0) error('quote_junk');
    return junk;
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text[pos];
      if (c === '\n') {
        pos += 1;
        line += 1;
      } else if (c === '\r' && pos + 1 < len && text[pos + 1] === '\n') {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let fieldValue;
    let fieldEnded;
    let quoted;
    // The next LF from the record's start, cached: plain fields cannot hold one, so
    // every plain field in the record ends at a comma before it or at it. -2 unknown,
    // -1 none ahead (the text ends first). A quoted field may swallow LFs, so it
    // invalidates the cache.
    let lineEnd = -2;
    do {
      if (text[pos] === '"') {
        quoted = true;
        const f = readQuoted();
        fieldValue = f.value;
        fieldEnded = f.ended;
        lineEnd = -2;
      } else {
        quoted = false;
        // Fast unquoted field: the next comma or the cached line end ends it. A CR
        // inside the slice is a stray CR (or the CRLF at the line end, handled
        // below), so any field whose slice holds one falls back to readUnquoted.
        if (lineEnd === -2) {
          lineEnd = text.indexOf('\n', pos);
        }
        const iC = text.indexOf(',', pos);
        let end = -1;
        let ended = END;
        let isCRLF = false;
        if (iC !== -1 && (lineEnd === -1 || iC < lineEnd)) {
          end = iC;
          ended = COMMA;
        } else if (lineEnd !== -1) {
          end = lineEnd;
          ended = LINE_BREAK;
          if (end > pos && text[end - 1] === '\r') isCRLF = true;
        }
        if (end === -1) {
          const seg = text.slice(pos);
          if (seg.indexOf('\r') !== -1) {
            const f = readUnquoted('');
            fieldValue = f.value;
            fieldEnded = f.ended;
          } else {
            fieldValue = seg;
            fieldEnded = END;
            pos = len;
          }
        } else {
          const seg = text.slice(pos, isCRLF ? end - 1 : end);
          if (seg.indexOf('\r') !== -1) {
            const f = readUnquoted('');
            fieldValue = f.value;
            fieldEnded = f.ended;
          } else {
            fieldValue = seg;
            fieldEnded = ended;
            pos = end + 1;
            if (ended === LINE_BREAK) line += 1;
          }
        }
      }
      fields.push(fieldValue);
    } while (fieldEnded === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
