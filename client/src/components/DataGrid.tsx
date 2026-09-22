import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Edit2,
  ExternalLink,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import type { CustomColumn, JiraIssue } from '../types';
import { getColorClasses } from '../utils/colors';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';

// ----------------- SUB-COMPONENTS FOR BULLETPROOF EDITING -----------------

interface InlineCellEditorProps {
  initialValue: string;
  type?: string;
  onSave: (val: string) => void;
  onCancel: () => void;
}

const InlineCellEditor: React.FC<InlineCellEditorProps> = ({
  initialValue,
  type = 'text',
  onSave,
  onCancel,
}) => {
  const [val, setVal] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleCommit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onSave(val);
  };

  return (
    <input
      ref={inputRef}
      type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
      value={val}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onChange={(e) => setVal(e.target.value)}
      onBlur={handleCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleCommit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          committedRef.current = true;
          onCancel();
        }
      }}
      className="w-full px-2 py-1 text-xs bg-white text-gray-900 border-2 border-blue-500 rounded shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 z-30"
    />
  );
};

interface SelectDropdownProps {
  column: CustomColumn;
  currentValue: any;
  onSelect: (optId: string | null) => void;
  onClose: () => void;
}

const SelectDropdown: React.FC<SelectDropdownProps> = ({
  column,
  currentValue,
  onSelect,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute left-1 top-full mt-1 w-48 bg-white rounded-lg shadow-2xl border border-gray-200 py-1.5 z-50 animate-in fade-in zoom-in-95"
    >
      <div className="px-2.5 py-1 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
        {column.name}
      </div>
      {column.options?.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => {
            onSelect(opt.id);
            onClose();
          }}
          className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50 flex items-center gap-2 transition-colors cursor-pointer"
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
      {currentValue && (
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            onClose();
          }}
          className="w-full text-left px-2.5 py-1 text-[11px] text-gray-400 hover:text-rose-600 hover:bg-rose-50 border-t border-gray-100 mt-1 cursor-pointer transition-colors"
        >
          Limpiar selección
        </button>
      )}
    </div>
  );
};

// ----------------- MAIN DATAGRID COMPONENT -----------------

interface Props {
  issues: JiraIssue[];
  columns: CustomColumn[];
  onUpdateCustomValue: (issueKey: string, columnId: string, value: any) => Promise<void>;
  onOpenArchivyDrawer: (issue: JiraIssue) => void;
  onOpenAddColumn: () => void;
  onDeleteColumn: (colId: string) => Promise<void>;
  onUpdateColumnWidth?: (colId: string, width: number) => Promise<void>;
  groupBy: string | null;
  jiraDomain?: string;
  lang?: Language;
}

export const DataGrid: React.FC<Props> = ({
  issues,
  columns,
  onUpdateCustomValue,
  onOpenArchivyDrawer,
  onOpenAddColumn,
  onDeleteColumn,
  onUpdateColumnWidth,
  groupBy,
  jiraDomain,
  lang = 'es',
}) => {
  const t = getTranslation(lang);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Active cell currently being edited (with input)
  const [editingCell, setEditingCell] = useState<{ issueKey: string; colId: string; initialVal: string } | null>(null);

  // Active dropdown open (for single_select)
  const [activeDropdown, setActiveDropdown] = useState<{ issueKey: string; colId: string } | null>(null);

  // Column Widths State (allows mouse dragging to expand / shrink columns)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {
      key: 120,
      summary: 340,
      status: 135,
      priority: 120,
      assignee: 150,
    };
    columns.forEach((col) => {
      initial[col.id] = col.width || 160;
    });
    return initial;
  });

  useEffect(() => {
    setColumnWidths((prev) => {
      const next = { ...prev };
      columns.forEach((col) => {
        if (!next[col.id] || (col.width && next[col.id] !== col.width && !prev[col.id])) {
          next[col.id] = col.width || 160;
        }
      });
      return next;
    });
  }, [columns]);

  const handleResizeStart = (e: React.MouseEvent, columnId: string, startWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startX;
      const newWidth = Math.max(65, startWidth + diff);
      setColumnWidths((prev) => ({ ...prev, [columnId]: newWidth }));
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      const diff = upEvent.clientX - startX;
      const finalWidth = Math.max(65, startWidth + diff);
      if (onUpdateColumnWidth && columns.some((c) => c.id === columnId)) {
        onUpdateColumnWidth(columnId, finalWidth);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

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
      <table className="w-full text-left border-collapse text-xs">
        {/* Table Header */}
        <thead className="bg-[#f8f9fb] sticky top-0 z-20 border-b border-gray-200 text-gray-600 font-semibold uppercase text-[11px] tracking-wider select-none">
          <tr>
            {/* Row Number */}
            <th className="w-10 px-3 py-2.5 text-center border-r border-gray-200 bg-[#f8f9fb] sticky left-0 z-30">
              #
            </th>

            {/* Jira Key */}
            <th
              style={{ width: columnWidths.key || 120 }}
              className="px-3 py-2.5 border-r border-gray-200 bg-[#f8f9fb] sticky left-10 z-30 relative group"
            >
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-gray-400" />
                <span>{t.col_key}</span>
              </div>
              <div
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors z-40"
                onMouseDown={(e) => handleResizeStart(e, 'key', columnWidths.key || 120)}
                title="Arrastrar para redimensionar"
              />
            </th>

            {/* Summary */}
            <th
              style={{ width: columnWidths.summary || 340, minWidth: 200 }}
              className="px-3 py-2.5 border-r border-gray-200 bg-[#f8f9fb] sticky left-40 z-30 relative group"
            >
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-gray-400" />
                <span>{t.col_summary}</span>
              </div>
              <div
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors z-40"
                onMouseDown={(e) => handleResizeStart(e, 'summary', columnWidths.summary || 340)}
                title="Arrastrar para redimensionar"
              />
            </th>

            {/* Status */}
            <th
              style={{ width: columnWidths.status || 135 }}
              className="px-3 py-2.5 border-r border-gray-200 bg-[#f8f9fb] relative group"
            >
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-gray-400" />
                <span>{t.col_status}</span>
              </div>
              <div
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors z-40"
                onMouseDown={(e) => handleResizeStart(e, 'status', columnWidths.status || 135)}
                title="Arrastrar para redimensionar"
              />
            </th>

            {/* Priority */}
            <th
              style={{ width: columnWidths.priority || 120 }}
              className="px-3 py-2.5 border-r border-gray-200 bg-[#f8f9fb] relative group"
            >
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-gray-400" />
                <span>{t.col_priority}</span>
              </div>
              <div
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors z-40"
                onMouseDown={(e) => handleResizeStart(e, 'priority', columnWidths.priority || 120)}
                title="Arrastrar para redimensionar"
              />
            </th>

            {/* Assignee */}
            <th
              style={{ width: columnWidths.assignee || 150 }}
              className="px-3 py-2.5 border-r border-gray-200 bg-[#f8f9fb] relative group"
            >
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-gray-400" />
                <span>{t.col_assignee}</span>
              </div>
              <div
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors z-40"
                onMouseDown={(e) => handleResizeStart(e, 'assignee', columnWidths.assignee || 150)}
                title="Arrastrar para redimensionar"
              />
            </th>

            {/* Custom Local & Jira Columns */}
            {visibleCustomColumns.map((col) => {
              const currentW = columnWidths[col.id] || col.width || 160;
              return (
                <th
                  key={col.id}
                  style={{ width: currentW, minWidth: 80 }}
                  className="px-3 py-2.5 border-r border-gray-200 bg-[#f8f9fb] group relative select-none"
                >
                  <div className="flex items-center justify-between gap-1 pr-1">
                    <div className="flex items-center gap-1.5 truncate">
                      {col.type === 'jira_field' || col.jira_field_key ? (
                        <span className="px-1 py-0.2 text-[9px] bg-blue-100 text-blue-800 font-mono rounded font-bold">JIRA</span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                      <span className="font-bold text-gray-800 truncate" title={col.name}>{col.name}</span>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm(t.remove_column_confirm)) {
                          onDeleteColumn(col.id);
                        }
                      }}
                      title={t.remove_column}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-rose-500 p-0.5 rounded transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  {/* Column Resize Handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors z-20"
                    onMouseDown={(e) => handleResizeStart(e, col.id, currentW)}
                    title="Arrastrar para redimensionar"
                  />
                </th>
              );
            })}

            {/* Add Column Header Button */}
            <th className="w-24 px-3 py-2.5 text-center bg-[#f8f9fb]">
              <button
                onClick={onOpenAddColumn}
                className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mx-auto hover:underline cursor-pointer"
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
                        <a
                          href={
                            jiraDomain
                              ? `https://${jiraDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')}/browse/${issue.key}`
                              : '#'
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            if (!jiraDomain) {
                              e.preventDefault();
                              alert(lang === 'es' ? 'Configura tu dominio Jira en Ajustes (⚙️) para abrir tickets.' : 'Configure your Jira domain in Settings (⚙️) to open tickets.');
                            }
                          }}
                          className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 group/key"
                          title={jiraDomain ? `${t.open_in_jira} (${issue.key})` : issue.key}
                        >
                          <span>{issue.key}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover/key:opacity-100 transition-opacity text-blue-500" />
                        </a>
                      </td>

                      {/* Summary */}
                      <td className="px-3 py-2 border-r border-gray-100 bg-white group-hover:bg-blue-50/20 sticky left-40 z-10 max-w-[360px] truncate font-medium text-gray-900">
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
                        const rawCustomValue = issue.custom_values?.[col.id];
                        const isCurrentlyEditing =
                          editingCell?.issueKey === issue.key && editingCell?.colId === col.id;

                        // 1. Archivy Wiki Link Cell
                        if (col.type === 'archivy_link') {
                          return (
                            <td key={col.id} className="px-3 py-1.5 border-r border-gray-100">
                              <button
                                onClick={() => onOpenArchivyDrawer(issue)}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors shadow-2xs cursor-pointer"
                              >
                                <BookOpen className="w-3 h-3 text-purple-600" />
                                <span>Wiki Doc</span>
                              </button>
                            </td>
                          );
                        }

                        // 2. Single Select Cell
                        if (col.type === 'single_select') {
                          const currentOpt = col.options?.find((o) => o.id === rawCustomValue);
                          const isDropdownOpen =
                            activeDropdown?.issueKey === issue.key && activeDropdown?.colId === col.id;

                          return (
                            <td
                              key={col.id}
                              className="px-3 py-1.5 border-r border-gray-100 relative group/cell hover:bg-blue-50/40"
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdown({ issueKey: issue.key, colId: col.id });
                              }}
                              title={t.dblclick_to_edit}
                            >
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdown(isDropdownOpen ? null : { issueKey: issue.key, colId: col.id });
                                }}
                                className="cursor-pointer inline-flex items-center gap-1.5 py-0.5"
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
                                  <span className="text-gray-300 text-xs hover:text-blue-600 italic">
                                    {t.col_select}
                                  </span>
                                )}
                                <Edit2 className="w-2.5 h-2.5 text-gray-300 opacity-0 group-hover/cell:opacity-100 transition-opacity ml-0.5 shrink-0" />
                              </div>

                              {isDropdownOpen && (
                                <SelectDropdown
                                  column={col}
                                  currentValue={rawCustomValue}
                                  onSelect={(val) => onUpdateCustomValue(issue.key, col.id, val)}
                                  onClose={() => setActiveDropdown(null)}
                                />
                              )}
                            </td>
                          );
                        }

                        // 3. Jira Field Selectors Columns (with local editable override support!)
                        if (col.type === 'jira_field' || col.jira_field_key) {
                          const fieldKey = col.jira_field_key || col.id;
                          const jiraRawVal = issue.raw_jira_fields?.[fieldKey];
                          const hasLocalOverride =
                            rawCustomValue !== undefined && rawCustomValue !== null && rawCustomValue !== '';
                          const currentDisplayStr = hasLocalOverride
                            ? String(rawCustomValue)
                            : typeof jiraRawVal === 'object'
                            ? JSON.stringify(jiraRawVal)
                            : jiraRawVal !== null && jiraRawVal !== undefined
                            ? String(jiraRawVal)
                            : '';

                          return (
                            <td
                              key={col.id}
                              className="px-3 py-1.5 border-r border-gray-100 max-w-[240px] cursor-pointer relative group/cell hover:bg-blue-50/40 transition-colors"
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setEditingCell({
                                  issueKey: issue.key,
                                  colId: col.id,
                                  initialVal: currentDisplayStr,
                                });
                              }}
                              title={`${t.dblclick_to_edit} (Jira: ${fieldKey})`}
                            >
                              {isCurrentlyEditing ? (
                                <InlineCellEditor
                                  initialValue={currentDisplayStr}
                                  onSave={(newVal) => {
                                    onUpdateCustomValue(issue.key, col.id, newVal);
                                    setEditingCell(null);
                                  }}
                                  onCancel={() => setEditingCell(null)}
                                />
                              ) : (
                                <div className="flex items-center justify-between min-h-[20px]">
                                  <div className="truncate">
                                    {hasLocalOverride ? (
                                      <span className="text-blue-900 font-medium">{String(rawCustomValue)}</span>
                                    ) : (
                                      renderJiraFieldValue(jiraRawVal)
                                    )}
                                  </div>
                                  <Edit2 className="w-2.5 h-2.5 text-gray-300 opacity-0 group-hover/cell:opacity-100 transition-opacity ml-1 shrink-0" />
                                </div>
                              )}
                            </td>
                          );
                        }

                        // 4. Standard Custom Columns (Text, Long Text, Number, Date)
                        const displayVal =
                          rawCustomValue !== null && rawCustomValue !== undefined ? String(rawCustomValue) : '';

                        return (
                          <td
                            key={col.id}
                            className="px-3 py-1.5 border-r border-gray-100 cursor-pointer relative group/cell hover:bg-blue-50/40 transition-colors"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingCell({
                                issueKey: issue.key,
                                colId: col.id,
                                initialVal: displayVal,
                              });
                            }}
                            title={t.dblclick_to_edit}
                          >
                            {isCurrentlyEditing ? (
                              <InlineCellEditor
                                initialValue={displayVal}
                                type={col.type}
                                onSave={(newVal) => {
                                  onUpdateCustomValue(issue.key, col.id, newVal);
                                  setEditingCell(null);
                                }}
                                onCancel={() => setEditingCell(null)}
                              />
                            ) : (
                              <div className="flex items-center justify-between min-h-[20px]">
                                <span className="truncate text-gray-800">
                                  {displayVal !== '' ? (
                                    <span>{displayVal}</span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingCell({
                                          issueKey: issue.key,
                                          colId: col.id,
                                          initialVal: '',
                                        });
                                      }}
                                      className="text-gray-300 italic hover:text-blue-600 transition-colors cursor-pointer"
                                    >
                                      {t.col_empty}
                                    </button>
                                  )}
                                </span>
                                <Edit2 className="w-2.5 h-2.5 text-gray-300 opacity-0 group-hover/cell:opacity-100 transition-opacity ml-1 shrink-0" />
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
