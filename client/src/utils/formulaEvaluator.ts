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

// Token Types for safe Lexer
type TokenType =
  | 'IF'
  | 'IS_EMPTY'
  | 'NOT_EMPTY'
  | 'CONTAINS'
  | 'AND'
  | 'OR'
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

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

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
      if ((ch === '=' && next === '=') || (ch === '!' && next === '=') || (ch === '<' && next === '=') || (ch === '>' && next === '=') || (ch === '<' && next === '>')) {
        tokens.push({ type: 'OP_COMPARE', value: ch + next });
        i += 2;
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
      tokens.push({ type: 'AND', value: '&&' });
      i += 2;
      continue;
    }
    if (ch === '|' && i + 1 < len && input[i + 1] === '|') {
      tokens.push({ type: 'OR', value: '||' });
      i += 2;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch)) {
      let num = '';
      while (i < len && /[0-9.]/.test(input[i])) {
        num += input[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: num });
      continue;
    }

    // Identifiers or keywords
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < len && /[a-zA-Z0-9_]/.test(input[i])) {
        id += input[i];
        i++;
      }
      const upper = id.toUpperCase();
      if (upper === 'IF') {
        tokens.push({ type: 'IF', value: 'IF' });
      } else if (upper === 'AND') {
        tokens.push({ type: 'AND', value: 'AND' });
      } else if (upper === 'OR') {
        tokens.push({ type: 'OR', value: 'OR' });
      } else if (upper === 'IS_EMPTY') {
        tokens.push({ type: 'IS_EMPTY', value: 'IS_EMPTY' });
      } else if (upper === 'NOT_EMPTY') {
        tokens.push({ type: 'NOT_EMPTY', value: 'NOT_EMPTY' });
      } else if (upper === 'CONTAINS') {
        tokens.push({ type: 'CONTAINS', value: 'CONTAINS' });
      } else if (upper === 'TRUE' || upper === 'FALSE') {
        tokens.push({ type: 'BOOLEAN', value: upper });
      } else {
        // Treat bare word identifier as string or field
        tokens.push({ type: 'STRING', value: id });
      }
      continue;
    }

    i++;
  }

  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}

/**
 * Safe Recursive Descent Evaluator for Formulas.
 */
class FormulaParser {
  private tokens: Token[];
  private pos = 0;
  private issue: JiraIssue;
  private columns: CustomColumn[];

  constructor(tokens: Token[], issue: JiraIssue, columns: CustomColumn[]) {
    this.tokens = tokens;
    this.issue = issue;
    this.columns = columns;
  }

  private peek(): Token {
    return this.tokens[this.pos] || { type: 'EOF', value: '' };
  }

  private consume(expected?: TokenType): Token {
    const t = this.peek();
    if (expected && t.type !== expected) {
      throw new Error(`Expected token ${expected} but got ${t.type} (${t.value})`);
    }
    this.pos++;
    return t;
  }

  public parse(): any {
    if (this.peek().type === 'EOF') return null;
    const res = this.parseExpression();
    return res;
  }

  private parseExpression(): any {
    return this.parseLogicalOr();
  }

  private parseLogicalOr(): any {
    let left = this.parseLogicalAnd();
    while (this.peek().type === 'OR') {
      this.consume('OR');
      const right = this.parseLogicalAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  private parseLogicalAnd(): any {
    let left = this.parseComparison();
    while (this.peek().type === 'AND') {
      this.consume('AND');
      const right = this.parseComparison();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  private parseComparison(): any {
    let left = this.parseAdditive();

    const t = this.peek();
    if (t.type === 'OP_COMPARE' || t.type === 'CONTAINS') {
      const op = this.consume().value.toUpperCase();
      const right = this.parseAdditive();

      const strLeft = left === null || left === undefined ? '' : String(left).toLowerCase().trim();
      const strRight = right === null || right === undefined ? '' : String(right).toLowerCase().trim();
      const numLeft = Number(left);
      const numRight = Number(right);
      const bothNumeric = !isNaN(numLeft) && !isNaN(numRight) && strLeft !== '' && strRight !== '';

      switch (op) {
        case '=':
        case '==':
          return bothNumeric ? numLeft === numRight : strLeft === strRight;
        case '!=':
        case '<>':
          return bothNumeric ? numLeft !== numRight : strLeft !== strRight;
        case '>':
          return bothNumeric ? numLeft > numRight : strLeft > strRight;
        case '>=':
          return bothNumeric ? numLeft >= numRight : strLeft >= strRight;
        case '<':
          return bothNumeric ? numLeft < numRight : strLeft < strRight;
        case '<=':
          return bothNumeric ? numLeft <= numRight : strLeft <= strRight;
        case 'CONTAINS':
          return strLeft.includes(strRight);
        default:
          return false;
      }
    }

    return left;
  }

  private parseAdditive(): any {
    let left = this.parseMultiplicative();
    while (this.peek().type === 'OP_MATH' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.consume().value;
      const right = this.parseMultiplicative();
      if (op === '+') {
        const numL = Number(left);
        const numR = Number(right);
        if (!isNaN(numL) && !isNaN(numR)) left = numL + numR;
        else left = String(left ?? '') + String(right ?? '');
      } else {
        left = Number(left) - Number(right);
      }
    }
    return left;
  }

  private parseMultiplicative(): any {
    let left = this.parsePrimary();
    while (this.peek().type === 'OP_MATH' && (this.peek().value === '*' || this.peek().value === '/')) {
      const op = this.consume().value;
      const right = this.parsePrimary();
      if (op === '*') left = Number(left) * Number(right);
      else left = Number(right) === 0 ? 0 : Number(left) / Number(right);
    }
    return left;
  }

  private parsePrimary(): any {
    const t = this.peek();

    if (t.type === 'IF') {
      this.consume('IF');
      this.consume('LPAREN');
      const condition = this.parseExpression();
      this.consume('COMMA');
      const trueVal = this.parseExpression();
      this.consume('COMMA');
      const falseVal = this.parseExpression();
      this.consume('RPAREN');

      return Boolean(condition) ? trueVal : falseVal;
    }

    if (t.type === 'IS_EMPTY') {
      this.consume('IS_EMPTY');
      this.consume('LPAREN');
      const val = this.parseExpression();
      this.consume('RPAREN');
      return val === null || val === undefined || String(val).trim() === '';
    }

    if (t.type === 'NOT_EMPTY') {
      this.consume('NOT_EMPTY');
      this.consume('LPAREN');
      const val = this.parseExpression();
      this.consume('RPAREN');
      return val !== null && val !== undefined && String(val).trim() !== '';
    }

    if (t.type === 'FIELD') {
      this.consume('FIELD');
      return getFieldValueForFormula(this.issue, t.value, this.columns);
    }

    if (t.type === 'NUMBER') {
      this.consume('NUMBER');
      return Number(t.value);
    }

    if (t.type === 'STRING') {
      this.consume('STRING');
      return t.value;
    }

    if (t.type === 'BOOLEAN') {
      this.consume('BOOLEAN');
      return t.value === 'TRUE';
    }

    if (t.type === 'LPAREN') {
      this.consume('LPAREN');
      const expr = this.parseExpression();
      this.consume('RPAREN');
      return expr;
    }

    // Default fallback
    this.consume();
    return null;
  }
}

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
    const parser = new FormulaParser(tokens, issue, columns);
    const result = parser.parse();
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

  const dummyIssue: JiraIssue = {
    key: 'TEST-1',
    summary: 'Test summary',
    jira_status: 'Done',
    jira_status_category: 'Done',
    issue_type: 'Task',
    priority: 'High',
    is_archived_in_jira: false,
    custom_values: {},
  };

  try {
    const tokens = tokenize(formula);
    const parser = new FormulaParser(tokens, dummyIssue, []);
    parser.parse();
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Error de sintaxis en la fórmula' };
  }
}

/**
 * Helper to build an IF condition formula string from UI fields.
 */
export function buildIfFormula(
  fieldId: string,
  operator: string,
  compareValue: string,
  trueVal: string,
  falseVal: string
): string {
  const safeField = fieldId ? `{${fieldId}}` : '{priority}';

  let formattedTrue = trueVal.trim();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(formattedTrue)) {
    formattedTrue = `"${formattedTrue.replace(/"/g, '\\"')}"`;
  }

  let formattedFalse = falseVal.trim();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(formattedFalse)) {
    formattedFalse = `"${formattedFalse.replace(/"/g, '\\"')}"`;
  }

  if (operator === 'IS_EMPTY') {
    return `IF(IS_EMPTY(${safeField}), ${formattedTrue}, ${formattedFalse})`;
  }
  if (operator === 'NOT_EMPTY') {
    return `IF(NOT_EMPTY(${safeField}), ${formattedTrue}, ${formattedFalse})`;
  }

  let formattedCompare: string;
  if (/^[0-9]+(\.[0-9]+)?$/.test(compareValue.trim())) {
    formattedCompare = compareValue.trim();
  } else {
    formattedCompare = `"${compareValue.replace(/"/g, '\\"')}"`;
  }

  return `IF(${safeField} ${operator} ${formattedCompare}, ${formattedTrue}, ${formattedFalse})`;
}

