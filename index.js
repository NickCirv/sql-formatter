#!/usr/bin/env node
/**
 * sql-formatter — Format, pretty-print, and lint SQL queries
 * Zero external dependencies. Pure built-in modules only.
 * MIT License
 */

import fs from 'fs';
import path from 'path';

// ─── Token Types ─────────────────────────────────────────────────────────────

const T = {
  KEYWORD: 'KEYWORD',
  IDENTIFIER: 'IDENTIFIER',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  OPERATOR: 'OPERATOR',
  PUNCTUATION: 'PUNCTUATION',
  COMMENT_LINE: 'COMMENT_LINE',
  COMMENT_BLOCK: 'COMMENT_BLOCK',
  WHITESPACE: 'WHITESPACE',
  EOF: 'EOF',
};

// ─── Keyword Sets ─────────────────────────────────────────────────────────────

const KEYWORDS = new Set([
  'SELECT','DISTINCT','FROM','WHERE','JOIN','INNER','LEFT','RIGHT','FULL','CROSS',
  'OUTER','ON','GROUP','BY','ORDER','HAVING','LIMIT','OFFSET','AS','AND','OR','NOT',
  'IN','EXISTS','BETWEEN','LIKE','ILIKE','IS','NULL','CASE','WHEN','THEN','ELSE',
  'END','CAST','COALESCE','NULLIF','INSERT','INTO','VALUES','UPDATE','SET','DELETE',
  'CREATE','TABLE','ALTER','DROP','ADD','COLUMN','INDEX','VIEW','SCHEMA','DATABASE',
  'WITH','UNION','INTERSECT','EXCEPT','ALL','RECURSIVE','PRIMARY','KEY','FOREIGN',
  'REFERENCES','UNIQUE','DEFAULT','CHECK','CONSTRAINT','AUTO_INCREMENT','NOTNULL',
  'SERIAL','RETURNING','USING','NATURAL','LATERAL','TABLESAMPLE','WINDOW','OVER',
  'PARTITION','ROWS','RANGE','UNBOUNDED','PRECEDING','FOLLOWING','CURRENT','ROW',
  'FETCH','FIRST','NEXT','ONLY','TRUE','FALSE','ASC','DESC','NULLS','LAST',
  'IF','REPLACE','TRUNCATE','EXPLAIN','ANALYZE','VERBOSE','VACUUM','GRANT','REVOKE',
  'ROLLBACK','COMMIT','BEGIN','TRANSACTION','SAVEPOINT','RELEASE',
  'INTERVAL','NOW','COUNT','SUM','AVG','MIN','MAX','DATE','TIME','YEAR','MONTH','DAY',
  'VARCHAR','INT','BIGINT','TEXT','BOOLEAN','FLOAT','DOUBLE','DECIMAL','TIMESTAMP',
  'CASCADE','RESTRICT','CURRENT_TIMESTAMP','CURRENT_DATE','CURRENT_TIME',
]);

const CLAUSE_STARTERS = new Set([
  'SELECT','FROM','WHERE','HAVING','LIMIT','OFFSET',
  'UNION','UNION ALL','INTERSECT','EXCEPT',
  'INSERT INTO','UPDATE','DELETE FROM',
  'CREATE TABLE','ALTER TABLE','DROP TABLE',
  'CREATE','ALTER','DROP',
  'WITH','EXPLAIN','VACUUM','GRANT','REVOKE','TRUNCATE',
  'BEGIN','COMMIT','ROLLBACK',
  'GROUP BY','ORDER BY',
  'JOIN','INNER JOIN','LEFT JOIN','RIGHT JOIN','FULL JOIN','CROSS JOIN',
  'LEFT OUTER JOIN','RIGHT OUTER JOIN','FULL OUTER JOIN','NATURAL JOIN',
  'ON','SET','VALUES','RETURNING',
]);

const FUNC_KEYWORDS = new Set([
  'COUNT','SUM','AVG','MIN','MAX','COALESCE','NULLIF','CAST','ISNULL','IFNULL',
  'NVL','IIF','NOW','DATE','YEAR','MONTH','DAY','SUBSTRING','SUBSTR','LENGTH',
  'TRIM','LTRIM','RTRIM','UPPER','LOWER','REPLACE','CONCAT','CONCAT_WS',
  'ROUND','FLOOR','CEIL','CEILING','ABS','MOD','POWER','SQRT','LOG','EXP',
  'TO_DATE','TO_CHAR','TO_NUMBER','CONVERT','PARSE','FORMAT','DATEADD','DATEDIFF',
  'EXTRACT','STRFTIME','JULIANDAY','TYPEOF','ROW_NUMBER','RANK','DENSE_RANK',
  'LEAD','LAG','FIRST_VALUE','LAST_VALUE','NTH_VALUE','NTILE',
]);

// ─── Tokenizer ────────────────────────────────────────────────────────────────

function tokenize(sql) {
  const tokens = [];
  let pos = 0;
  const len = sql.length;

  while (pos < len) {
    if (/\s/.test(sql[pos])) {
      const start = pos;
      while (pos < len && /\s/.test(sql[pos])) pos++;
      tokens.push({ type: T.WHITESPACE, value: sql.slice(start, pos) });
      continue;
    }
    if (sql[pos] === '-' && sql[pos + 1] === '-') {
      const start = pos;
      while (pos < len && sql[pos] !== '\n') pos++;
      tokens.push({ type: T.COMMENT_LINE, value: sql.slice(start, pos) });
      continue;
    }
    if (sql[pos] === '/' && sql[pos + 1] === '*') {
      const start = pos;
      pos += 2;
      while (pos < len && !(sql[pos] === '*' && sql[pos + 1] === '/')) pos++;
      pos += 2;
      tokens.push({ type: T.COMMENT_BLOCK, value: sql.slice(start, pos) });
      continue;
    }
    if (sql[pos] === "'" || sql[pos] === '"' || sql[pos] === '`') {
      const quote = sql[pos];
      const start = pos++;
      while (pos < len) {
        if (sql[pos] === '\\') { pos += 2; continue; }
        if (sql[pos] === quote) { pos++; break; }
        pos++;
      }
      tokens.push({ type: T.STRING, value: sql.slice(start, pos) });
      continue;
    }
    if (sql[pos] === '$') {
      const m = sql.slice(pos).match(/^\$([A-Za-z_]*)\$/);
      if (m) {
        const tag = m[0];
        const start = pos;
        pos += tag.length;
        const end = sql.indexOf(tag, pos);
        pos = end !== -1 ? end + tag.length : len;
        tokens.push({ type: T.STRING, value: sql.slice(start, pos) });
        continue;
      }
    }
    if (/[0-9]/.test(sql[pos]) || (sql[pos] === '.' && /[0-9]/.test(sql[pos + 1] || ''))) {
      const start = pos;
      if (sql[pos] === '0' && /[xX]/.test(sql[pos + 1] || '')) {
        pos += 2; while (pos < len && /[0-9a-fA-F]/.test(sql[pos])) pos++;
      } else {
        while (pos < len && /[0-9]/.test(sql[pos])) pos++;
        if (pos < len && sql[pos] === '.') { pos++; while (pos < len && /[0-9]/.test(sql[pos])) pos++; }
        if (pos < len && /[eE]/.test(sql[pos])) {
          pos++;
          if (pos < len && /[+-]/.test(sql[pos])) pos++;
          while (pos < len && /[0-9]/.test(sql[pos])) pos++;
        }
      }
      tokens.push({ type: T.NUMBER, value: sql.slice(start, pos) });
      continue;
    }
    if (/[A-Za-z_]/.test(sql[pos])) {
      const start = pos;
      while (pos < len && /[A-Za-z0-9_$]/.test(sql[pos])) pos++;
      const word = sql.slice(start, pos);
      const upper = word.toUpperCase();
      tokens.push({ type: KEYWORDS.has(upper) ? T.KEYWORD : T.IDENTIFIER, value: word, upper });
      continue;
    }
    const two = sql.slice(pos, pos + 2);
    if (['!=','<>','<=','>=','::','||','->>','->'].includes(two)) {
      tokens.push({ type: T.OPERATOR, value: two }); pos += 2; continue;
    }
    if ('=<>+-*/%~!^&|@#'.includes(sql[pos])) {
      tokens.push({ type: T.OPERATOR, value: sql[pos++] }); continue;
    }
    if ('(),;[].:{}'.includes(sql[pos])) {
      tokens.push({ type: T.PUNCTUATION, value: sql[pos++] }); continue;
    }
    tokens.push({ type: T.IDENTIFIER, value: sql[pos++] });
  }
  tokens.push({ type: T.EOF, value: '' });
  return tokens;
}

// ─── Statement Splitter ───────────────────────────────────────────────────────

function splitStatements(sql) {
  const stmts = [];
  let cur = '';
  let inStr = false, strCh = '', inLine = false, inBlock = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], n = sql[i + 1];
    if (inLine) { cur += c; if (c === '\n') inLine = false; continue; }
    if (inBlock) { cur += c; if (c === '*' && n === '/') { cur += '/'; i++; inBlock = false; } continue; }
    if (!inStr && c === '-' && n === '-') { inLine = true; cur += c; continue; }
    if (!inStr && c === '/' && n === '*') { inBlock = true; cur += c; continue; }
    if (!inStr && (c === "'" || c === '"' || c === '`')) { inStr = true; strCh = c; cur += c; continue; }
    if (inStr) { cur += c; if (c === '\\') { cur += sql[++i] || ''; continue; } if (c === strCh) inStr = false; continue; }
    if (c === ';') { cur += c; stmts.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) stmts.push(cur);
  return stmts;
}

// ─── Compound Keyword Resolver ────────────────────────────────────────────────

function resolveCompound(toks, i) {
  const t = toks[i];
  if (!t || t.type !== T.KEYWORD) return null;
  const u = t.upper || t.value.toUpperCase();
  const u1 = ((toks[i+1]||{}).upper) || (((toks[i+1]||{}).value)||'').toUpperCase();
  const u2 = ((toks[i+2]||{}).upper) || (((toks[i+2]||{}).value)||'').toUpperCase();

  if ((u==='GROUP'||u==='ORDER'||u==='PARTITION') && u1==='BY') return {c:u+' BY',n:1};
  if (u==='INSERT' && u1==='INTO') return {c:'INSERT INTO',n:1};
  if (u==='DELETE' && u1==='FROM') return {c:'DELETE FROM',n:1};
  if ((u==='CREATE'||u==='ALTER'||u==='DROP') && u1==='TABLE') return {c:u+' TABLE',n:1};
  if (u==='UNION' && u1==='ALL') return {c:'UNION ALL',n:1};
  if (['LEFT','RIGHT','FULL'].includes(u) && u1==='OUTER' && u2==='JOIN') return {c:u+' OUTER JOIN',n:2};
  if (['INNER','LEFT','RIGHT','FULL','CROSS','NATURAL'].includes(u) && u1==='JOIN') return {c:u+' JOIN',n:1};
  if (u==='IS' && u1==='NOT' && u2==='NULL') return {c:'IS NOT NULL',n:2};
  if (u==='IS' && u1==='NULL') return {c:'IS NULL',n:1};
  if (u==='NOT' && ['IN','EXISTS','LIKE','ILIKE','BETWEEN'].includes(u1)) return {c:'NOT '+u1,n:1};
  if (u==='NOT' && u1==='NULL') return {c:'NOT NULL',n:1};
  if (u==='IF' && u1==='NOT' && u2==='EXISTS') return {c:'IF NOT EXISTS',n:2};
  if (u==='IF' && u1==='EXISTS') return {c:'IF EXISTS',n:1};
  if (u==='PRIMARY' && u1==='KEY') return {c:'PRIMARY KEY',n:1};
  if (u==='FOREIGN' && u1==='KEY') return {c:'FOREIGN KEY',n:1};
  if (u==='ON' && u1==='DELETE') return {c:'ON DELETE',n:1};
  if (u==='ON' && u1==='UPDATE') return {c:'ON UPDATE',n:1};
  return {c:u,n:0};
}

function innerLen(toks, i) {
  let len=0, d=1;
  for (let k=i+1; k<toks.length&&d>0; k++) {
    const v = toks[k].value;
    if (v==='(') d++; else if (v===')') { d--; if (d===0) break; }
    else if (toks[k].type!==T.WHITESPACE) len += v.length+1;
  }
  return len;
}

function parenHasClauses(toks, i) {
  let d=1;
  for (let k=i+1; k<toks.length; k++) {
    const t=toks[k];
    if (t.value==='(') d++; else if (t.value===')') { d--; if(d===0) break; }
    else if (t.type===T.KEYWORD && d===1) {
      const r=resolveCompound(toks,k);
      if (r && CLAUSE_STARTERS.has(r.c)) return true;
    }
  }
  return false;
}

// ─── Core Formatter ───────────────────────────────────────────────────────────

function applyCase(word, upper, lower) {
  if (upper) return word.toUpperCase();
  if (lower) return word.toLowerCase();
  return word;
}

function formatStatement(rawSql, indentStr, upper, lower, dialect) {
  if (!rawSql.trim()) return '';

  // Separate leading standalone comments
  let commentPrefix = '';
  let body = rawSql;
  const commentLines = [];
  const commentRe = /^[ \t]*(--[^\n]*\n?|\/\*[\s\S]*?\*\/[ \t]*\n?)/;
  let m;
  while ((m = commentRe.exec(body))) {
    commentLines.push(m[1].trim());
    body = body.slice(m[0].length);
  }
  if (commentLines.length) commentPrefix = commentLines.join('\n') + '\n';

  body = body.trim();
  if (!body) return commentPrefix.trimEnd();

  const raw = tokenize(body);
  const toks = raw.filter(t => t.type !== T.WHITESPACE && t.type !== T.EOF);
  if (!toks.length) return commentPrefix.trimEnd();

  const kw = (w) => applyCase(w, upper, lower);

  // Output: array of {text, newlineBefore, indent, spaceAfter, spaceBefore, nospaceLeft, nospaceRight}
  const parts = [];

  const inlineStack = []; // bool stack: is current paren group inline?
  let depth = 0;

  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    const next = toks[i + 1];

    if (tok.type === T.COMMENT_LINE || tok.type === T.COMMENT_BLOCK) {
      parts.push({ text: tok.value, newlineBefore: true, newlineAfter: true, indent: depth });
      continue;
    }

    if (tok.type === T.KEYWORD) {
      const r = resolveCompound(toks, i);
      const compound = r ? r.c : (tok.upper || tok.value.toUpperCase());
      const consume = r ? r.n : 0;

      const isClause = CLAUSE_STARTERS.has(compound) && depth === 0;
      const isFunc = FUNC_KEYWORDS.has(compound);
      const nextIsOpenParen = next && next.type === T.PUNCTUATION && next.value === '(';

      parts.push({
        text: compound.split(' ').map(w => kw(w)).join(' '),
        newlineBefore: isClause,
        indent: depth,
        spaceAfter: !isFunc || !nextIsOpenParen,
        spaceBefore: true,
      });
      i += consume;
      continue;
    }

    if (tok.type === T.PUNCTUATION && tok.value === '(') {
      const inline = innerLen(toks, i) < 50 && !parenHasClauses(toks, i);
      inlineStack.push(inline);
      depth++;
      // Check if prev was a func keyword (no space before paren)
      const prevPart = parts[parts.length - 1];
      const noSpaceBefore = prevPart && prevPart.spaceAfter === false;
      parts.push({
        text: '(',
        nospaceLeft: noSpaceBefore,
        indent: depth - 1,
        newlineAfter: !inline,
        newIndent: depth,
      });
      continue;
    }

    if (tok.type === T.PUNCTUATION && tok.value === ')') {
      const wasInline = inlineStack.pop();
      depth = Math.max(0, depth - 1);
      parts.push({ text: ')', newlineBefore: !wasInline, indent: depth, nospaceLeft: true });
      continue;
    }

    if (tok.type === T.PUNCTUATION && tok.value === ',') {
      parts.push({ text: ',', nospaceLeft: true, newlineAfter: true, indent: depth });
      continue;
    }

    if (tok.type === T.PUNCTUATION && tok.value === ';') {
      parts.push({ text: ';', nospaceLeft: true });
      continue;
    }

    if (tok.type === T.PUNCTUATION && tok.value === '.') {
      parts.push({ text: '.', nospaceLeft: true, nospaceRight: true });
      continue;
    }

    if (tok.type === T.PUNCTUATION) {
      parts.push({ text: tok.value });
      continue;
    }

    if (tok.type === T.OPERATOR) {
      if (tok.value === '::') {
        parts.push({ text: '::', nospaceLeft: true, nospaceRight: true });
      } else {
        parts.push({ text: tok.value, spaceBefore: true, spaceAfter: true });
      }
      continue;
    }

    // identifier / string / number
    const prevPart = parts[parts.length - 1];
    const noLeft = prevPart && prevPart.nospaceRight;
    parts.push({ text: tok.value, nospaceLeft: noLeft });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  let result = commentPrefix || '';
  let line = '';
  let lineIndent = 0;

  const startLine = (indent) => {
    if (line.trim()) result += line.trimEnd() + '\n';
    lineIndent = indent;
    line = indentStr.repeat(indent);
  };

  const appendText = (text, noLeft) => {
    const lineIsBlank = line.trim() === '';
    if (!lineIsBlank && !noLeft && !line.endsWith(' ') && !line.endsWith('(')) {
      line += ' ';
    } else if (!lineIsBlank && noLeft && line.endsWith(' ')) {
      line = line.slice(0, -1);
    }
    line += text;
  };

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const next = parts[i + 1];

    if (p.newlineBefore && line.trim()) {
      startLine(p.indent || 0);
    }

    if (p.text === '') {
      if (p.newlineAfter) startLine(p.newIndent || lineIndent);
      continue;
    }

    appendText(p.text, p.nospaceLeft);

    if (p.nospaceRight) {
      // nothing — next token handles no-space-before
    } else if (p.spaceAfter === true) {
      if (!line.endsWith(' ')) line += ' ';
    }

    if (p.newlineAfter) {
      startLine(p.newIndent !== undefined ? p.newIndent : (p.indent || 0));
    }
  }

  if (line.trim()) result += line.trimEnd();
  return result.trimEnd();
}

// ─── Public API ───────────────────────────────────────────────────────────────

function formatSQL(sql, opts = {}) {
  const { indent=2, uppercase=false, lowercase=false, dialect='generic' } = opts;
  const indentStr = ' '.repeat(indent);
  const statements = splitStatements(sql);
  return statements
    .map(stmt => formatStatement(stmt.trim(), indentStr, uppercase, lowercase, dialect))
    .filter(Boolean)
    .join('\n\n');
}

// ─── File helpers ─────────────────────────────────────────────────────────────

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) { resolve(null); return; }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => { data += c; });
    process.stdin.on('end', () => resolve(data));
  });
}

function formatFile(filePath, opts) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const formatted = formatSQL(sql, opts);
  const changed = formatted !== sql && formatted !== sql.trim();
  return { original: sql, formatted, changed, lines: { before: sql.split('\n').length, after: formatted.split('\n').length } };
}

function watchFile(filePath, opts) {
  console.error('Watching ' + filePath + ' for changes...');
  fs.watch(filePath, { persistent: true }, (event) => {
    if (event !== 'change') return;
    try {
      const { formatted, changed } = formatFile(filePath, opts);
      if (changed) { fs.writeFileSync(filePath, formatted, 'utf8'); console.error('[' + new Date().toISOString() + '] Formatted: ' + filePath); }
    } catch (err) { console.error('Error: ' + err.message); }
  });
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const HELP = `sql-formatter v1.0.0 — Format and pretty-print SQL queries

USAGE
  sql-formatter <file.sql>                  Format a SQL file (prints to stdout)
  sql-formatter <file.sql> --output out.sql Write formatted SQL to file
  sql-formatter <dir>                       Format all .sql files in directory
  echo "SELECT 1" | sql-formatter           Read from stdin

OPTIONS
  --dialect <name>  SQL dialect: mysql|postgres|sqlite|mssql|generic (default: generic)
  --indent <n>      Indent size in spaces (default: 2)
  --uppercase       Uppercase SQL keywords
  --lowercase       Lowercase SQL keywords
  --output <file>   Write output to file instead of stdout
  --check           Exit 1 if file(s) not formatted (for CI)
  --watch           Watch file and auto-format on change
  --json            Output metadata as JSON
  --help, -h        Show this help
  --version, -v     Show version

EXAMPLES
  sql-formatter query.sql
  sql-formatter query.sql --uppercase --indent 4
  sql-formatter query.sql --output formatted.sql
  sql-formatter . --check
  echo "select id,name from users where id=1" | sql-formatter --uppercase
  sql-formatter query.sql --dialect postgres --json

SUPPORTED DIALECTS
  generic (default), mysql, postgres, sqlite, mssql
`;

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { process.stdout.write(HELP); process.exit(0); }
  if (args.includes('--version') || args.includes('-v')) { process.stdout.write('1.0.0\n'); process.exit(0); }

  const opts = { dialect:'generic', indent:2, uppercase:false, lowercase:false };
  const flags = { output:null, check:false, watch:false, json:false };
  const positionals = [];

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dialect':   opts.dialect   = args[++i] || 'generic'; break;
      case '--indent':    opts.indent    = parseInt(args[++i], 10) || 2; break;
      case '--uppercase': opts.uppercase = true; break;
      case '--lowercase': opts.lowercase = true; break;
      case '--output':    flags.output   = args[++i]; break;
      case '--check':     flags.check    = true; break;
      case '--watch':     flags.watch    = true; break;
      case '--json':      flags.json     = true; break;
      default: if (!args[i].startsWith('--')) positionals.push(args[i]);
    }
  }

  if (opts.uppercase && opts.lowercase) { console.error('Error: --uppercase and --lowercase are mutually exclusive'); process.exit(1); }
  const VALID = new Set(['mysql','postgres','sqlite','mssql','generic']);
  if (!VALID.has(opts.dialect)) { console.error('Error: unknown dialect "' + opts.dialect + '"'); process.exit(1); }

  if (positionals.length === 0) {
    const stdinData = await readStdin();
    if (!stdinData || !stdinData.trim()) { process.stdout.write(HELP); process.exit(0); }
    const formatted = formatSQL(stdinData, opts);
    if (flags.json) {
      process.stdout.write(JSON.stringify({ source:'stdin', changed: formatted !== stdinData, linesBefore: stdinData.split('\n').length, linesAfter: formatted.split('\n').length }, null, 2) + '\n');
    } else {
      process.stdout.write(formatted + '\n');
    }
    return;
  }

  const targetPath = path.resolve(positionals[0]);
  if (!fs.existsSync(targetPath)) { console.error('Error: not found: ' + targetPath); process.exit(1); }
  const stat = fs.statSync(targetPath);

  if (stat.isDirectory()) {
    const sqlFiles = fs.readdirSync(targetPath).filter(f => f.endsWith('.sql')).map(f => path.join(targetPath, f));
    if (!sqlFiles.length) { console.error('No .sql files in ' + targetPath); process.exit(0); }
    let anyUnformatted = false;
    const results = [];
    for (const file of sqlFiles) {
      const { formatted, changed, lines } = formatFile(file, opts);
      if (!flags.check && changed) fs.writeFileSync(file, formatted, 'utf8');
      if (flags.check && changed) anyUnformatted = true;
      results.push({ file, changed, linesBefore: lines.before, linesAfter: lines.after });
    }
    if (flags.json) { process.stdout.write(JSON.stringify(results, null, 2) + '\n'); }
    else if (flags.check) { for (const r of results) console.error((r.changed ? '✗' : '✓') + ' ' + r.file); }
    else { for (const r of results) if (r.changed) console.error('Formatted: ' + r.file); }
    if (flags.check && anyUnformatted) process.exit(1);
    return;
  }

  if (!stat.isFile()) { console.error('Error: not a file: ' + targetPath); process.exit(1); }
  if (flags.watch) { watchFile(targetPath, opts); return; }

  const { formatted, changed, lines } = formatFile(targetPath, opts);

  if (flags.json) {
    process.stdout.write(JSON.stringify({ file: targetPath, changed, linesBefore: lines.before, linesAfter: lines.after }, null, 2) + '\n');
    return;
  }
  if (flags.check) {
    console.error((changed ? '✗ Not formatted' : '✓ Already formatted') + ': ' + targetPath);
    if (changed) process.exit(1);
    return;
  }
  if (flags.output) {
    const outPath = path.resolve(flags.output);
    fs.writeFileSync(outPath, formatted, 'utf8');
    console.error('Written to: ' + outPath);
  } else {
    process.stdout.write(formatted + '\n');
  }
}

main().catch(err => { console.error('Fatal: ' + err.message); process.exit(1); });
