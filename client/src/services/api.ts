import type { AppConfig, ArchivyNote, CustomColumn, JiraFilter, JiraIssue } from '../types';

const API_BASE = '/api';

export async function fetchIssues(): Promise<JiraIssue[]> {
  const res = await fetch(`${API_BASE}/issues`);
  if (!res.ok) throw new Error('Error al obtener tickets');
  return res.json();
}

export async function syncIssues(filterId?: string): Promise<{ synced: number; total: number; message: string }> {
  const url = filterId ? `${API_BASE}/sync?filter_id=${encodeURIComponent(filterId)}` : `${API_BASE}/sync`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error('Error al sincronizar con Jira');
  return res.json();
}

export async function fetchColumns(): Promise<CustomColumn[]> {
  const res = await fetch(`${API_BASE}/columns`);
  if (!res.ok) throw new Error('Error al obtener columnas');
  return res.json();
}

export async function createColumn(data: Partial<CustomColumn>): Promise<CustomColumn> {
  const res = await fetch(`${API_BASE}/columns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al crear columna');
  return res.json();
}

export async function updateColumn(columnId: string, data: Partial<CustomColumn>): Promise<CustomColumn> {
  const res = await fetch(`${API_BASE}/columns/${columnId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al actualizar columna');
  return res.json();
}

export async function deleteColumn(columnId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/columns/${columnId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al eliminar columna');
}

export async function setCustomValue(issueKey: string, columnId: string, value: any): Promise<void> {
  const res = await fetch(`${API_BASE}/issues/${encodeURIComponent(issueKey)}/custom-values`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ column_id: columnId, value }),
  });
  if (!res.ok) throw new Error('Error al guardar valor personalizado');
}

export async function fetchFilters(): Promise<JiraFilter[]> {
  const res = await fetch(`${API_BASE}/filters`);
  if (!res.ok) throw new Error('Error al obtener filtros de Jira');
  return res.json();
}

export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch(`${API_BASE}/auth/status`);
  if (!res.ok) throw new Error('Error al obtener configuración');
  return res.json();
}

export async function updateConfig(data: Partial<AppConfig>): Promise<AppConfig> {
  const res = await fetch(`${API_BASE}/auth/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al guardar configuración');
  return res.json();
}

export async function fetchArchivyNote(issueKey: string): Promise<ArchivyNote> {
  const res = await fetch(`${API_BASE}/archivy/notes/${encodeURIComponent(issueKey)}`);
  if (!res.ok) throw new Error('Error al obtener nota de Archivy');
  return res.json();
}

export async function saveArchivyNote(issueKey: string, content: string): Promise<ArchivyNote> {
  const res = await fetch(`${API_BASE}/archivy/notes/${encodeURIComponent(issueKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('Error al guardar nota de Archivy');
  return res.json();
}

export async function fetchJiraFields(): Promise<import('../types').JiraFieldInfo[]> {
  const res = await fetch(`${API_BASE}/jira/fields`);
  if (!res.ok) throw new Error('Error al obtener campos de Jira');
  return res.json();
}

export async function validateJiraFilter(filterId?: string, jql?: string): Promise<{ valid: boolean; name: string; jql: string; matched_issues: number; message: string }> {
  const res = await fetch(`${API_BASE}/jira/validate-filter?${new URLSearchParams({ filter_id: filterId || '', jql: jql || '' })}`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Error al validar filtro de Jira');
  }
  return res.json();
}

