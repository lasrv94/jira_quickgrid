import type { CustomColumn, JiraIssue } from '../types';

export interface LookupResultItem {
  issueKey: string;
  value: any;
  label: string;
}

/**
 * Resolves the lookup values for a given issue and lookup column.
 */
export function evaluateLookup(
  issue: JiraIssue,
  column: CustomColumn,
  _allColumns: CustomColumn[],
  allIssues: JiraIssue[]
): LookupResultItem[] {
  if (column.type !== 'lookup') return [];

  const lookupOpts = column.lookup || (column.options as any);
  if (!lookupOpts) return [];

  const { link_column_id, lookup_field_id } = lookupOpts;
  if (!link_column_id || !lookup_field_id) return [];

  const rawLinks = issue.custom_values?.[link_column_id];
  if (!rawLinks) return [];

  let linkedKeys: string[] = [];
  if (Array.isArray(rawLinks)) {
    linkedKeys = rawLinks.map((k) => String(k).trim()).filter(Boolean);
  } else if (typeof rawLinks === 'string') {
    try {
      const parsed = JSON.parse(rawLinks);
      if (Array.isArray(parsed)) {
        linkedKeys = parsed.map((k) => String(k).trim()).filter(Boolean);
      } else {
        linkedKeys = [rawLinks.trim()].filter(Boolean);
      }
    } catch {
      linkedKeys = rawLinks.split(',').map((k) => k.trim()).filter(Boolean);
    }
  }

  if (linkedKeys.length === 0) return [];

  // Index issues by key for fast O(1) lookup
  const issueMap = new Map<string, JiraIssue>();
  for (const item of allIssues) {
    issueMap.set(item.key, item);
  }

  const results: LookupResultItem[] = [];

  for (const key of linkedKeys) {
    const target = issueMap.get(key);
    if (!target) {
      results.push({
        issueKey: key,
        value: null,
        label: `${key} (No encontrado)`,
      });
      continue;
    }

    let val: any = undefined;
    // 1. Standard Jira fields
    if (lookup_field_id in target) {
      val = (target as any)[lookup_field_id];
    }
    // 2. Custom values
    if (val === undefined && target.custom_values && lookup_field_id in target.custom_values) {
      val = target.custom_values[lookup_field_id];
    }
    // 3. Raw Jira fields
    if (val === undefined && target.raw_jira_fields && lookup_field_id in target.raw_jira_fields) {
      val = target.raw_jira_fields[lookup_field_id];
    }

    // Format display label
    let label = '';
    if (val === null || val === undefined || val === '') {
      label = '-';
    } else if (typeof val === 'object') {
      label = JSON.stringify(val);
    } else {
      label = String(val);
    }

    results.push({
      issueKey: key,
      value: val,
      label,
    });
  }

  return results;
}
