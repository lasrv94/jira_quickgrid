import type { CustomColumn, JiraIssue } from '../types';

/**
 * Extracts a normalized string or number value from an issue for a given field name or ID.
 */
export function getFieldValueForFormula(
  issue: JiraIssue,
  fieldRef: string,
  columns: CustomColumn[] = []
): any {
  if (!issue || !fieldRef) return null;
  const ref = fieldRef.trim().toLowerCase();

  // 1. Direct standard Jira issue fields
  if (ref === 'key' || ref === 'clave' || ref === 'id') return issue.key;
  if (ref === 'summary' || ref === 'titulo' || ref === 'title') return issue.summary;
  if (ref === 'jira_status' || ref === 'status' || ref === 'estado') return issue.jira_status;
  if (ref === 'priority' || ref === 'prioridad') return issue.priority;
  if (ref === 'issue_type' || ref === 'type' || ref === 'tipo') return issue.issue_type;
  if (ref === 'assignee' || ref === 'assignee_name' || ref === 'asignado') return issue.assignee_name || '';
  if (ref === 'reporter' || ref === 'reporter_name' || ref === 'reportador') return issue.reporter_name || '';

  // 2. Local custom column check by ID or Name
  const matchedCol = columns.find(
    (c) => c.id.toLowerCase() === ref || c.name.toLowerCase() === ref
  );

  if (matchedCol) {
    if (matchedCol.jira_field_key && issue.raw_jira_fields) {
      const raw = issue.raw_jira_fields[matchedCol.jira_field_key];
      if (raw !== undefined && raw !== null) {
        if (typeof raw === 'object') return raw.value || raw.name || raw.displayName || JSON.stringify(raw);
        return raw;
      }
    }
    const customVal = issue.custom_values?.[matchedCol.id];
    if (customVal !== undefined && customVal !== null) {
      if (matchedCol.type === 'single_select' && matchedCol.options) {
        const opt = matchedCol.options.find((o) => o.id === customVal);
        return opt ? opt.label : customVal;
      }
      return customVal;
    }
  }

  // 3. Check custom_values directly
  if (issue.custom_values && issue.custom_values[fieldRef] !== undefined) {
    return issue.custom_values[fieldRef];
  }

  // 4. Check raw_jira_fields directly
  if (issue.raw_jira_fields) {
    for (const [k, v] of Object.entries(issue.raw_jira_fields)) {
      if (k.toLowerCase() === ref) {
        if (typeof v === 'object' && v !== null) return (v as any).value || (v as any).name || JSON.stringify(v);
        return v;
      }
    }
  }

  return null;
}

// ----------------- AST DEFINITIONS -----------------

export type ASTNode =
  | { type: 'Literal'; value: any }
  | { type: 'Field'; fieldName: string }
  | { type: 'BinaryOp'; op: string; left: ASTNode; right: ASTNode }
  | { type: 'UnaryOp'; op: string; operand: ASTNode }
  | { type: 'If'; condition: ASTNode; thenBranch: ASTNode; elseBranch: ASTNode }
  | { type: 'Call'; functionName: string; args: ASTNode[] };

// ----------------- TOKENIZER -----------------

type TokenType =
  | 'KEYWORD'
  | 'IDENTIFIER'
  | 'FIELD'
  | 'STRING'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'OP_COMPARE'
  | 'OP_MATH'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
}

const KNOWN_KEYWORDS = new Set([
  'IF',
  'IFS',
  'SWITCH',
  'IS_EMPTY',
  'NOT_EMPTY',
  'CONTAINS',
  'UPPER',
  'LOWER',
  'CONCAT',
  'LEN',
  'TRIM',
  'ROUND',
  'COALESCE',
  'AND',
  'OR',
  'NOT',
]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    // Whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Field reference: {field_name}
    if (ch === '{') {
      let field = '';
      i++;
      while (i < len && input[i] !== '}') {
        field += input[i];
        i++;
      }
      if (i < len && input[i] === '}') i++;
      tokens.push({ type: 'FIELD', value: field.trim() });
      continue;
    }

    // Quoted strings: "string" or 'string'
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let str = '';
      i++;
      while (i < len && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < len) {
          str += input[i + 1];
          i += 2;
        } else {
          str += input[i];
          i++;
        }
      }
      if (i < len && input[i] === quote) i++;
      tokens.push({ type: 'STRING', value: str });
      continue;
    }

    // Parentheses & Comma
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ',' });
      i++;
      continue;
    }

    // Comparison Operators: ==, !=, <=, >=, <>, =, <, >
    if (ch === '=' || ch === '!' || ch === '<' || ch === '>') {
      const next = i + 1 < len ? input[i + 1] : '';
      if (
        (ch === '=' && next === '=') ||
        (ch === '!' && next === '=') ||
        (ch === '<' && next === '=') ||
        (ch === '>' && next === '=') ||
        (ch === '<' && next === '>')
      ) {
        tokens.push({ type: 'OP_COMPARE', value: ch + next });
        i += 2;
        continue;
      }
      if (ch === '!') {
        tokens.push({ type: 'KEYWORD', value: 'NOT' });
        i++;
        continue;
      }
      tokens.push({ type: 'OP_COMPARE', value: ch });
      i++;
      continue;
    }

    // Math Operators: +, -, *, /
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'OP_MATH', value: ch });
      i++;
      continue;
    }

    // Logical Operators: &&, ||
    if (ch === '&' && i + 1 < len && input[i + 1] === '&') {
      tokens.push({ type: 'KEYWORD', value: 'AND' });
      i += 2;
      continue;
    }
    if (ch === '|' && i + 1 < len && input[i + 1] === '|') {
      tokens.push({ type: 'KEYWORD', value: 'OR' });
      i += 2;
      continue;
    }

    // Numbers: 123, 123.45
    if (/[0-9]/.test(ch)) {
      let num = '';
      while (i < len && /[0-9.]/.test(input[i])) {
        num += input[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: num });
      continue;
    }

    // Identifiers & Unicode words (supports Spanish accents á, é, í, ó, ú, ñ, etc.)
    if (/[\p{L}_]/u.test(ch)) {
      let id = '';
      while (i < len && /[\p{L}0-9_]/u.test(input[i])) {
        id += input[i];
        i++;
      }
      const upper = id.toUpperCase();
      if (upper === 'TRUE' || upper === 'FALSE') {
        tokens.push({ type: 'BOOLEAN', value: upper });
      } else if (KNOWN_KEYWORDS.has(upper)) {
        tokens.push({ type: 'KEYWORD', value: upper });
      } else {
        tokens.push({ type: 'IDENTIFIER', value: id });
      }
      continue;
    }

    // Any other character fallback
    i++;
  }

  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}

// ----------------- PARSER -----------------

export class FormulaParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos] || { type: 'EOF', value: '' };
  }

  private consume(expectedType?: TokenType, expectedValue?: string): Token {
    const t = this.peek();
    if (expectedType && t.type !== expectedType) {
      throw new Error(`Se esperaba '${expectedType}' pero se encontró '${t.type}' (${t.value})`);
    }
    if (expectedValue && t.value.toUpperCase() !== expectedValue.toUpperCase()) {
      throw new Error(`Se esperaba '${expectedValue}' pero se encontró '${t.value}'`);
    }
    this.pos++;
    return t;
  }

  public parse(): ASTNode {
    if (this.peek().type === 'EOF') {
      return { type: 'Literal', value: null };
    }
    const node = this.parseLogicalOr();
    return node;
  }

  private parseLogicalOr(): ASTNode {
    let left = this.parseLogicalAnd();
    while (this.peek().type === 'KEYWORD' && this.peek().value.toUpperCase() === 'OR') {
      this.consume('KEYWORD');
      const right = this.parseLogicalAnd();
      left = { type: 'BinaryOp', op: 'OR', left, right };
    }
    return left;
  }

  private parseLogicalAnd(): ASTNode {
    let left = this.parseComparison();
    while (this.peek().type === 'KEYWORD' && this.peek().value.toUpperCase() === 'AND') {
      this.consume('KEYWORD');
      const right = this.parseComparison();
      left = { type: 'BinaryOp', op: 'AND', left, right };
    }
    return left;
  }

  private parseComparison(): ASTNode {
    let left = this.parseAdditive();

    const t = this.peek();
    if (t.type === 'OP_COMPARE' || (t.type === 'KEYWORD' && t.value.toUpperCase() === 'CONTAINS')) {
      const op = this.consume().value.toUpperCase();
      const right = this.parseAdditive();
      return { type: 'BinaryOp', op, left, right };
    }

    return left;
  }

  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative();
    while (this.peek().type === 'OP_MATH' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.consume().value;
      const right = this.parseMultiplicative();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  private parseMultiplicative(): ASTNode {
    let left = this.parseUnary();
    while (this.peek().type === 'OP_MATH' && (this.peek().value === '*' || this.peek().value === '/')) {
      const op = this.consume().value;
      const right = this.parseUnary();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  private parseUnary(): ASTNode {
    const t = this.peek();
    if (t.type === 'KEYWORD' && t.value.toUpperCase() === 'NOT') {
      this.consume('KEYWORD');
      const operand = this.parseUnary();
      return { type: 'UnaryOp', op: 'NOT', operand };
    }
    if (t.type === 'OP_MATH' && t.value === '-') {
      this.consume('OP_MATH');
      const operand = this.parseUnary();
      return { type: 'UnaryOp', op: '-', operand };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    const t = this.peek();

    // 1. IF(condition, thenExpr, elseExpr)
    if (t.type === 'KEYWORD' && t.value.toUpperCase() === 'IF') {
      this.consume('KEYWORD');
      this.consume('LPAREN');
      const condition = this.parseLogicalOr();
      this.consume('COMMA');
      const thenBranch = this.parseLogicalOr();
      this.consume('COMMA');
      const elseBranch = this.parseLogicalOr();
      this.consume('RPAREN');
      return { type: 'If', condition, thenBranch, elseBranch };
    }

    // 2. Generic function calls: IFS(...), SWITCH(...), IS_EMPTY(...), NOT_EMPTY(...), CONCAT(...), etc.
    if (t.type === 'KEYWORD' || (t.type === 'IDENTIFIER' && this.tokens[this.pos + 1]?.type === 'LPAREN')) {
      const fnName = this.consume().value.toUpperCase();
      this.consume('LPAREN');
      const args: ASTNode[] = [];
      if (this.peek().type !== 'RPAREN') {
        args.push(this.parseLogicalOr());
        while (this.peek().type === 'COMMA') {
          this.consume('COMMA');
          args.push(this.parseLogicalOr());
        }
      }
      this.consume('RPAREN');
      return { type: 'Call', functionName: fnName, args };
    }

    // 3. Field reference: {priority}, {summary}, {custom_col}
    if (t.type === 'FIELD') {
      this.consume('FIELD');
      return { type: 'Field', fieldName: t.value };
    }

    // 4. Number Literal
    if (t.type === 'NUMBER') {
      this.consume('NUMBER');
      return { type: 'Literal', value: Number(t.value) };
    }

    // 5. String Literal: "Aprobado", 'High'
    if (t.type === 'STRING') {
      this.consume('STRING');
      return { type: 'Literal', value: t.value };
    }

    // 6. Boolean Literal: TRUE, FALSE
    if (t.type === 'BOOLEAN') {
      this.consume('BOOLEAN');
      return { type: 'Literal', value: t.value === 'TRUE' };
    }

    // 7. Unquoted Identifier (treated gracefully as string literal or field name)
    if (t.type === 'IDENTIFIER') {
      this.consume('IDENTIFIER');
      // If user typed consecutive words without quotes like `En Revisión`
      let combined = t.value;
      while (this.peek().type === 'IDENTIFIER') {
        combined += ' ' + this.consume('IDENTIFIER').value;
      }
      return { type: 'Literal', value: combined };
    }

    // 8. Parenthesized expression: (expr)
    if (t.type === 'LPAREN') {
      this.consume('LPAREN');
      const expr = this.parseLogicalOr();
      this.consume('RPAREN');
      return expr;
    }

    // Fallback error
    throw new Error(`Token inesperado en la fórmula: ${t.type} (${t.value})`);
  }
}

// ----------------- EVALUATOR -----------------

export function evaluateAST(
  node: ASTNode,
  issue: JiraIssue,
  columns: CustomColumn[] = []
): any {
  if (!node) return null;

  switch (node.type) {
    case 'Literal':
      return node.value;

    case 'Field':
      return getFieldValueForFormula(issue, node.fieldName, columns);

    case 'UnaryOp': {
      const val = evaluateAST(node.operand, issue, columns);
      if (node.op === 'NOT') return !val;
      if (node.op === '-') return -Number(val);
      return val;
    }

    case 'If': {
      // Lazy evaluation: only evaluates the selected branch!
      const cond = evaluateAST(node.condition, issue, columns);
      if (Boolean(cond)) {
        return evaluateAST(node.thenBranch, issue, columns);
      } else {
        return evaluateAST(node.elseBranch, issue, columns);
      }
    }

    case 'BinaryOp': {
      const op = node.op.toUpperCase();

      // Short-circuit logical operators
      if (op === 'AND') {
        const leftVal = evaluateAST(node.left, issue, columns);
        if (!leftVal) return false;
        return Boolean(evaluateAST(node.right, issue, columns));
      }
      if (op === 'OR') {
        const leftVal = evaluateAST(node.left, issue, columns);
        if (leftVal) return true;
        return Boolean(evaluateAST(node.right, issue, columns));
      }

      const left = evaluateAST(node.left, issue, columns);
      const right = evaluateAST(node.right, issue, columns);

      // Math
      if (op === '+') {
        const numL = Number(left);
        const numR = Number(right);
        if (!isNaN(numL) && !isNaN(numR) && left !== '' && right !== '' && left !== null && right !== null) {
          return numL + numR;
        }
        return String(left ?? '') + String(right ?? '');
      }
      if (op === '-') return Number(left) - Number(right);
      if (op === '*') return Number(left) * Number(right);
      if (op === '/') return Number(right) === 0 ? 0 : Number(left) / Number(right);

      // Comparisons
      const strL = left === null || left === undefined ? '' : String(left).toLowerCase().trim();
      const strR = right === null || right === undefined ? '' : String(right).toLowerCase().trim();
      const numL = Number(left);
      const numR = Number(right);
      const bothNumeric = !isNaN(numL) && !isNaN(numR) && strL !== '' && strR !== '';

      switch (op) {
        case '=':
        case '==':
          return bothNumeric ? numL === numR : strL === strR;
        case '!=':
        case '<>':
          return bothNumeric ? numL !== numR : strL !== strR;
        case '>':
          return bothNumeric ? numL > numR : strL > strR;
        case '>=':
          return bothNumeric ? numL >= numR : strL >= strR;
        case '<':
          return bothNumeric ? numL < numR : strL < strR;
        case '<=':
          return bothNumeric ? numL <= numR : strL <= strR;
        case 'CONTAINS':
          return strL.includes(strR);
        default:
          return false;
      }
    }

    case 'Call': {
      const fn = node.functionName;

      if (fn === 'IS_EMPTY') {
        const val = evaluateAST(node.args[0], issue, columns);
        return val === null || val === undefined || String(val).trim() === '';
      }

      if (fn === 'NOT_EMPTY') {
        const val = evaluateAST(node.args[0], issue, columns);
        return val !== null && val !== undefined && String(val).trim() !== '';
      }

      if (fn === 'CONTAINS') {
        const text = String(evaluateAST(node.args[0], issue, columns) ?? '').toLowerCase();
        const search = String(evaluateAST(node.args[1], issue, columns) ?? '').toLowerCase();
        return text.includes(search);
      }

      if (fn === 'IFS') {
        // IFS(cond1, val1, cond2, val2, ..., defaultVal)
        for (let i = 0; i < node.args.length - 1; i += 2) {
          const cond = evaluateAST(node.args[i], issue, columns);
          if (Boolean(cond)) {
            return evaluateAST(node.args[i + 1], issue, columns);
          }
        }
        // If odd number of arguments, last is the default fallback
        if (node.args.length % 2 === 1) {
          return evaluateAST(node.args[node.args.length - 1], issue, columns);
        }
        return null;
      }

      if (fn === 'SWITCH') {
        // SWITCH(testVal, case1, res1, case2, res2, ..., defaultVal)
        if (node.args.length < 2) return null;
        const testVal = evaluateAST(node.args[0], issue, columns);
        const testStr = String(testVal ?? '').toLowerCase().trim();

        for (let i = 1; i < node.args.length - 1; i += 2) {
          const caseVal = evaluateAST(node.args[i], issue, columns);
          const caseStr = String(caseVal ?? '').toLowerCase().trim();
          if (testStr === caseStr) {
            return evaluateAST(node.args[i + 1], issue, columns);
          }
        }
        // If default present
        if (node.args.length % 2 === 0) {
          return evaluateAST(node.args[node.args.length - 1], issue, columns);
        }
        return null;
      }

      if (fn === 'CONCAT') {
        return node.args.map((a) => String(evaluateAST(a, issue, columns) ?? '')).join('');
      }

      if (fn === 'UPPER') {
        return String(evaluateAST(node.args[0], issue, columns) ?? '').toUpperCase();
      }

      if (fn === 'LOWER') {
        return String(evaluateAST(node.args[0], issue, columns) ?? '').toLowerCase();
      }

      if (fn === 'TRIM') {
        return String(evaluateAST(node.args[0], issue, columns) ?? '').trim();
      }

      if (fn === 'LEN') {
        return String(evaluateAST(node.args[0], issue, columns) ?? '').length;
      }

      if (fn === 'ROUND') {
        const num = Number(evaluateAST(node.args[0], issue, columns));
        const dec = node.args[1] ? Number(evaluateAST(node.args[1], issue, columns)) : 0;
        return isNaN(num) ? 0 : Number(num.toFixed(dec));
      }

      if (fn === 'COALESCE') {
        for (const arg of node.args) {
          const val = evaluateAST(arg, issue, columns);
          if (val !== null && val !== undefined && String(val).trim() !== '') {
            return val;
          }
        }
        return null;
      }

      return null;
    }
  }

  return null;
}

// ----------------- PUBLIC API -----------------

/**
 * Safely evaluates a formula expression for an issue.
 */
export function evaluateFormula(
  formula: string | undefined | null,
  issue: JiraIssue,
  columns: CustomColumn[] = []
): string | number | boolean | null {
  if (!formula || !formula.trim()) return null;

  try {
    const tokens = tokenize(formula);
    const parser = new FormulaParser(tokens);
    const ast = parser.parse();
    const result = evaluateAST(ast, issue, columns);
    return result;
  } catch (err) {
    return 'Error: Formula';
  }
}

/**
 * Validates syntax of a formula expression.
 */
export function validateFormula(formula: string): { valid: boolean; error?: string } {
  if (!formula || !formula.trim()) {
    return { valid: false, error: 'La fórmula no puede estar vacía' };
  }

  try {
    const tokens = tokenize(formula);
    const parser = new FormulaParser(tokens);
    parser.parse();
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Error de sintaxis en la fórmula' };
  }
}

/**
 * Helper to build an IF condition formula string from UI fields with smart operand quoting.
 */
export function buildIfFormula(
  fieldId: string,
  operator: string,
  compareValue: string,
  trueVal: string,
  falseVal: string
): string {
  const safeField = fieldId ? (fieldId.startsWith('{') ? fieldId : `{${fieldId}}`) : '{priority}';

  const formatOperand = (val: string): string => {
    const trimmed = (val ?? '').trim();
    if (!trimmed) return '""';
    // Numbers: e.g. 1, 0, -5, 3.14
    if (/^-?[0-9]+(\.[0-9]+)?$/.test(trimmed)) return trimmed;
    // Already quoted: e.g. "Aprobado" or 'Aprobado'
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed;
    }
    // Field reference: e.g. {assignee} or {summary}
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed;
    }
    // Boolean keywords: TRUE, FALSE
    if (trimmed.toUpperCase() === 'TRUE' || trimmed.toUpperCase() === 'FALSE') {
      return trimmed.toUpperCase();
    }
    // Nested formula or function call: e.g. IF(...), CONCAT(...)
    if (/^[A-Za-z_]+\(.*\)$/.test(trimmed)) {
      return trimmed;
    }
    // Otherwise, wrap in quotes cleanly
    return `"${trimmed.replace(/"/g, '\\"')}"`;
  };

  const formattedTrue = formatOperand(trueVal);
  const formattedFalse = formatOperand(falseVal);

  if (operator === 'IS_EMPTY') {
    return `IF(IS_EMPTY(${safeField}), ${formattedTrue}, ${formattedFalse})`;
  }
  if (operator === 'NOT_EMPTY') {
    return `IF(NOT_EMPTY(${safeField}), ${formattedTrue}, ${formattedFalse})`;
  }

  const formattedCompare = formatOperand(compareValue);
  return `IF(${safeField} ${operator} ${formattedCompare}, ${formattedTrue}, ${formattedFalse})`;
}
