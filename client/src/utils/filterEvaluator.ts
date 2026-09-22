import type { CustomColumn, FilterCondition, FilterConjunction, FilterOperator, JiraIssue } from '../types';

export type FieldCategory = 'text' | 'select' | 'number' | 'date';

export interface FieldDefinition {
  id: string;
  name: string;
  type: FieldCategory;
  isCustom?: boolean;
}

export const BUILTIN_FIELDS: FieldDefinition[] = [
  { id: 'key', name: 'Clave Jira (Key)', type: 'text' },
  { id: 'summary', name: 'Título / Resumen (Summary)', type: 'text' },
  { id: 'jira_status', name: 'Estado Jira (Status)', type: 'select' },
  { id: 'priority', name: 'Prioridad (Priority)', type: 'select' },
  { id: 'assignee_name', name: 'Asignado (Assignee)', type: 'select' },
  { id: 'issue_type', name: 'Tipo de Incidencia (Type)', type: 'select' },
  { id: 'reporter_name', name: 'Informador (Reporter)', type: 'text' },
  { id: 'jira_created_at', name: 'Fecha de Creación', type: 'date' },
  { id: 'jira_updated_at', name: 'Fecha de Actualización', type: 'date' },
];

export function getAllFilterableFields(columns: CustomColumn[]): FieldDefinition[] {
  const custom: FieldDefinition[] = columns.map((col) => {
    let type: FieldCategory = 'text';
    if (col.type === 'single_select') type = 'select';
    else if (col.type === 'number') type = 'number';
    else if (col.type === 'date') type = 'date';
    return {
      id: col.id,
      name: col.name,
      type,
      isCustom: true,
    };
  });
  return [...BUILTIN_FIELDS, ...custom];
}

export function getFieldCategory(fieldId: string, columns: CustomColumn[]): FieldCategory {
  const builtin = BUILTIN_FIELDS.find((f) => f.id === fieldId);
  if (builtin) return builtin.type;

  const col = columns.find((c) => c.id === fieldId);
  if (col) {
    if (col.type === 'single_select') return 'select';
    if (col.type === 'number') return 'number';
    if (col.type === 'date') return 'date';
  }
  return 'text';
}

export function getAvailableOperators(category: FieldCategory): FilterOperator[] {
  switch (category) {
    case 'select':
      return ['equals', 'not_equals', 'is_empty', 'is_not_empty'];
    case 'number':
      return ['equals', 'not_equals', 'gt', 'gte', 'lt', 'lte', 'is_empty', 'is_not_empty'];
    case 'date':
      return ['equals', 'is_before', 'is_after', 'is_today', 'is_empty', 'is_not_empty'];
    case 'text':
    default:
      return [
        'contains',
        'not_contains',
        'equals',
        'not_equals',
        'starts_with',
        'ends_with',
        'is_empty',
        'is_not_empty',
      ];
  }
}

export function getFieldSelectOptions(
  fieldId: string,
  columns: CustomColumn[],
  issues: JiraIssue[]
): { id: string; label: string; color?: string }[] {
  // Builtin Priority
  if (fieldId === 'priority') {
    return [
      { id: 'Highest', label: 'Highest' },
      { id: 'High', label: 'High' },
      { id: 'Medium', label: 'Medium' },
      { id: 'Low', label: 'Low' },
      { id: 'Lowest', label: 'Lowest' },
    ];
  }

  // Builtin Status
  if (fieldId === 'jira_status') {
    const statuses = new Set<string>();
    issues.forEach((i) => {
      if (i.jira_status) statuses.add(i.jira_status);
    });
    const defaultStatuses = ['To Do', 'In Progress', 'In Review', 'Done'];
    defaultStatuses.forEach((s) => statuses.add(s));
    return Array.from(statuses).map((s) => ({ id: s, label: s }));
  }

  // Builtin Assignee
  if (fieldId === 'assignee_name') {
    const assignees = new Set<string>();
    issues.forEach((i) => {
      if (i.assignee_name) assignees.add(i.assignee_name);
    });
    return Array.from(assignees).map((a) => ({ id: a, label: a }));
  }

  // Builtin Issue Type
  if (fieldId === 'issue_type') {
    const types = new Set<string>();
    issues.forEach((i) => {
      if (i.issue_type) types.add(i.issue_type);
    });
    ['Task', 'Bug', 'Story', 'Epic', 'Sub-task'].forEach((t) => types.add(t));
    return Array.from(types).map((t) => ({ id: t, label: t }));
  }

  // Custom column options
  const col = columns.find((c) => c.id === fieldId);
  if (col && col.type === 'single_select' && col.options && col.options.length > 0) {
    return col.options.map((opt) => ({
      id: opt.id,
      label: opt.label,
      color: opt.color,
    }));
  }

  return [];
}

export function getFieldValue(issue: JiraIssue, fieldId: string): any {
  if (fieldId in issue) {
    return (issue as any)[fieldId];
  }
  if (issue.custom_values && fieldId in issue.custom_values) {
    return issue.custom_values[fieldId];
  }
  if (issue.raw_jira_fields && fieldId in issue.raw_jira_fields) {
    return issue.raw_jira_fields[fieldId];
  }
  return undefined;
}

export function evaluateCondition(
  issue: JiraIssue,
  condition: FilterCondition,
  columns: CustomColumn[]
): boolean {
  const { fieldId, operator, value } = condition;
  const rawValue = getFieldValue(issue, fieldId);

  // Check empty / not empty first
  const isEmpty =
    rawValue === undefined ||
    rawValue === null ||
    (typeof rawValue === 'string' && rawValue.trim() === '') ||
    (Array.isArray(rawValue) && rawValue.length === 0);

  if (operator === 'is_empty') return isEmpty;
  if (operator === 'is_not_empty') return !isEmpty;

  // If rawValue is empty and operator is anything else, it does not match
  if (isEmpty) return false;

  const target = (value ?? '').trim();

  // If custom column single_select, check both option id and option label
  const col = columns.find((c) => c.id === fieldId);
  if (col?.type === 'single_select') {
    let resolvedLabel = String(rawValue);
    const matchedOption = col.options?.find(
      (opt) => opt.id === rawValue || opt.label.toLowerCase() === String(rawValue).toLowerCase()
    );
    if (matchedOption) {
      resolvedLabel = matchedOption.label;
    }

    const valMatches =
      String(rawValue).toLowerCase() === target.toLowerCase() ||
      resolvedLabel.toLowerCase() === target.toLowerCase();

    if (operator === 'equals') return valMatches;
    if (operator === 'not_equals') return !valMatches;
  }

  // Number comparison
  const colType = col?.type;
  if (colType === 'number') {
    const numVal = parseFloat(String(rawValue));
    const numTarget = parseFloat(target);
    if (isNaN(numVal) || isNaN(numTarget)) return false;

    switch (operator) {
      case 'equals':
        return numVal === numTarget;
      case 'not_equals':
        return numVal !== numTarget;
      case 'gt':
        return numVal > numTarget;
      case 'gte':
        return numVal >= numTarget;
      case 'lt':
        return numVal < numTarget;
      case 'lte':
        return numVal <= numTarget;
    }
  }

  // Date comparison
  if (colType === 'date' || fieldId === 'jira_created_at' || fieldId === 'jira_updated_at') {
    const dVal = new Date(rawValue);
    if (isNaN(dVal.getTime())) return false;

    if (operator === 'is_today') {
      const today = new Date();
      return (
        dVal.getFullYear() === today.getFullYear() &&
        dVal.getMonth() === today.getMonth() &&
        dVal.getDate() === today.getDate()
      );
    }

    if (!target) return true;
    const dTarget = new Date(target);
    if (isNaN(dTarget.getTime())) return false;

    // Normalize to date-only string comparison (YYYY-MM-DD) for 'equals'
    const dValDateStr = dVal.toISOString().slice(0, 10);
    const dTargetDateStr = dTarget.toISOString().slice(0, 10);

    switch (operator) {
      case 'equals':
        return dValDateStr === dTargetDateStr;
      case 'is_before':
        return dVal.getTime() < dTarget.getTime();
      case 'is_after':
        return dVal.getTime() > dTarget.getTime();
    }
  }

  // Text & general comparisons
  const strVal = String(rawValue).toLowerCase();
  const strTarget = target.toLowerCase();

  switch (operator) {
    case 'contains':
      return strVal.includes(strTarget);
    case 'not_contains':
      return !strVal.includes(strTarget);
    case 'equals':
      return strVal === strTarget;
    case 'not_equals':
      return strVal !== strTarget;
    case 'starts_with':
      return strVal.startsWith(strTarget);
    case 'ends_with':
      return strVal.endsWith(strTarget);
    default:
      return true;
  }
}

export function filterIssues(
  issues: JiraIssue[],
  conditions: FilterCondition[],
  conjunction: FilterConjunction,
  columns: CustomColumn[]
): JiraIssue[] {
  // If there are no conditions or conditions without a field, return all
  const validConditions = conditions.filter((c) => Boolean(c.fieldId));
  if (validConditions.length === 0) return issues;

  return issues.filter((issue) => {
    if (conjunction === 'or') {
      return validConditions.some((cond) => evaluateCondition(issue, cond, columns));
    }
    // Default is 'and'
    return validConditions.every((cond) => evaluateCondition(issue, cond, columns));
  });
}
