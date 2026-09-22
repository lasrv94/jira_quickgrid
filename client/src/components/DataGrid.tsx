import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Lock,
  Plus,
  Trash2
} from 'lucide-react';
import type { CustomColumn, JiraIssue } from '../types';
import { getColorClasses } from '../utils/colors';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';

interface Props {
  issues: JiraIssue[];
  columns: CustomColumn[];
  onUpdateCustomValue: (issueKey: string, columnId: string, value: any) => Promise<void>;
  onOpenArchivyDrawer: (issue: JiraIssue) => void;
  onOpenAddColumn: () => void;
  onDeleteColumn: (colId: string) => Promise<void>;
  groupBy: string | null;
  lang?: Language;
}

export const DataGrid: React.FC<Props> = ({
  issues,
  columns,
  onUpdateCustomValue,
  onOpenArchivyDrawer,
  onOpenAddColumn,
  onDeleteColumn,
  groupBy,
  lang = 'es',
}) => {
  const t = getTranslation(lang);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [activeDropdown, setActiveDropdown] = useState<{ issueKey: string; colId: string } | null>(null);
  const [editingText, setEditingText] = useState<{ issueKey: string; colId: string; val: string } | null>(null);

  const visibleCustomColumns = useMemo(
    () => columns.filter((c) => c.is_visible).sort((a, b) => a.position - b.position),
    [columns]
  );

  // Grouping logic
  const groupedData = useMemo(() => {
    if (!groupBy) {
      return [{ groupKey: 'all', groupLabel: 'Todos los tickets', items: issues }];
    }

    const groups: Record<string, { label: string; items: JiraIssue[] }> = {};

    issues.forEach((issue) => {
      let val = '';
      if (groupBy === 'jira_status') {
        val = issue.jira_status || 'Sin Estado';
      } else if (groupBy === 'priority') {
        val = issue.priority || 'Sin Prioridad';
      } else if (groupBy === 'assignee_name') {
        val = issue.assignee_name || 'Sin Asignar';
      } else {
        const customCol = columns.find((c) => c.id === groupBy);
        const rawVal = issue.custom_values?.[groupBy];
        if (customCol && customCol.type === 'single_select') {
          const opt = customCol.options?.find((o) => o.id === rawVal);
          val = opt ? opt.label : 'Sin Definir';
        } else {
          val = rawVal ? String(rawVal) : 'Sin Definir';
        }
      }

      if (!groups[val]) {
        groups[val] = { label: val, items: [] };
      }
      groups[val].items.push(issue);
    });

    return Object.entries(groups).map(([k, g]) => ({
      groupKey: k,
      groupLabel: g.label,
      items: g.items,
    }));
  }, [issues, groupBy, columns]);

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'highest':
      case 'critical':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'high':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getStatusBadge = (category: string) => {
    switch (category.toLowerCase()) {
      case 'done':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'in progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const renderJiraFieldValue = (val: any) => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-gray-300 italic">-</span>;
    }
    if (typeof val === 'boolean') {
      return (
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
            val ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {val ? 'Sí' : 'No'}
        </span>
      );
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return <span className="text-gray-300 italic">Vacío</span>;
      return (
        <div className="flex flex-wrap gap-1 max-w-[240px]">
          {val.map((item, idx) => {
            const text =
              typeof item === 'object' && item !== null
                ? item.name || item.value || item.displayName || JSON.stringify(item)
                : String(item);
            return (
              <span
                key={idx}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 truncate max-w-[120px]"
                title={text}
              >
                {text}
              </span>
            );
          })}
        </div>
      );
    }
    if (typeof val === 'object') {
      if (val.displayName) {
        return (
          <div className="flex items-center gap-1.5">
            {val.avatarUrls?.['16x16'] || val.avatarUrls?.['24x24'] ? (
              <img
                src={val.avatarUrls['16x16'] || val.avatarUrls['24x24']}
                alt={val.displayName}
                className="w-4 h-4 rounded-full border border-gray-200"
              />
            ) : null}
            <span className="truncate text-xs text-gray-700">{val.displayName}</span>
          </div>
        );
      }
      if (val.name) {
        return <span className="text-xs text-gray-800 font-medium truncate">{val.name}</span>;
      }
      if (val.value) {
        return <span className="text-xs text-gray-800 font-medium truncate">{val.value}</span>;
      }
      if (val.type === 'doc' && Array.isArray(val.content)) {
        const extractText = (node: any): string => {
          if (!node) return '';
          if (node.text) return node.text;
          if (Array.isArray(node.content)) return node.content.map(extractText).join(' ');
          return '';
        };
        const text = extractText(val).trim();
        return (
          <span className="text-xs text-gray-700 truncate block max-w-[200px]" title={text}>
            {text || '-'}
          </span>
        );
      }
      return <span className="text-xs text-gray-500 font-mono truncate">{JSON.stringify(val)}</span>;
    }
    return (
      <span className="text-xs text-gray-800 truncate block max-w-[200px]" title={String(val)}>
        {String(val)}
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-auto bg-white relative">
      <table className="w-full text-left border-collapse text-xs select-none">
        {/* Table Header */}
        <thead className="bg-[#f8f9fb] sticky top-0 z-20 border-b border-gray-200 text-gray-600 font-semibold uppercase text-[11px] tracking-wider">
          <tr>
            {/* Jira Standard Columns */}
            <th className="w-10 px-3 py-2.5 text-center border-r border-gray-200 bg-[#f8f9fb] sticky left-0 z-30">
              #
            </th>
            <th className="w-28 px-3 py-2.5 border-r border-gray-200 bg-[#f8f9fb] sticky left-10 z-30">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-gray-400" />
                <span>{t.col_key}</span>
              </div>
            </th>
            <th className="min-w-[280px] max-w-[400px] px-3 py-2.5 border-r border-gray-200 bg-[#f8f9fb] sticky left-38 z-30">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-gray-400" />
                <span>{t.col_summary}</span>
              </div>
            </th>
            <th className="w-32 px-3 py-2.5 border-r border-gray-200">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-gray-400" />
                <span>{t.col_status}</span>
              </div>
            </th>
            <th className="w-28 px-3 py-2.5 border-r border-gray-200">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-gray-400" />
                <span>{t.col_priority}</span>
              </div>
            </th>
            <th className="w-36 px-3 py-2.5 border-r border-gray-200">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-gray-400" />
                <span>{t.col_assignee}</span>
              </div>
            </th>

            {/* Custom Local & Jira Columns */}
            {visibleCustomColumns.map((col) => (
              <th
                key={col.id}
                style={{ width: col.width }}
                className="px-3 py-2.5 border-r border-gray-200 bg-[#f8f9fb] group"
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 truncate">
                    {col.type === 'jira_field' || col.jira_field_key ? (
                      <span className="px-1 py-0.2 text-[9px] bg-blue-100 text-blue-800 font-mono rounded font-bold">JIRA</span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                    <span className="font-bold text-gray-800 truncate" title={col.name}>{col.name}</span>
                  </div>
                  <button
                    onClick={() => onDeleteColumn(col.id)}
                    title="Eliminar columna"
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-rose-500 p-0.5 rounded transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </th>
            ))}

            {/* Add Column Header Button */}
            <th className="w-24 px-3 py-2.5 text-center bg-[#f8f9fb]">
              <button
                onClick={onOpenAddColumn}
                className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mx-auto hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Campo</span>
              </button>
            </th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-gray-100 text-gray-800">
          {groupedData.map((group) => {
            const isCollapsed = collapsedGroups[group.groupKey];

            return (
              <React.Fragment key={group.groupKey}>
                {/* Group Header Row */}
                {groupBy && (
                  <tr className="bg-gray-100/90 font-medium border-y border-gray-200">
                    <td
                      colSpan={6 + visibleCustomColumns.length + 1}
                      className="px-4 py-2 cursor-pointer hover:bg-gray-200/70 transition-colors"
                      onClick={() => toggleGroup(group.groupKey)}
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="font-bold text-gray-800 text-xs">{group.groupLabel}</span>
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-white rounded-full border border-gray-300 text-gray-600 shadow-2xs">
                          {group.items.length} {group.items.length === 1 ? 'ticket' : 'tickets'}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Group Issue Rows */}
                {!isCollapsed &&
                  group.items.map((issue, idx) => (
                    <tr
                      key={issue.key}
                      className="hover:bg-blue-50/30 transition-colors group border-b border-gray-100"
                    >
                      {/* Row Index */}
                      <td className="px-3 py-2 text-center text-gray-400 font-mono text-[11px] border-r border-gray-100 bg-white group-hover:bg-blue-50/20 sticky left-0 z-10">
                        {idx + 1}
                      </td>

                      {/* Key */}
                      <td className="px-3 py-2 border-r border-gray-100 bg-white group-hover:bg-blue-50/20 sticky left-10 z-10 whitespace-nowrap">
                        <span className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">
                          {issue.key}
                        </span>
                      </td>

                      {/* Summary */}
                      <td className="px-3 py-2 border-r border-gray-100 bg-white group-hover:bg-blue-50/20 sticky left-38 z-10 max-w-[360px] truncate font-medium text-gray-900">
                        <span title={issue.summary}>{issue.summary}</span>
                      </td>

                      {/* Jira Status */}
                      <td className="px-3 py-2 border-r border-gray-100 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${getStatusBadge(
                            issue.jira_status_category
                          )}`}
                        >
                          {issue.jira_status}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="px-3 py-2 border-r border-gray-100 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getPriorityBadge(
                            issue.priority
                          )}`}
                        >
                          {issue.priority}
                        </span>
                      </td>

                      {/* Assignee */}
                      <td className="px-3 py-2 border-r border-gray-100 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {issue.assignee_avatar ? (
                            <img
                              src={issue.assignee_avatar}
                              alt={issue.assignee_name || ''}
                              className="w-5 h-5 rounded-full object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold">
                              {issue.assignee_name ? issue.assignee_name[0] : '?'}
                            </div>
                          )}
                          <span className="text-gray-700 truncate max-w-[100px]">
                            {issue.assignee_name || t.unassigned}
                          </span>
                        </div>
                      </td>

                      {/* Custom Columns Cells */}
                      {visibleCustomColumns.map((col) => {
                        const rawValue = issue.custom_values?.[col.id];

                        // Jira Native Field Cell
                        if (col.type === 'jira_field' || col.jira_field_key) {
                          const fieldKey = col.jira_field_key || col.id;
                          const jiraVal = issue.raw_jira_fields?.[fieldKey];
                          return (
                            <td
                              key={col.id}
                              className="px-3 py-1.5 border-r border-gray-100 max-w-[240px]"
                              title={`Jira field: ${fieldKey}`}
                            >
                              {renderJiraFieldValue(jiraVal)}
                            </td>
                          );
                        }

                        // Single Select Cell
                        if (col.type === 'single_select') {
                          const currentOpt = col.options?.find((o) => o.id === rawValue);
                          const isDropdownOpen =
                            activeDropdown?.issueKey === issue.key && activeDropdown?.colId === col.id;

                          return (
                            <td key={col.id} className="px-3 py-1.5 border-r border-gray-100 relative">
                              <div
                                onClick={() =>
                                  setActiveDropdown(isDropdownOpen ? null : { issueKey: issue.key, colId: col.id })
                                }
                                className="cursor-pointer inline-flex items-center gap-1"
                              >
                                {currentOpt ? (
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-2xs ${getColorClasses(
                                      currentOpt.color
                                    )}`}
                                  >
                                    {currentOpt.label}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-xs hover:text-gray-500 italic">
                                    + Seleccionar
                                  </span>
                                )}
                              </div>

                              {/* Single Select Option Menu */}
                              {isDropdownOpen && (
                                <div className="absolute left-2 top-full mt-1 w-44 bg-white rounded-lg shadow-xl border border-gray-200 py-1.5 z-40 animate-in fade-in zoom-in-95">
                                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase text-gray-400">
                                    {col.name}
                                  </div>
                                  {col.options?.map((opt) => (
                                    <button
                                      key={opt.id}
                                      onClick={() => {
                                        onUpdateCustomValue(issue.key, col.id, opt.id);
                                        setActiveDropdown(null);
                                      }}
                                      className="w-full text-left px-2.5 py-1 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${getColorClasses(
                                          opt.color
                                        )}`}
                                      >
                                        {opt.label}
                                      </span>
                                    </button>
                                  ))}
                                  {currentOpt && (
                                    <button
                                      onClick={() => {
                                        onUpdateCustomValue(issue.key, col.id, null);
                                        setActiveDropdown(null);
                                      }}
                                      className="w-full text-left px-2.5 py-1 text-[11px] text-gray-400 hover:text-rose-600 hover:bg-rose-50 border-t border-gray-100 mt-1"
                                    >
                                      Limpiar selección
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        }

                        // Archivy Wiki Link Cell
                        if (col.type === 'archivy_link') {
                          return (
                            <td key={col.id} className="px-3 py-1.5 border-r border-gray-100">
                              <button
                                onClick={() => onOpenArchivyDrawer(issue)}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors shadow-2xs"
                              >
                                <BookOpen className="w-3 h-3 text-purple-600" />
                                <span>Wiki Doc</span>
                              </button>
                            </td>
                          );
                        }

                        // Text or Long Text Cell
                        const isEditing =
                          editingText?.issueKey === issue.key && editingText?.colId === col.id;

                        return (
                          <td
                            key={col.id}
                            className="px-3 py-1.5 border-r border-gray-100 cursor-text"
                            onClick={() => {
                              if (!isEditing) {
                                setEditingText({
                                  issueKey: issue.key,
                                  colId: col.id,
                                  val: rawValue ? String(rawValue) : '',
                                });
                              }
                            }}
                          >
                            {isEditing ? (
                              <input
                                autoFocus
                                type={col.type === 'number' ? 'number' : 'text'}
                                value={editingText.val}
                                onChange={(e) =>
                                  setEditingText({ ...editingText, val: e.target.value })
                                }
                                onBlur={() => {
                                  onUpdateCustomValue(issue.key, col.id, editingText.val);
                                  setEditingText(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    onUpdateCustomValue(issue.key, col.id, editingText.val);
                                    setEditingText(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingText(null);
                                  }
                                }}
                                className="w-full px-1.5 py-0.5 text-xs bg-blue-50 border border-blue-400 rounded focus:outline-none"
                              />
                            ) : (
                              <div className="truncate text-gray-700 hover:text-gray-900 min-h-[18px]">
                                {rawValue ? (
                                  <span>{String(rawValue)}</span>
                                ) : (
                                  <span className="text-gray-300 italic">+ Vacío</span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Empty cell under add column */}
                      <td className="px-3 py-2 text-center text-gray-300">-</td>
                    </tr>
                  ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
