import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit2,
  ExternalLink,
  GripVertical,
  Lock,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { CustomColumn, JiraIssue } from '../types';
import { getColorClasses } from '../utils/colors';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';
import { evaluateFormula } from '../utils/formulaEvaluator';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    if (type === 'long_text' && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    } else if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [type]);

  const handleCommit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onSave(val);
  };

  const handleCancel = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel();
  };

  return (
    <div
      className="flex items-center gap-1.5 w-full bg-white p-1 rounded-md border-2 border-blue-500 shadow-lg z-30"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {type === 'long_text' ? (
        <textarea
          ref={textareaRef}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleCommit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              handleCancel();
            }
          }}
          rows={2}
          className="flex-1 px-1.5 py-1 text-xs text-gray-900 focus:outline-none resize-none"
        />
      ) : (
        <input
          ref={inputRef}
          type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCommit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              handleCancel();
            }
          }}
          className="flex-1 px-1.5 py-0.5 text-xs text-gray-900 focus:outline-none min-w-0"
        />
      )}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleCommit();
          }}
          title="Guardar"
          className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleCancel();
          }}
          title="Cancelar"
          className="p-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
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

// ----------------- CLIPBOARD & AIRTABLE-STYLE COPY HELPERS -----------------

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

function getCellValueAsText(
  issue: JiraIssue,
  colId: string,
  columns: CustomColumn[]
): string {
  if (colId === 'key') return issue.key || '';
  if (colId === 'summary') return issue.summary || '';
  if (colId === 'status') return issue.jira_status || '';
  if (colId === 'priority') return issue.priority || '';
  if (colId === 'assignee') return issue.assignee_name || '';

  const col = columns.find((c) => c.id === colId);
  const rawCustom = issue.custom_values?.[colId];

  if (!col) {
    return rawCustom !== undefined && rawCustom !== null ? String(rawCustom) : '';
  }

  if (col.type === 'archivy_link') {
    return issue.key;
  }

  if (col.type === 'single_select') {
    const opt = col.options?.find((o) => o.id === rawCustom);
    return opt ? opt.label : rawCustom ? String(rawCustom) : '';
  }

  if (col.type === 'formula') {
    const result = evaluateFormula(col.formula, issue, columns);
    return result !== null && result !== undefined ? String(result) : '';
  }

  if (col.type === 'jira_field' || col.jira_field_key) {
    const fieldKey = col.jira_field_key || col.id;
    const jiraVal = issue.raw_jira_fields?.[fieldKey];
    if (jiraVal === null || jiraVal === undefined) return '';
    if (typeof jiraVal === 'string' || typeof jiraVal === 'number' || typeof jiraVal === 'boolean') {
      return String(jiraVal);
    }
    if (Array.isArray(jiraVal)) {
      return jiraVal
        .map((item) =>
          typeof item === 'object' && item ? item.name || item.value || item.displayName || '' : String(item)
        )
        .filter(Boolean)
        .join(', ');
    }
    if (typeof jiraVal === 'object') {
      if (jiraVal.displayName) return jiraVal.displayName;
      if (jiraVal.name) return jiraVal.name;
      if (jiraVal.value) return jiraVal.value;
      if (jiraVal.type === 'doc' && Array.isArray(jiraVal.content)) {
        const extractText = (node: any): string => {
          if (!node) return '';
          if (node.text) return node.text;
          if (Array.isArray(node.content)) return node.content.map(extractText).join(' ');
          return '';
        };
        return extractText(jiraVal).trim();
      }
      return JSON.stringify(jiraVal);
    }
    return String(jiraVal);
  }

  return rawCustom !== null && rawCustom !== undefined ? String(rawCustom) : '';
}

// ----------------- MAIN DATAGRID COMPONENT -----------------

interface Props {
  issues: JiraIssue[];
  columns: CustomColumn[];
  onUpdateCustomValue: (issueKey: string, columnId: string, value: any) => Promise<void>;
  onOpenArchivyDrawer: (issue: JiraIssue) => void;
  onOpenAddColumn: () => void;
  onOpenEditColumn?: (col: CustomColumn) => void;
  onDeleteColumn: (colId: string) => Promise<void>;
  onUpdateColumnWidth?: (colId: string, width: number) => Promise<void>;
  onReorderColumns?: (reorderedCols: CustomColumn[]) => Promise<void>;
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
  onOpenEditColumn,
  onDeleteColumn,
  onUpdateColumnWidth,
  onReorderColumns,
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

  // Airtable-style cell selection and copy state
  const [selectedCell, setSelectedCell] = useState<{ issueKey: string; colId: string } | null>(null);
  const [copiedCell, setCopiedCell] = useState<{ issueKey: string; colId: string } | null>(null);
  const [copyToast, setCopyToast] = useState<{ text: string } | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopyCell = useCallback(
    (issueKey: string, colId: string) => {
      const issue = issues.find((i) => i.key === issueKey);
      if (!issue) return;
      const textToCopy = getCellValueAsText(issue, colId, columns);

      copyTextToClipboard(textToCopy).then(() => {
        setCopiedCell({ issueKey, colId });
        setCopyToast({
          text: textToCopy.length > 45 ? `${textToCopy.substring(0, 42)}...` : textToCopy,
        });

        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => {
          setCopiedCell(null);
          setCopyToast(null);
        }, 2000);
      });
    },
    [issues, columns]
  );

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

  // Airtable-style Keyboard Navigation & Copy Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is currently typing in an input or textarea, let default browser behavior handle it
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (!selectedCell) return;

      // 1. Copy: Ctrl+C or Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopyCell(selectedCell.issueKey, selectedCell.colId);
        return;
      }

      // 2. Deselect: Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedCell(null);
        return;
      }

      // 3. Edit: Enter or F2
      if (e.key === 'Enter' || e.key === 'F2') {
        const col = columns.find((c) => c.id === selectedCell.colId);
        const issue = issues.find((i) => i.key === selectedCell.issueKey);
        if (col && issue) {
          e.preventDefault();
          if (col.type === 'single_select') {
            setActiveDropdown({ issueKey: selectedCell.issueKey, colId: selectedCell.colId });
          } else if (col.type === 'formula') {
            onOpenEditColumn?.(col);
          } else if (col.type !== 'jira_field' && col.type !== 'archivy_link') {
            const val = issue.custom_values?.[col.id];
            setEditingCell({
              issueKey: selectedCell.issueKey,
              colId: selectedCell.colId,
              initialVal: val !== null && val !== undefined ? String(val) : '',
            });
          }
        }
        return;
      }

      // 4. Arrow navigation (Airtable-style keyboard navigation)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const allCols = ['key', 'summary', 'status', 'priority', 'assignee', ...visibleCustomColumns.map((c) => c.id)];
        const currentColIdx = allCols.indexOf(selectedCell.colId);
        if (currentColIdx === -1) return;

        // Flatten visible issues across active groups
        const visibleIssues = groupedData.flatMap((g) => (collapsedGroups[g.groupKey] ? [] : g.items));
        const currentIssueIdx = visibleIssues.findIndex((i) => i.key === selectedCell.issueKey);
        if (currentIssueIdx === -1) return;

        let nextColIdx = currentColIdx;
        let nextIssueIdx = currentIssueIdx;

        if (e.key === 'ArrowLeft') nextColIdx = Math.max(0, currentColIdx - 1);
        if (e.key === 'ArrowRight') nextColIdx = Math.min(allCols.length - 1, currentColIdx + 1);
        if (e.key === 'ArrowUp') nextIssueIdx = Math.max(0, currentIssueIdx - 1);
        if (e.key === 'ArrowDown') nextIssueIdx = Math.min(visibleIssues.length - 1, currentIssueIdx + 1);

        const nextIssue = visibleIssues[nextIssueIdx];
        const nextColId = allCols[nextColIdx];
        if (nextIssue && nextColId) {
          setSelectedCell({ issueKey: nextIssue.key, colId: nextColId });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedCell,
    handleCopyCell,
    columns,
    issues,
    visibleCustomColumns,
    groupedData,
    collapsedGroups,
    onOpenEditColumn,
  ]);

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

  const renderComponentPills = (val: any) => {
    let list: string[] = [];
    if (Array.isArray(val)) {
      list = val
        .map((item) => {
          if (!item) return '';
          if (typeof item === 'object') return item.name || item.value || item.displayName || '';
          return String(item).trim();
        })
        .filter(Boolean);
    } else if (typeof val === 'object' && val !== null) {
      if (val.name) list = [val.name];
      else if (val.value) list = [val.value];
      else if (val.displayName) list = [val.displayName];
    } else if (typeof val === 'string' && val.trim()) {
      list = val.split(',').map((s) => s.trim()).filter(Boolean);
    }

    if (list.length === 0) {
      return <span className="text-gray-300 italic text-[11px]">-</span>;
    }

    const pillStyles = [
      'bg-indigo-50 text-indigo-700 border-indigo-200/80',
      'bg-blue-50 text-blue-700 border-blue-200/80',
      'bg-purple-50 text-purple-700 border-purple-200/80',
      'bg-teal-50 text-teal-700 border-teal-200/80',
      'bg-amber-50 text-amber-700 border-amber-200/80',
      'bg-rose-50 text-rose-700 border-rose-200/80',
      'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    ];

    return (
      <div className="flex flex-wrap gap-1.5 items-center py-0.5 max-w-[280px]">
        {list.map((item, idx) => {
          const colorClass = pillStyles[idx % pillStyles.length];
          return (
            <span
              key={idx}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shadow-2xs ${colorClass}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
              <span className="truncate max-w-[150px]">{item}</span>
            </span>
          );
        })}
      </div>
    );
  };

  const renderJiraFieldValue = (val: any, fieldKey?: string) => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-gray-300 italic">-</span>;
    }

    // Components or Labels array rendering
    if (fieldKey && (fieldKey.toLowerCase().includes('component') || fieldKey.toLowerCase().includes('label'))) {
      return renderComponentPills(val);
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

    // Project object from Jira
    if (typeof val === 'object' && val !== null && (val.projectTypeKey || val.key)) {
      return (
        <div className="flex items-center gap-1.5">
          {val.avatarUrls?.['16x16'] || val.avatarUrls?.['24x24'] ? (
            <img
              src={val.avatarUrls['16x16'] || val.avatarUrls['24x24']}
              alt={val.name || val.key}
              className="w-4 h-4 rounded-xs shrink-0"
            />
          ) : null}
          <span className="text-xs font-medium text-gray-800 truncate" title={`${val.name || ''} (${val.key || ''})`}>
            {val.name || val.key} {val.key && val.name ? <span className="text-gray-400 text-[10px]">({val.key})</span> : null}
          </span>
        </div>
      );
    }

    if (Array.isArray(val)) {
      if (val.length === 0) return <span className="text-gray-300 italic">-</span>;
      return renderComponentPills(val);
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
      <span className="text-xs text-gray-800 truncate block max-w-[240px]" title={String(val)}>
        {String(val)}
      </span>
    );
  };

  // Header column drag & drop reordering state
  const [draggingColId, setDraggingColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  const handleColumnDrop = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const currentCols = [...columns];
    const sourceIdx = currentCols.findIndex((c) => c.id === sourceId);
    const targetIdx = currentCols.findIndex((c) => c.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const [removed] = currentCols.splice(sourceIdx, 1);
    currentCols.splice(targetIdx, 0, removed);

    const reordered = currentCols.map((col, idx) => ({ ...col, position: idx }));
    if (onReorderColumns) {
      onReorderColumns(reordered);
    }
  };

  // Compute total table width to guarantee horizontal scrollbar
  const totalTableWidth = useMemo(() => {
    const baseWidths =
      40 + // row index #
      (columnWidths.key || 120) +
      (columnWidths.summary || 340) +
      (columnWidths.status || 135) +
      (columnWidths.priority || 120) +
      (columnWidths.assignee || 150);

    const customTotal = visibleCustomColumns.reduce(
      (sum, col) => sum + (columnWidths[col.id] || col.width || 160),
      0
    );

    return baseWidths + customTotal + 120; // 120px buffer for add column button and comfortable margin
  }, [columnWidths, visibleCustomColumns]);

  return (
    <div className="flex-1 overflow-x-auto overflow-y-auto bg-white relative min-h-[500px] pb-64">
      <table
        style={{ minWidth: `${totalTableWidth}px` }}
        className="min-w-max text-left border-collapse text-xs mb-36"
      >
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
              const isJira = col.type === 'jira_field' || !!col.jira_field_key;
              const isDraggingThis = draggingColId === col.id;
              const isOverThis = dragOverColId === col.id;

              return (
                <th
                  key={col.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', col.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggingColId(col.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverColId !== col.id) {
                      setDragOverColId(col.id);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverColId === col.id) setDragOverColId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const sourceId = e.dataTransfer.getData('text/plain') || draggingColId;
                    setDraggingColId(null);
                    setDragOverColId(null);
                    if (sourceId && sourceId !== col.id) {
                      handleColumnDrop(sourceId, col.id);
                    }
                  }}
                  onDragEnd={() => {
                    setDraggingColId(null);
                    setDragOverColId(null);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (!isJira && onOpenEditColumn) {
                      onOpenEditColumn(col);
                    }
                  }}
                  style={{ width: currentW, minWidth: 90 }}
                  className={`px-3 py-2.5 border-r border-gray-200 bg-[#f8f9fb] group relative select-none cursor-grab active:cursor-grabbing transition-all ${
                    isOverThis ? 'border-l-4 border-l-blue-600 bg-blue-50/80 shadow-inner' : ''
                  } ${isDraggingThis ? 'opacity-40' : ''}`}
                  title={
                    isJira
                      ? `${col.name} (Jira - Solo lectura)`
                      : `${col.name} (${
                          lang === 'es'
                            ? 'Doble clic para editar campo, arrastrar para mover'
                            : 'Double click to edit field, drag to reorder'
                        })`
                  }
                >
                  <div className="flex items-center justify-between gap-1 pr-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <GripVertical className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 shrink-0" />
                      {isJira ? (
                        <span className="px-1 py-0.2 text-[9px] bg-blue-100 text-blue-800 font-mono rounded font-bold">
                          JIRA
                        </span>
                      ) : col.type === 'formula' ? (
                        <span
                          className="px-1.5 py-0.2 text-[9px] bg-indigo-100 text-indigo-700 font-mono rounded font-bold"
                          title={col.formula ? `fx: ${col.formula}` : 'Fórmula'}
                        >
                          fx
                        </span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      )}
                      <span className="font-bold text-gray-800 truncate" title={col.name}>
                        {col.name}
                      </span>
                    </div>
                    {!isJira && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {onOpenEditColumn && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenEditColumn(col);
                            }}
                            title={lang === 'es' ? 'Editar campo' : 'Edit field'}
                            className="text-gray-400 hover:text-blue-600 p-0.5 rounded transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(t.remove_column_confirm)) {
                              onDeleteColumn(col.id);
                            }
                          }}
                          title={t.remove_column}
                          className="text-gray-400 hover:text-rose-500 p-0.5 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
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
                      <td
                        onClick={() => setSelectedCell({ issueKey: issue.key, colId: 'key' })}
                        className={`px-3 py-2 border-r border-gray-100 bg-white group-hover:bg-blue-50/20 sticky left-10 z-10 whitespace-nowrap cursor-pointer transition-all ${
                          selectedCell?.issueKey === issue.key && selectedCell?.colId === 'key'
                            ? 'ring-2 ring-blue-600 ring-inset bg-blue-50/30'
                            : ''
                        } ${
                          copiedCell?.issueKey === issue.key && copiedCell?.colId === 'key'
                            ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40'
                            : ''
                        }`}
                        title={
                          lang === 'es'
                            ? `${issue.key} (Clic para seleccionar, Ctrl+C para copiar)`
                            : `${issue.key} (Click to select, Ctrl+C to copy)`
                        }
                      >
                        <div className="flex items-center justify-between gap-1">
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
                                alert(
                                  lang === 'es'
                                    ? 'Configura tu dominio Jira en Ajustes (⚙️) para abrir tickets.'
                                    : 'Configure your Jira domain in Settings (⚙️) to open tickets.'
                                );
                              }
                            }}
                            className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 group/key"
                            title={jiraDomain ? `${t.open_in_jira} (${issue.key})` : issue.key}
                          >
                            <span>{issue.key}</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover/key:opacity-100 transition-opacity text-blue-500" />
                          </a>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyCell(issue.key, 'key');
                            }}
                            title={lang === 'es' ? 'Copiar clave (Ctrl+C)' : 'Copy key (Ctrl+C)'}
                            className="opacity-0 group-hover:opacity-100 hover:text-blue-600 text-gray-400 p-0.5 rounded transition-opacity cursor-pointer shrink-0"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Summary */}
                      <td
                        onClick={() => setSelectedCell({ issueKey: issue.key, colId: 'summary' })}
                        className={`px-3 py-2 border-r border-gray-100 bg-white group-hover:bg-blue-50/20 sticky left-40 z-10 max-w-[360px] truncate font-medium text-gray-900 cursor-pointer transition-all ${
                          selectedCell?.issueKey === issue.key && selectedCell?.colId === 'summary'
                            ? 'ring-2 ring-blue-600 ring-inset bg-blue-50/30'
                            : ''
                        } ${
                          copiedCell?.issueKey === issue.key && copiedCell?.colId === 'summary'
                            ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40'
                            : ''
                        }`}
                        title={
                          lang === 'es'
                            ? `${issue.summary} (Clic para seleccionar, Ctrl+C para copiar)`
                            : `${issue.summary} (Click to select, Ctrl+C to copy)`
                        }
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate" title={issue.summary}>
                            {issue.summary}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyCell(issue.key, 'summary');
                            }}
                            title={lang === 'es' ? 'Copiar resumen (Ctrl+C)' : 'Copy summary (Ctrl+C)'}
                            className="opacity-0 group-hover:opacity-100 hover:text-blue-600 text-gray-400 p-0.5 rounded transition-opacity cursor-pointer shrink-0"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Jira Status */}
                      <td
                        onClick={() => setSelectedCell({ issueKey: issue.key, colId: 'status' })}
                        className={`px-3 py-2 border-r border-gray-100 whitespace-nowrap cursor-pointer transition-all ${
                          selectedCell?.issueKey === issue.key && selectedCell?.colId === 'status'
                            ? 'ring-2 ring-blue-600 ring-inset bg-blue-50/30'
                            : ''
                        } ${
                          copiedCell?.issueKey === issue.key && copiedCell?.colId === 'status'
                            ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40'
                            : ''
                        }`}
                        title={
                          lang === 'es'
                            ? `${issue.jira_status} (Clic para seleccionar, Ctrl+C para copiar)`
                            : `${issue.jira_status} (Click to select, Ctrl+C to copy)`
                        }
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${getStatusBadge(
                              issue.jira_status_category
                            )}`}
                          >
                            {issue.jira_status}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyCell(issue.key, 'status');
                            }}
                            title={lang === 'es' ? 'Copiar estado (Ctrl+C)' : 'Copy status (Ctrl+C)'}
                            className="opacity-0 group-hover:opacity-100 hover:text-blue-600 text-gray-400 p-0.5 rounded transition-opacity cursor-pointer shrink-0"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Priority */}
                      <td
                        onClick={() => setSelectedCell({ issueKey: issue.key, colId: 'priority' })}
                        className={`px-3 py-2 border-r border-gray-100 whitespace-nowrap cursor-pointer transition-all ${
                          selectedCell?.issueKey === issue.key && selectedCell?.colId === 'priority'
                            ? 'ring-2 ring-blue-600 ring-inset bg-blue-50/30'
                            : ''
                        } ${
                          copiedCell?.issueKey === issue.key && copiedCell?.colId === 'priority'
                            ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40'
                            : ''
                        }`}
                        title={
                          lang === 'es'
                            ? `${issue.priority} (Clic para seleccionar, Ctrl+C para copiar)`
                            : `${issue.priority} (Click to select, Ctrl+C to copy)`
                        }
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getPriorityBadge(
                              issue.priority
                            )}`}
                          >
                            {issue.priority}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyCell(issue.key, 'priority');
                            }}
                            title={lang === 'es' ? 'Copiar prioridad (Ctrl+C)' : 'Copy priority (Ctrl+C)'}
                            className="opacity-0 group-hover:opacity-100 hover:text-blue-600 text-gray-400 p-0.5 rounded transition-opacity cursor-pointer shrink-0"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Assignee */}
                      <td
                        onClick={() => setSelectedCell({ issueKey: issue.key, colId: 'assignee' })}
                        className={`px-3 py-2 border-r border-gray-100 whitespace-nowrap cursor-pointer transition-all ${
                          selectedCell?.issueKey === issue.key && selectedCell?.colId === 'assignee'
                            ? 'ring-2 ring-blue-600 ring-inset bg-blue-50/30'
                            : ''
                        } ${
                          copiedCell?.issueKey === issue.key && copiedCell?.colId === 'assignee'
                            ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40'
                            : ''
                        }`}
                        title={
                          lang === 'es'
                            ? `${issue.assignee_name || t.unassigned} (Clic para seleccionar, Ctrl+C para copiar)`
                            : `${issue.assignee_name || t.unassigned} (Click to select, Ctrl+C to copy)`
                        }
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 truncate">
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
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyCell(issue.key, 'assignee');
                            }}
                            title={lang === 'es' ? 'Copiar asignado (Ctrl+C)' : 'Copy assignee (Ctrl+C)'}
                            className="opacity-0 group-hover:opacity-100 hover:text-blue-600 text-gray-400 p-0.5 rounded transition-opacity cursor-pointer shrink-0"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Custom Columns Cells */}
                      {visibleCustomColumns.map((col) => {
                        const rawCustomValue = issue.custom_values?.[col.id];
                        const isCurrentlyEditing =
                          editingCell?.issueKey === issue.key && editingCell?.colId === col.id;
                        const isSelected = selectedCell?.issueKey === issue.key && selectedCell?.colId === col.id;
                        const isCopied = copiedCell?.issueKey === issue.key && copiedCell?.colId === col.id;

                        // 1. Archivy Wiki Link Cell
                        if (col.type === 'archivy_link') {
                          return (
                            <td
                              key={col.id}
                              onClick={() => setSelectedCell({ issueKey: issue.key, colId: col.id })}
                              className={`px-3 py-1.5 border-r border-gray-100 cursor-pointer transition-all ${
                                isSelected ? 'ring-2 ring-blue-600 ring-inset bg-blue-50/30' : ''
                              } ${isCopied ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40' : ''}`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <button
                                  onClick={() => onOpenArchivyDrawer(issue)}
                                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors shadow-2xs cursor-pointer"
                                >
                                  <BookOpen className="w-3 h-3 text-purple-600" />
                                  <span>Wiki Doc</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyCell(issue.key, col.id);
                                  }}
                                  title={lang === 'es' ? 'Copiar clave del ticket (Ctrl+C)' : 'Copy issue key (Ctrl+C)'}
                                  className="opacity-0 group-hover:opacity-100 hover:text-blue-600 text-gray-400 p-0.5 rounded transition-opacity cursor-pointer"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          );
                        }

                        // 2. Single Select Cell (Local Custom)
                        if (col.type === 'single_select') {
                          const currentOpt = col.options?.find((o) => o.id === rawCustomValue);
                          const isDropdownOpen =
                            activeDropdown?.issueKey === issue.key && activeDropdown?.colId === col.id;

                          return (
                            <td
                              key={col.id}
                              onClick={() => setSelectedCell({ issueKey: issue.key, colId: col.id })}
                              className={`px-3 py-1.5 border-r border-gray-100 relative group/cell hover:bg-blue-50/40 cursor-pointer transition-all ${
                                isSelected ? 'ring-2 ring-blue-600 ring-inset bg-blue-50/30' : ''
                              } ${isCopied ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40' : ''}`}
                              title={
                                lang === 'es'
                                  ? `${currentOpt ? currentOpt.label : 'Sin opción'} (Clic para seleccionar, Ctrl+C para copiar, doble clic para elegir)`
                                  : `${currentOpt ? currentOpt.label : 'No option'} (Click to select, Ctrl+C to copy, double click to choose)`
                              }
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdown({ issueKey: issue.key, colId: col.id });
                              }}
                            >
                              <div className="flex items-center justify-between min-h-[22px] gap-1.5">
                                <div
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDropdown({ issueKey: issue.key, colId: col.id });
                                  }}
                                  className="inline-flex items-center gap-1.5 py-0.5 truncate flex-1"
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
                                    <span className="text-gray-400 text-xs hover:text-blue-600 italic">
                                      {t.col_select}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyCell(issue.key, col.id);
                                    }}
                                    className="opacity-0 group-hover/cell:opacity-100 p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-100/80 transition-all cursor-pointer"
                                    title={lang === 'es' ? 'Copiar opción (Ctrl+C)' : 'Copy option (Ctrl+C)'}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdown({ issueKey: issue.key, colId: col.id });
                                    }}
                                    className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-100/80 transition-colors cursor-pointer"
                                    title={lang === 'es' ? 'Seleccionar opción' : 'Select option'}
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
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

                        // 3. Jira Field Selectors Columns (STRICTLY READ-ONLY)
                        if (col.type === 'jira_field' || col.jira_field_key) {
                          const fieldKey = col.jira_field_key || col.id;
                          const jiraRawVal = issue.raw_jira_fields?.[fieldKey];
                          const isComponentField =
                            fieldKey.toLowerCase().includes('component') ||
                            col.name.toLowerCase().includes('component');

                          return (
                            <td
                              key={col.id}
                              onClick={() => setSelectedCell({ issueKey: issue.key, colId: col.id })}
                              className={`px-3 py-1.5 border-r border-gray-100 max-w-[280px] bg-slate-50/20 text-gray-800 cursor-pointer group/cell transition-all ${
                                isSelected ? 'ring-2 ring-blue-600 ring-inset bg-blue-50/30' : ''
                              } ${isCopied ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40' : ''}`}
                              title={`Jira (${fieldKey}) - Clic para seleccionar, Ctrl+C para copiar`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <div className="truncate flex-1">
                                  {isComponentField
                                    ? renderComponentPills(jiraRawVal)
                                    : renderJiraFieldValue(jiraRawVal, fieldKey)}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyCell(issue.key, col.id);
                                  }}
                                  className="opacity-0 group-hover/cell:opacity-100 p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-100/80 transition-all cursor-pointer shrink-0"
                                  title={lang === 'es' ? 'Copiar valor (Ctrl+C)' : 'Copy value (Ctrl+C)'}
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          );
                        }

                        // 3.5. Formula / Computed Field Columns (STRICTLY READ-ONLY)
                        if (col.type === 'formula') {
                          const result = evaluateFormula(col.formula, issue, columns);
                          const isError = result === 'Error: Formula';

                          // Match against configured color options for this column
                          const matchedOption = col.options?.find(
                            (o) =>
                              String(o.label).trim().toLowerCase() ===
                              String(result).trim().toLowerCase()
                          );

                          return (
                            <td
                              key={col.id}
                              onClick={() => setSelectedCell({ issueKey: issue.key, colId: col.id })}
                              className={`px-3 py-1.5 border-r border-gray-100 max-w-[220px] bg-slate-50/15 text-gray-800 cursor-pointer hover:bg-indigo-50/40 group/cell transition-all ${
                                isSelected ? 'ring-2 ring-blue-600 ring-inset bg-blue-50/30' : ''
                              } ${isCopied ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40' : ''}`}
                              title={
                                col.formula
                                  ? `${col.name} = ${col.formula}\nResultado: ${result ?? '(vacío)'}\n(${
                                      lang === 'es'
                                        ? 'Clic para seleccionar, Ctrl+C para copiar, doble clic para editar fórmula'
                                        : 'Click to select, Ctrl+C to copy, double click to edit formula'
                                    })`
                                  : `${col.name} (${
                                      lang === 'es'
                                        ? 'Clic para seleccionar, Ctrl+C para copiar, doble clic para configurar'
                                        : 'Click to select, Ctrl+C to copy, double click to configure'
                                    })`
                              }
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (onOpenEditColumn) {
                                  onOpenEditColumn(col);
                                }
                              }}
                            >
                              <div className="flex items-center justify-between min-h-[22px] gap-1 truncate">
                                <div className="truncate flex-1">
                                  {isError ? (
                                    <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-rose-100 text-rose-700 rounded border border-rose-200">
                                      #ERROR!
                                    </span>
                                  ) : matchedOption ? (
                                    <span
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-2xs ${getColorClasses(
                                        matchedOption.color
                                      )}`}
                                    >
                                      {String(result)}
                                    </span>
                                  ) : result === 1 || result === '1' || result === true ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                                      1
                                    </span>
                                  ) : result === 0 || result === '0' || result === false ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                      0
                                    </span>
                                  ) : result !== null && result !== undefined && String(result) !== '' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
                                      {String(result)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300 italic text-xs">-</span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyCell(issue.key, col.id);
                                  }}
                                  className="opacity-0 group-hover/cell:opacity-100 p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-100/80 transition-all cursor-pointer shrink-0"
                                  title={lang === 'es' ? 'Copiar resultado (Ctrl+C)' : 'Copy result (Ctrl+C)'}
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          );
                        }

                        // 4. Standard Custom Columns (Text, Long Text, Number, Date)
                        const displayVal =
                          rawCustomValue !== null && rawCustomValue !== undefined ? String(rawCustomValue) : '';

                        return (
                          <td
                            key={col.id}
                            onClick={() => setSelectedCell({ issueKey: issue.key, colId: col.id })}
                            className={`px-3 py-1.5 border-r border-gray-100 relative group/cell hover:bg-blue-50/40 cursor-pointer transition-all ${
                              isSelected ? 'ring-2 ring-blue-600 ring-inset bg-blue-50/30' : ''
                            } ${isCopied ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40' : ''}`}
                            title={
                              lang === 'es'
                                ? 'Clic para seleccionar (Ctrl+C copiar), doble clic o lápiz para editar'
                                : 'Click to select (Ctrl+C to copy), double click or pencil to edit'
                            }
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingCell({
                                issueKey: issue.key,
                                colId: col.id,
                                initialVal: displayVal,
                              });
                            }}
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
                              <div
                                className="flex items-center justify-between min-h-[22px] gap-1.5 w-full"
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCell({
                                    issueKey: issue.key,
                                    colId: col.id,
                                    initialVal: displayVal,
                                  });
                                }}
                              >
                                <span className="truncate text-gray-800 flex-1">
                                  {displayVal !== '' ? (
                                    <span>{displayVal}</span>
                                  ) : (
                                    <span className="text-gray-400 italic text-xs hover:text-blue-600">
                                      {t.col_empty}
                                    </span>
                                  )}
                                </span>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyCell(issue.key, col.id);
                                    }}
                                    className="opacity-0 group-hover/cell:opacity-100 p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-100/80 transition-all cursor-pointer"
                                    title={lang === 'es' ? 'Copiar texto (Ctrl+C)' : 'Copy text (Ctrl+C)'}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingCell({
                                        issueKey: issue.key,
                                        colId: col.id,
                                        initialVal: displayVal,
                                      });
                                    }}
                                    className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-100/80 transition-colors cursor-pointer"
                                    title="Editar campo"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
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

      {/* Airtable-style Floating Copy Toast */}
      {copyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-gray-900/95 text-white text-xs font-medium rounded-full shadow-2xl border border-gray-700 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-none">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{lang === 'es' ? 'Copiado al portapapeles:' : 'Copied to clipboard:'}</span>
          <span className="font-semibold text-emerald-300 max-w-[200px] truncate">
            {copyToast.text ? `"${copyToast.text}"` : lang === 'es' ? '(vacío)' : '(empty)'}
          </span>
          <span className="text-[10px] text-gray-400 border-l border-gray-700 pl-2">Ctrl+C</span>
        </div>
      )}
    </div>
  );
};
