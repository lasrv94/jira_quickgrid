import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Edit2,
  ExternalLink,
  GripVertical,
  Link2,
  Lock,
  Plus,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import type { CustomColumn, JiraIssue } from '../types';
import { getColorClasses } from '../utils/colors';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';
import { evaluateFormula } from '../utils/formulaEvaluator';
import { evaluateLookup } from '../utils/lookupEvaluator';
import { RecordPickerModal } from './RecordPickerModal';

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

// ----------------- CLIPBOARD & SPREADSHEET-STYLE COPY/PASTE HELPERS -----------------

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

async function readTextFromClipboard(): Promise<string> {
  if (navigator.clipboard && navigator.clipboard.readText) {
    try {
      return await navigator.clipboard.readText();
    } catch {
      // Permission or fallback
    }
  }
  return '';
}

/**
 * Parses tab-separated values (TSV) from Excel / Spreadsheet / Google Sheets clipboard data,
 * handling double quotes and embedded newlines correctly.
 */
function parseClipboardTable(text: string): string[][] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!clean.length) return [];

  // Fast path for simple clipboard text without quotes
  if (!clean.includes('"')) {
    const lines = clean.split('\n');
    if (lines.length > 1 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    return lines.map((line) => line.split('\t'));
  }

  // Full parser supporting quotes
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === '\t') {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (char === '\n') {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  if (rows.length > 1 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }

  return rows;
}

function normalizeForComparison(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function parseValueForColumn(rawValue: string, column: CustomColumn): any {
  if (column.type === 'single_select') {
    const trimmed = rawValue.trim();
    if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === '(vacío)' || trimmed.toLowerCase() === '(empty)') {
      return null;
    }
    const norm = normalizeForComparison(trimmed);
    const matched =
      column.options?.find((o) => o.id.toLowerCase() === trimmed.toLowerCase()) ||
      column.options?.find((o) => normalizeForComparison(o.label) === norm) ||
      column.options?.find((o) => normalizeForComparison(o.label).startsWith(norm)) ||
      column.options?.find((o) => norm.startsWith(normalizeForComparison(o.label)));

    return matched ? matched.id : undefined;
  }

  if (column.type === 'number') {
    const trimmed = rawValue.trim();
    if (!trimmed) return null;
    const cleaned = trimmed.replace(/\s+/g, '').replace(',', '.');
    const num = Number(cleaned);
    return !isNaN(num) ? num : undefined;
  }

  if (column.type === 'date') {
    const trimmed = rawValue.trim();
    if (!trimmed) return null;
    if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) return trimmed;
    // Check DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString().split('T')[0];
    }
    return trimmed;
  }

  if (column.type === 'text' || column.type === 'long_text') {
    return rawValue;
  }

  if (column.type === 'link_row') {
    const trimmed = rawValue.trim();
    if (!trimmed) return null;
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }

  return undefined;
}

function getCellValueAsText(
  issue: JiraIssue,
  colId: string,
  columns: CustomColumn[],
  allIssues?: JiraIssue[]
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

  if (col.type === 'link_row') {
    if (!rawCustom) return '';
    return Array.isArray(rawCustom) ? rawCustom.join(', ') : String(rawCustom);
  }

  if (col.type === 'lookup') {
    const results = evaluateLookup(issue, col, columns, allIssues || []);
    return results.map((r) => r.label).join(', ');
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
  allIssues?: JiraIssue[];
  tables?: import('../types').JiraFilter[];
  onUpdateCustomValue: (issueKey: string, columnId: string, value: any) => Promise<void>;
  onUpdateCustomValuesBulk?: (updates: Array<{ issueKey: string; columnId: string; value: any }>) => Promise<void>;
  onUpdateLocalIssue?: (key: string, data: Partial<JiraIssue>) => Promise<void>;
  onDeleteIssue?: (key: string) => Promise<void>;
  onOpenArchivyDrawer: (issue: JiraIssue) => void;
  onOpenAddColumn: () => void;
  onOpenEditColumn?: (col: CustomColumn) => void;
  onDeleteColumn: (colId: string) => Promise<void>;
  onUpdateColumnWidth?: (colId: string, width: number) => Promise<void>;
  onReorderColumns?: (reorderedCols: CustomColumn[]) => Promise<void>;
  groupBy: string | null;
  jiraDomain?: string;
  isLocalTable?: boolean;
  lang?: Language;
}

export const DataGrid: React.FC<Props> = ({
  issues,
  columns,
  allIssues,
  tables,
  onUpdateCustomValue,
  onUpdateCustomValuesBulk,
  onUpdateLocalIssue,
  onDeleteIssue,
  onOpenArchivyDrawer,
  onOpenAddColumn,
  onOpenEditColumn,
  onDeleteColumn,
  onUpdateColumnWidth,
  onReorderColumns,
  groupBy,
  jiraDomain,
  isLocalTable = false,
  lang = 'es',
}) => {
  const t = getTranslation(lang);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Active cell currently being edited (with input)
  const [editingCell, setEditingCell] = useState<{ issueKey: string; colId: string; initialVal: string } | null>(null);

  // Active dropdown open (for single_select)
  const [activeDropdown, setActiveDropdown] = useState<{ issueKey: string; colId: string } | null>(null);

  // Active record picker modal (for link_row)
  const [activePicker, setActivePicker] = useState<{
    issueKey: string;
    column: CustomColumn;
    selectedKeys: string[];
    targetTableName: string;
    targetIssues: JiraIssue[];
  } | null>(null);

  const handleOpenPicker = (issue: JiraIssue, col: CustomColumn) => {
    const targetTableId = col.link_row?.target_table_id;
    const targetTable = tables?.find((t) => t.id === targetTableId);
    const targetTableName = targetTable?.name || targetTableId || 'Records';
    const pool = allIssues && allIssues.length > 0 ? allIssues : issues;
    const targetIssues = targetTableId ? pool.filter((i) => i.table_id === targetTableId) : pool;

    const rawVal = issue.custom_values?.[col.id];
    const selectedKeys: string[] = Array.isArray(rawVal)
      ? rawVal
      : rawVal
      ? [String(rawVal)]
      : [];

    setActivePicker({
      issueKey: issue.key,
      column: col,
      selectedKeys,
      targetTableName,
      targetIssues,
    });
  };

  // Grid / Spreadsheet style cell selection and copy/paste state
  const [selectedCell, setSelectedCell] = useState<{ issueKey: string; colId: string } | null>(null);
  const [selectionEndCell, setSelectionEndCell] = useState<{ issueKey: string; colId: string } | null>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const isSelectingRef = useRef<boolean>(false);
  const isSelectingRowsRef = useRef<boolean>(false);
  const [copiedCell, setCopiedCell] = useState<{ issueKey: string; colId: string } | null>(null);
  const [copyToast, setCopyToast] = useState<{ text: string } | null>(null);
  const [pasteToast, setPasteToast] = useState<{ message: string; subtext?: string; isError?: boolean } | null>(null);
  const [pastedCells, setPastedCells] = useState<Set<string>>(new Set());
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pasteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPasteTimeRef = useRef<number>(0);

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

  const visibleCustomColumns = useMemo(() => {
    let filtered = columns.filter((c) => c.is_visible);
    if (isLocalTable) {
      filtered = filtered.filter((c) => c.type !== 'jira_field' && !c.jira_field_key);
    }
    return filtered.sort((a, b) => a.position - b.position);
  }, [columns, isLocalTable]);

  // Grouping logic
  const groupedData = useMemo(() => {
    if (!groupBy) {
      const defaultGroupLabel = isLocalTable
        ? (lang === 'es' ? 'Todos los registros' : 'All records')
        : (lang === 'es' ? 'Todos los tickets' : 'All tickets');
      return [{ groupKey: 'all', groupLabel: defaultGroupLabel, items: issues }];
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
  }, [issues, groupBy, columns, isLocalTable, lang]);

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // Flattened visible issues across expanded groups
  const visibleIssues = useMemo(
    () => groupedData.flatMap((g) => (collapsedGroups[g.groupKey] ? [] : g.items)),
    [groupedData, collapsedGroups]
  );

  // Complete column ID ordering in the grid
  const allColumnIds = useMemo(
    () => isLocalTable
      ? ['summary', ...visibleCustomColumns.map((c) => c.id)]
      : ['key', 'summary', 'status', 'priority', 'assignee', ...visibleCustomColumns.map((c) => c.id)],
    [visibleCustomColumns, isLocalTable]
  );

  // Range and Cell Selection Helpers
  const rangeBounds = useMemo(() => {
    if (!selectedCell) return null;
    const startRow = visibleIssues.findIndex((i) => i.key === selectedCell.issueKey);
    const endRow = selectionEndCell ? visibleIssues.findIndex((i) => i.key === selectionEndCell.issueKey) : startRow;
    const startCol = allColumnIds.indexOf(selectedCell.colId);
    const endCol = selectionEndCell ? allColumnIds.indexOf(selectionEndCell.colId) : startCol;

    if (startRow === -1 || startCol === -1 || endRow === -1 || endCol === -1) {
      return null;
    }

    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const rowCount = maxRow - minRow + 1;
    const colCount = maxCol - minCol + 1;
    const totalCells = rowCount * colCount;

    return {
      minRow,
      maxRow,
      minCol,
      maxCol,
      hasRange: totalCells > 1,
      rowCount,
      colCount,
      totalCells,
      bottomRightKey: visibleIssues[maxRow]?.key,
      bottomRightColId: allColumnIds[maxCol],
    };
  }, [selectedCell, selectionEndCell, visibleIssues, allColumnIds]);

  const rangeStats = useMemo(() => {
    if (!rangeBounds || !rangeBounds.hasRange) return null;

    let numericSum = 0;
    let numericCount = 0;

    for (let r = rangeBounds.minRow; r <= rangeBounds.maxRow; r++) {
      const issue = visibleIssues[r];
      if (!issue) continue;
      for (let c = rangeBounds.minCol; c <= rangeBounds.maxCol; c++) {
        const cid = allColumnIds[c];
        const textVal = getCellValueAsText(issue, cid, columns, allIssues || issues).trim();
        const num = Number(textVal);
        if (textVal !== '' && !isNaN(num)) {
          numericSum += num;
          numericCount++;
        }
      }
    }

    return {
      ...rangeBounds,
      numericSum,
      numericCount,
      numericAvg: numericCount > 0 ? numericSum / numericCount : null,
    };
  }, [rangeBounds, visibleIssues, allColumnIds, columns, allIssues, issues]);


  const getCellClasses = useCallback(
    (issueKey: string, colId: string): string => {
      const cellKey = `${issueKey}:${colId}`;
      if (pastedCells.has(cellKey)) {
        return 'ring-2 ring-emerald-500 ring-inset bg-emerald-100/70 transition-all duration-300';
      }
      if (copiedCell?.issueKey === issueKey && copiedCell?.colId === colId) {
        return 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/50';
      }

      const isPrimary = selectedCell?.issueKey === issueKey && selectedCell?.colId === colId;

      if (!rangeBounds) {
        if (isPrimary) {
          return 'ring-2 ring-blue-600 ring-inset bg-blue-50/50 z-10 relative';
        }
        return '';
      }

      const curRow = visibleIssues.findIndex((i) => i.key === issueKey);
      const curCol = allColumnIds.indexOf(colId);

      if (
        curRow >= rangeBounds.minRow &&
        curRow <= rangeBounds.maxRow &&
        curCol >= rangeBounds.minCol &&
        curCol <= rangeBounds.maxCol
      ) {
        if (!rangeBounds.hasRange) {
          return 'ring-2 ring-blue-600 ring-inset bg-blue-50/50 z-10 relative';
        }

        const isTop = curRow === rangeBounds.minRow;
        const isBottom = curRow === rangeBounds.maxRow;
        const isLeft = curCol === rangeBounds.minCol;
        const isRight = curCol === rangeBounds.maxCol;

        let edgeClasses = 'bg-blue-100/35 relative z-10 ';
        if (isPrimary) {
          edgeClasses += 'ring-2 ring-blue-600 ring-inset font-medium ';
        }
        if (isTop) edgeClasses += 'border-t-2 !border-t-blue-600 ';
        if (isBottom) edgeClasses += 'border-b-2 !border-b-blue-600 ';
        if (isLeft) edgeClasses += 'border-l-2 !border-l-blue-600 ';
        if (isRight) edgeClasses += 'border-r-2 !border-r-blue-600 ';

        return edgeClasses;
      }

      return '';
    },
    [pastedCells, copiedCell, selectedCell, rangeBounds, visibleIssues, allColumnIds]
  );

  const handleCellMouseDown = useCallback(
    (issueKey: string, colId: string, e: React.MouseEvent) => {
      if (e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest('button, a, input, select, textarea, [data-interactive="true"]')) {
        return;
      }

      if (e.shiftKey && selectedCell) {
        e.preventDefault();
        setSelectionEndCell({ issueKey, colId });
      } else {
        e.preventDefault();
        setSelectedCell({ issueKey, colId });
        setSelectionEndCell(null);
        isSelectingRef.current = true;
        isSelectingRowsRef.current = false;
        setIsSelecting(true);
      }
    },
    [selectedCell]
  );

  const handleCellMouseEnter = useCallback(
    (issueKey: string, colId: string) => {
      if (!isSelectingRef.current || !selectedCell) return;
      setSelectionEndCell({ issueKey, colId });
    },
    [selectedCell]
  );

  const handleRowIndexMouseDown = useCallback(
    (issueKey: string, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const firstCol = allColumnIds[0];
      const lastCol = allColumnIds[allColumnIds.length - 1];

      if (e.shiftKey && selectedCell) {
        setSelectionEndCell({ issueKey, colId: lastCol });
      } else {
        setSelectedCell({ issueKey, colId: firstCol });
        setSelectionEndCell({ issueKey, colId: lastCol });
        isSelectingRowsRef.current = true;
        isSelectingRef.current = false;
        setIsSelecting(true);
      }
    },
    [selectedCell, allColumnIds]
  );

  const handleRowIndexMouseEnter = useCallback(
    (issueKey: string) => {
      if (!isSelectingRowsRef.current || !selectedCell) return;
      const lastCol = allColumnIds[allColumnIds.length - 1];
      setSelectionEndCell({ issueKey, colId: lastCol });
    },
    [selectedCell, allColumnIds]
  );

  const handleCellClick = useCallback(
    (issueKey: string, colId: string, e: React.MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, a, input, select, textarea, [data-interactive="true"]')) {
        return;
      }
      if (e.shiftKey && selectedCell) {
        setSelectionEndCell({ issueKey, colId });
      }
    },
    [selectedCell]
  );

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSelectingRef.current || isSelectingRowsRef.current) {
        isSelectingRef.current = false;
        isSelectingRowsRef.current = false;
        setIsSelecting(false);
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const renderCornerHandle = (issueKey: string, colId: string) => {
    if (rangeBounds?.bottomRightKey === issueKey && rangeBounds?.bottomRightColId === colId) {
      return (
        <div
          className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-600 border border-white shadow-xs z-30 pointer-events-none"
          title={lang === 'es' ? 'Rango seleccionado' : 'Selected range'}
        />
      );
    }
    return null;
  };

  // Copy handler (handles single cell or multi-cell rectangular range)
  const handleCopyCell = useCallback(
    (specifiedIssueKey?: string, specifiedColId?: string) => {
      let textToCopy = '';
      let cellCount = 1;

      if (specifiedIssueKey && specifiedColId) {
        const issue = issues.find((i) => i.key === specifiedIssueKey);
        if (!issue) return;
        textToCopy = getCellValueAsText(issue, specifiedColId, columns, allIssues || issues);
        setCopiedCell({ issueKey: specifiedIssueKey, colId: specifiedColId });
      } else if (
        selectedCell &&
        selectionEndCell &&
        (selectedCell.issueKey !== selectionEndCell.issueKey || selectedCell.colId !== selectionEndCell.colId)
      ) {
        const startRow = visibleIssues.findIndex((i) => i.key === selectedCell.issueKey);
        const endRow = visibleIssues.findIndex((i) => i.key === selectionEndCell.issueKey);
        const startCol = allColumnIds.indexOf(selectedCell.colId);
        const endCol = allColumnIds.indexOf(selectionEndCell.colId);

        if (startRow !== -1 && endRow !== -1 && startCol !== -1 && endCol !== -1) {
          const minRow = Math.min(startRow, endRow);
          const maxRow = Math.max(startRow, endRow);
          const minCol = Math.min(startCol, endCol);
          const maxCol = Math.max(startCol, endCol);

          const rows: string[] = [];
          cellCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);

          for (let r = minRow; r <= maxRow; r++) {
            const rowIssue = visibleIssues[r];
            if (!rowIssue) continue;
            const colsText: string[] = [];
            for (let c = minCol; c <= maxCol; c++) {
              const cid = allColumnIds[c];
              colsText.push(getCellValueAsText(rowIssue, cid, columns, allIssues || issues));
            }
            rows.push(colsText.join('\t'));
          }
          textToCopy = rows.join('\n');
          setCopiedCell({ issueKey: selectedCell.issueKey, colId: selectedCell.colId });
        }
      } else if (selectedCell) {
        const issue = issues.find((i) => i.key === selectedCell.issueKey);
        if (!issue) return;
        textToCopy = getCellValueAsText(issue, selectedCell.colId, columns, allIssues || issues);
        setCopiedCell({ issueKey: selectedCell.issueKey, colId: selectedCell.colId });
      } else {
        return;
      }

      copyTextToClipboard(textToCopy).then(() => {
        setCopyToast({
          text:
            cellCount > 1
              ? lang === 'es'
                ? `${cellCount} celdas copiadas`
                : `${cellCount} cells copied`
              : textToCopy.length > 45
              ? `${textToCopy.substring(0, 42)}...`
              : textToCopy,
        });

        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => {
          setCopiedCell(null);
          setCopyToast(null);
        }, 2000);
      });
    },
    [issues, columns, allIssues, selectedCell, selectionEndCell, visibleIssues, allColumnIds, lang]
  );

  // Paste handler (Matrix paste logic)
  const handlePasteData = useCallback(
    async (clipboardText: string, targetCellOverride?: { issueKey: string; colId: string }) => {
      const activeStart = targetCellOverride || selectedCell;
      if (!activeStart) return;

      const matrix = parseClipboardTable(clipboardText);
      if (matrix.length === 0 || matrix[0].length === 0) return;

      const startRowIdx = visibleIssues.findIndex((i) => i.key === activeStart.issueKey);
      const startColIdx = allColumnIds.indexOf(activeStart.colId);
      if (startRowIdx === -1 || startColIdx === -1) return;

      const isSingleValue = matrix.length === 1 && matrix[0].length === 1;
      const hasRange =
        !targetCellOverride &&
        selectionEndCell &&
        (selectionEndCell.issueKey !== selectedCell?.issueKey || selectionEndCell.colId !== selectedCell?.colId);

      const updates: Array<{ issueKey: string; columnId: string; value: any }> = [];
      const touchedCellKeys = new Set<string>();
      let attemptedReadOnlyCount = 0;

      if (isSingleValue && hasRange && selectedCell && selectionEndCell) {
        // Spreadsheet behavior: If pasting 1 value onto a selected range, fill all editable cells in the range
        const singleRawVal = matrix[0][0];
        const endRowIdx = visibleIssues.findIndex((i) => i.key === selectionEndCell.issueKey);
        const endColIdx = allColumnIds.indexOf(selectionEndCell.colId);

        const minRow = Math.min(startRowIdx, endRowIdx !== -1 ? endRowIdx : startRowIdx);
        const maxRow = Math.max(startRowIdx, endRowIdx !== -1 ? endRowIdx : startRowIdx);
        const minCol = Math.min(startColIdx, endColIdx !== -1 ? endColIdx : startColIdx);
        const maxCol = Math.max(startColIdx, endColIdx !== -1 ? endColIdx : startColIdx);

        for (let r = minRow; r <= maxRow; r++) {
          const issue = visibleIssues[r];
          if (!issue) continue;
          for (let c = minCol; c <= maxCol; c++) {
            const colId = allColumnIds[c];
            const col = columns.find((colItem) => colItem.id === colId);
            if (
              !col ||
              col.type === 'archivy_link' ||
              col.type === 'jira_field' ||
              col.jira_field_key ||
              col.type === 'formula' ||
              col.type === 'lookup'
            ) {
              attemptedReadOnlyCount++;
              continue;
            }
            const parsedVal = parseValueForColumn(singleRawVal, col);
            if (parsedVal !== undefined) {
              updates.push({ issueKey: issue.key, columnId: col.id, value: parsedVal });
              touchedCellKeys.add(`${issue.key}:${col.id}`);
            }
          }
        }
      } else {
        // Multi-cell block paste starting at activeStart
        for (let r = 0; r < matrix.length; r++) {
          const targetRowIdx = startRowIdx + r;
          if (targetRowIdx >= visibleIssues.length) break;
          const issue = visibleIssues[targetRowIdx];

          for (let c = 0; c < matrix[r].length; c++) {
            const targetColIdx = startColIdx + c;
            if (targetColIdx >= allColumnIds.length) break;
            const colId = allColumnIds[targetColIdx];
            const col = columns.find((colItem) => colItem.id === colId);

            if (
              !col ||
              col.type === 'archivy_link' ||
              col.type === 'jira_field' ||
              col.jira_field_key ||
              col.type === 'formula' ||
              col.type === 'lookup'
            ) {
              attemptedReadOnlyCount++;
              continue;
            }

            const parsedVal = parseValueForColumn(matrix[r][c], col);
            if (parsedVal !== undefined) {
              updates.push({ issueKey: issue.key, columnId: col.id, value: parsedVal });
              touchedCellKeys.add(`${issue.key}:${col.id}`);
            }
          }
        }
      }

      if (updates.length === 0) {
        if (attemptedReadOnlyCount > 0) {
          if (pasteTimeoutRef.current) clearTimeout(pasteTimeoutRef.current);
          setPasteToast({
            message:
              lang === 'es'
                ? 'Los campos nativos de Jira y fórmulas son de solo lectura.'
                : 'Jira native fields and formulas are read-only.',
            subtext:
              lang === 'es'
                ? 'Selecciona una o más columnas personalizadas para pegar.'
                : 'Select one or more custom columns to paste.',
            isError: true,
          });
          pasteTimeoutRef.current = setTimeout(() => setPasteToast(null), 3500);
        }
        return;
      }

      // Execute updates
      if (onUpdateCustomValuesBulk) {
        await onUpdateCustomValuesBulk(updates);
      } else {
        await Promise.all(updates.map((u) => onUpdateCustomValue(u.issueKey, u.columnId, u.value)));
      }

      // Visual feedback highlight
      setPastedCells(touchedCellKeys);
      setTimeout(() => {
        setPastedCells(new Set());
      }, 1800);

      const preview = updates.length === 1 ? String(updates[0].value ?? '(vacío)') : '';
      if (pasteTimeoutRef.current) clearTimeout(pasteTimeoutRef.current);
      setPasteToast({
        message:
          updates.length === 1
            ? lang === 'es'
              ? `Pegado en 1 celda: "${preview.length > 25 ? preview.substring(0, 22) + '...' : preview}"`
              : `Pasted into 1 cell: "${preview.length > 25 ? preview.substring(0, 22) + '...' : preview}"`
            : lang === 'es'
            ? `Pegado exitoso en ${updates.length} celdas`
            : `Successfully pasted into ${updates.length} cells`,
        subtext:
          isSingleValue && updates.length > 1
            ? lang === 'es'
              ? 'Valor aplicado en todo el rango seleccionado'
              : 'Value applied across selected range'
            : undefined,
        isError: false,
      });

      pasteTimeoutRef.current = setTimeout(() => setPasteToast(null), 2500);
    },
    [
      selectedCell,
      selectionEndCell,
      visibleIssues,
      allColumnIds,
      columns,
      lang,
      onUpdateCustomValuesBulk,
      onUpdateCustomValue,
    ]
  );

  // Paste handler for hover action button
  const handlePasteToCell = useCallback(
    async (issueKey: string, colId: string) => {
      try {
        const text = await readTextFromClipboard();
        if (text) {
          await handlePasteData(text, { issueKey, colId });
        } else {
          if (pasteTimeoutRef.current) clearTimeout(pasteTimeoutRef.current);
          setPasteToast({
            message: lang === 'es' ? 'El portapapeles está vacío' : 'Clipboard is empty',
            isError: true,
          });
          pasteTimeoutRef.current = setTimeout(() => setPasteToast(null), 2000);
        }
      } catch (err) {
        console.error('Clipboard read failed:', err);
        if (pasteTimeoutRef.current) clearTimeout(pasteTimeoutRef.current);
        setPasteToast({
          message:
            lang === 'es'
              ? 'Permiso de portapapeles denegado. Usa Ctrl+V para pegar.'
              : 'Clipboard permission denied. Use Ctrl+V to paste.',
          isError: true,
        });
        pasteTimeoutRef.current = setTimeout(() => setPasteToast(null), 3000);
      }
    },
    [handlePasteData, lang]
  );

  // Clear cells on Delete / Backspace
  const handleClearSelectedCells = useCallback(async () => {
    if (!selectedCell) return;

    const updates: Array<{ issueKey: string; columnId: string; value: any }> = [];
    const touchedCellKeys = new Set<string>();

    const startRow = visibleIssues.findIndex((i) => i.key === selectedCell.issueKey);
    const endRow = selectionEndCell ? visibleIssues.findIndex((i) => i.key === selectionEndCell.issueKey) : startRow;
    const startCol = allColumnIds.indexOf(selectedCell.colId);
    const endCol = selectionEndCell ? allColumnIds.indexOf(selectionEndCell.colId) : startCol;

    if (startRow === -1 || startCol === -1) return;

    const minRow = Math.min(startRow, endRow !== -1 ? endRow : startRow);
    const maxRow = Math.max(startRow, endRow !== -1 ? endRow : startRow);
    const minCol = Math.min(startCol, endCol !== -1 ? endCol : startCol);
    const maxCol = Math.max(startCol, endCol !== -1 ? endCol : startCol);

    for (let r = minRow; r <= maxRow; r++) {
      const issue = visibleIssues[r];
      if (!issue) continue;
      for (let c = minCol; c <= maxCol; c++) {
        const colId = allColumnIds[c];
        const col = columns.find((ci) => ci.id === colId);
        if (
          !col ||
          col.type === 'archivy_link' ||
          col.type === 'jira_field' ||
          col.jira_field_key ||
          col.type === 'formula' ||
          col.type === 'lookup'
        ) {
          continue;
        }
        updates.push({ issueKey: issue.key, columnId: col.id, value: null });
        touchedCellKeys.add(`${issue.key}:${col.id}`);
      }
    }

    if (updates.length === 0) return;

    if (onUpdateCustomValuesBulk) {
      await onUpdateCustomValuesBulk(updates);
    } else {
      await Promise.all(updates.map((u) => onUpdateCustomValue(u.issueKey, u.columnId, u.value)));
    }

    setPastedCells(touchedCellKeys);
    setTimeout(() => setPastedCells(new Set()), 1200);
  }, [
    selectedCell,
    selectionEndCell,
    visibleIssues,
    allColumnIds,
    columns,
    onUpdateCustomValuesBulk,
    onUpdateCustomValue,
  ]);

  // Window paste event listener
  useEffect(() => {
    const handlePasteEvent = (e: ClipboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (!selectedCell) return;

      const text = e.clipboardData?.getData('text/plain') || '';
      if (!text) return;

      e.preventDefault();
      lastPasteTimeRef.current = Date.now();
      handlePasteData(text);
    };

    window.addEventListener('paste', handlePasteEvent);
    return () => window.removeEventListener('paste', handlePasteEvent);
  }, [selectedCell, handlePasteData]);

  // Grid / Spreadsheet Style Keyboard Navigation & Shortcuts
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
        handleCopyCell();
        return;
      }

      // 1.5. Paste: Ctrl+V or Cmd+V (backup for paste event)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (Date.now() - lastPasteTimeRef.current < 250) {
          return;
        }
        e.preventDefault();
        lastPasteTimeRef.current = Date.now();
        readTextFromClipboard().then((text) => {
          if (text) handlePasteData(text);
        });
        return;
      }

      // 2. Deselect: Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedCell(null);
        setSelectionEndCell(null);
        return;
      }

      // 2.5 Clear cell(s): Delete or Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleClearSelectedCells();
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
          } else if (col.type !== 'jira_field' && col.type !== 'archivy_link' && col.type !== 'lookup') {
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

      // 4. Arrow navigation (Spreadsheet-style keyboard navigation & Shift range selection)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const anchor = selectionEndCell || selectedCell;
        const currentEndColIdx = allColumnIds.indexOf(anchor.colId);
        const currentEndRowIdx = visibleIssues.findIndex((i) => i.key === anchor.issueKey);
        if (currentEndColIdx === -1 || currentEndRowIdx === -1) return;

        let nextColIdx = currentEndColIdx;
        let nextRowIdx = currentEndRowIdx;

        if (e.key === 'ArrowLeft') nextColIdx = Math.max(0, currentEndColIdx - 1);
        if (e.key === 'ArrowRight') nextColIdx = Math.min(allColumnIds.length - 1, currentEndColIdx + 1);
        if (e.key === 'ArrowUp') nextRowIdx = Math.max(0, currentEndRowIdx - 1);
        if (e.key === 'ArrowDown') nextRowIdx = Math.min(visibleIssues.length - 1, currentEndRowIdx + 1);

        const nextIssue = visibleIssues[nextRowIdx];
        const nextColId = allColumnIds[nextColIdx];
        if (nextIssue && nextColId) {
          if (e.shiftKey) {
            setSelectionEndCell({ issueKey: nextIssue.key, colId: nextColId });
          } else {
            setSelectedCell({ issueKey: nextIssue.key, colId: nextColId });
            setSelectionEndCell(null);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedCell,
    selectionEndCell,
    handleCopyCell,
    handlePasteData,
    handleClearSelectedCells,
    columns,
    issues,
    allColumnIds,
    visibleIssues,
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
    const baseWidths = isLocalTable
      ? 40 + (columnWidths.summary || 340)
      : 40 + // row index #
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
  }, [columnWidths, visibleCustomColumns, isLocalTable]);

  return (
    <div className="flex-1 overflow-x-auto overflow-y-auto bg-white relative min-h-[500px] pb-64">
      <table
        style={{ minWidth: `${totalTableWidth}px` }}
        className={`min-w-max text-left border-collapse text-xs mb-36 ${isSelecting ? 'select-none' : ''}`}
      >
        {/* Table Header */}
        <thead className="bg-[#f8f9fb] sticky top-0 z-20 border-b border-gray-200 text-gray-600 font-semibold uppercase text-[11px] tracking-wider select-none">
          <tr>
            {/* Row Number */}
            <th className="w-10 px-3 py-2.5 text-center border-r border-gray-200 bg-[#f8f9fb] sticky left-0 z-30">
              #
            </th>

            {/* Jira Key */}
            {!isLocalTable && (
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
            )}

            {/* Summary / Name */}
            <th
              style={{ width: columnWidths.summary || 340, minWidth: 200 }}
              className={`px-3 py-2.5 border-r border-gray-200 bg-[#f8f9fb] sticky ${isLocalTable ? 'left-10' : 'left-40'} z-30 relative group`}
            >
              <div className="flex items-center gap-1.5">
                {isLocalTable ? (
                  <Type className="w-3.5 h-3.5 text-indigo-600" />
                ) : (
                  <Lock className="w-3 h-3 text-gray-400" />
                )}
                <span className={isLocalTable ? 'text-indigo-950 font-bold' : ''}>
                  {isLocalTable ? (lang === 'es' ? 'Nombre' : 'Name') : t.col_summary}
                </span>
                {isLocalTable && (
                  <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200/60 rounded px-1 py-0.2">
                    {lang === 'es' ? 'Principal' : 'Primary'}
                  </span>
                )}
              </div>
              <div
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors z-40"
                onMouseDown={(e) => handleResizeStart(e, 'summary', columnWidths.summary || 340)}
                title="Arrastrar para redimensionar"
              />
            </th>

            {/* If NOT isLocalTable: Status, Priority, Assignee */}
            {!isLocalTable && (
              <>
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
              </>
            )}

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
                      colSpan={(isLocalTable ? 2 : 6) + visibleCustomColumns.length + 1}
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
                          {group.items.length}{' '}
                          {group.items.length === 1
                            ? isLocalTable
                              ? lang === 'es' ? 'registro' : 'record'
                              : 'ticket'
                            : isLocalTable
                            ? lang === 'es' ? 'registros' : 'records'
                            : 'tickets'}
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
                      {(() => {
                        const isLocalIssue = Boolean(issue.table_id?.startsWith('tbl-') || !issue.jira_id);
                        return (
                          <td
                            onMouseDown={(e) => handleRowIndexMouseDown(issue.key, e)}
                            onMouseEnter={() => handleRowIndexMouseEnter(issue.key)}
                            className="px-2 py-2 text-center text-gray-400 font-mono text-[11px] border-r border-gray-100 bg-white group-hover:bg-blue-50/20 sticky left-0 z-10 cursor-pointer select-none hover:text-blue-600 transition-colors"
                            title={lang === 'es' ? 'Clic o arrastrar para seleccionar fila completa' : 'Click or drag to select entire row'}
                          >
                            <div className="flex items-center justify-center relative group/rowidx">
                              {isLocalIssue && onDeleteIssue ? (
                                <>
                                  <span className="group-hover/rowidx:hidden">{idx + 1}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (
                                        window.confirm(
                                          lang === 'es'
                                            ? `¿Eliminar fila ${issue.key}?`
                                            : `Delete row ${issue.key}?`
                                        )
                                      ) {
                                        onDeleteIssue(issue.key);
                                      }
                                    }}
                                    className="hidden group-hover/rowidx:flex items-center justify-center p-0.5 text-rose-500 hover:text-rose-700 transition-colors"
                                    title={lang === 'es' ? 'Eliminar fila' : 'Delete row'}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </>
                              ) : (
                                <span>{idx + 1}</span>
                              )}
                            </div>
                          </td>
                        );
                      })()}

                      {/* Key */}
                      {!isLocalTable && (
                        <td
                          onMouseDown={(e) => handleCellMouseDown(issue.key, 'key', e)}
                          onMouseEnter={() => handleCellMouseEnter(issue.key, 'key')}
                          onClick={(e) => handleCellClick(issue.key, 'key', e)}
                          className={`px-3 py-2 border-r border-gray-100 bg-white group-hover:bg-blue-50/20 sticky left-10 z-10 whitespace-nowrap cursor-pointer transition-all ${getCellClasses(
                            issue.key,
                            'key'
                          )}`}
                          title={
                            lang === 'es'
                              ? `${issue.key} (Clic o arrastrar para seleccionar, Ctrl+C para copiar)`
                              : `${issue.key} (Click or drag to select, Ctrl+C to copy)`
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
                          {renderCornerHandle(issue.key, 'key')}
                        </td>
                      )}

                      {/* Summary */}
                      {(() => {
                        const isLocalIssue = Boolean(issue.table_id?.startsWith('tbl-') || !issue.jira_id);
                        const isEditingSummary = editingCell?.issueKey === issue.key && editingCell?.colId === 'summary';

                        return (
                          <td
                            onMouseDown={(e) => handleCellMouseDown(issue.key, 'summary', e)}
                            onMouseEnter={() => handleCellMouseEnter(issue.key, 'summary')}
                            onClick={(e) => handleCellClick(issue.key, 'summary', e)}
                            onDoubleClick={(e) => {
                              if (isLocalIssue && onUpdateLocalIssue) {
                                e.stopPropagation();
                                setEditingCell({
                                  issueKey: issue.key,
                                  colId: 'summary',
                                  initialVal: issue.summary || '',
                                });
                              }
                            }}
                            className={`px-3 py-2 border-r border-gray-100 bg-white group-hover:bg-blue-50/20 sticky ${isLocalTable ? 'left-10' : 'left-40'} z-10 max-w-[360px] truncate font-medium text-gray-900 cursor-pointer transition-all ${getCellClasses(
                              issue.key,
                              'summary'
                            )}`}
                            title={
                              isLocalIssue
                                ? `${issue.summary || ''} (${lang === 'es' ? 'Doble clic para editar' : 'Double click to edit'})`
                                : `${issue.summary} (${lang === 'es' ? 'Clic o arrastrar para seleccionar, Ctrl+C para copiar' : 'Click or drag to select, Ctrl+C to copy'})`
                            }
                          >
                            {isEditingSummary && onUpdateLocalIssue ? (
                              <InlineCellEditor
                                initialValue={issue.summary || ''}
                                type="text"
                                onSave={(newVal) => {
                                  onUpdateLocalIssue(issue.key, { summary: newVal });
                                  setEditingCell(null);
                                }}
                                onCancel={() => setEditingCell(null)}
                              />
                            ) : (
                              <div className="flex items-center justify-between gap-1">
                                <span className={`truncate ${!issue.summary ? 'italic text-gray-400 font-normal' : ''}`} title={issue.summary || ''}>
                                  {issue.summary || (isLocalTable ? (lang === 'es' ? '(Sin nombre)' : '(Untitled)') : '')}
                                </span>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  {isLocalIssue && onUpdateLocalIssue && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingCell({
                                          issueKey: issue.key,
                                          colId: 'summary',
                                          initialVal: issue.summary || '',
                                        });
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-100/80 transition-all cursor-pointer"
                                      title={lang === 'es' ? 'Editar nombre' : 'Edit name'}
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  )}
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
                              </div>
                            )}
                            {renderCornerHandle(issue.key, 'summary')}
                          </td>
                        );
                      })()}

                      {/* Jira Status, Priority, Assignee (Only for Jira Tables) */}
                      {!isLocalTable && (
                        <>
                          {/* Jira Status */}
                          <td
                            onMouseDown={(e) => handleCellMouseDown(issue.key, 'status', e)}
                            onMouseEnter={() => handleCellMouseEnter(issue.key, 'status')}
                            onClick={(e) => handleCellClick(issue.key, 'status', e)}
                            className={`px-3 py-2 border-r border-gray-100 whitespace-nowrap cursor-pointer transition-all ${getCellClasses(
                              issue.key,
                              'status'
                            )}`}
                            title={
                              lang === 'es'
                                ? `${issue.jira_status} (Clic o arrastrar para seleccionar, Ctrl+C para copiar)`
                                : `${issue.jira_status} (Click or drag to select, Ctrl+C to copy)`
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
                            {renderCornerHandle(issue.key, 'status')}
                          </td>

                          {/* Priority */}
                          <td
                            onMouseDown={(e) => handleCellMouseDown(issue.key, 'priority', e)}
                            onMouseEnter={() => handleCellMouseEnter(issue.key, 'priority')}
                            onClick={(e) => handleCellClick(issue.key, 'priority', e)}
                            className={`px-3 py-2 border-r border-gray-100 whitespace-nowrap cursor-pointer transition-all ${getCellClasses(
                              issue.key,
                              'priority'
                            )}`}
                            title={
                              lang === 'es'
                                ? `${issue.priority} (Clic o arrastrar para seleccionar, Ctrl+C para copiar)`
                                : `${issue.priority} (Click or drag to select, Ctrl+C to copy)`
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
                            {renderCornerHandle(issue.key, 'priority')}
                          </td>

                          {/* Assignee */}
                          <td
                            onMouseDown={(e) => handleCellMouseDown(issue.key, 'assignee', e)}
                            onMouseEnter={() => handleCellMouseEnter(issue.key, 'assignee')}
                            onClick={(e) => handleCellClick(issue.key, 'assignee', e)}
                            className={`px-3 py-2 border-r border-gray-100 whitespace-nowrap cursor-pointer transition-all ${getCellClasses(
                              issue.key,
                              'assignee'
                            )}`}
                            title={
                              lang === 'es'
                                ? `${issue.assignee_name || t.unassigned} (Clic o arrastrar para seleccionar, Ctrl+C para copiar)`
                                : `${issue.assignee_name || t.unassigned} (Click or drag to select, Ctrl+C to copy)`
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
                            {renderCornerHandle(issue.key, 'assignee')}
                          </td>
                        </>
                      )}

                      {/* Custom Columns Cells */}
                      {visibleCustomColumns.map((col) => {
                        const rawCustomValue = issue.custom_values?.[col.id];
                        const isCurrentlyEditing =
                          editingCell?.issueKey === issue.key && editingCell?.colId === col.id;

                        // 1. Archivy Wiki Link Cell
                        if (col.type === 'archivy_link') {
                          return (
                            <td
                              key={col.id}
                              onMouseDown={(e) => handleCellMouseDown(issue.key, col.id, e)}
                              onMouseEnter={() => handleCellMouseEnter(issue.key, col.id)}
                              onClick={(e) => handleCellClick(issue.key, col.id, e)}
                              className={`px-3 py-1.5 border-r border-gray-100 cursor-pointer transition-all ${getCellClasses(
                                issue.key,
                                col.id
                              )}`}
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
                              {renderCornerHandle(issue.key, col.id)}
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
                              onMouseDown={(e) => handleCellMouseDown(issue.key, col.id, e)}
                              onMouseEnter={() => handleCellMouseEnter(issue.key, col.id)}
                              onClick={(e) => handleCellClick(issue.key, col.id, e)}
                              className={`px-3 py-1.5 border-r border-gray-100 relative group/cell hover:bg-blue-50/40 cursor-pointer transition-all ${getCellClasses(
                                issue.key,
                                col.id
                              )}`}
                              title={
                                lang === 'es'
                                  ? `${currentOpt ? currentOpt.label : 'Sin opción'} (Clic o arrastrar para seleccionar, Ctrl+C copiar, Ctrl+V pegar, doble clic para elegir)`
                                  : `${currentOpt ? currentOpt.label : 'No option'} (Click or drag to select, Ctrl+C to copy, Ctrl+V to paste, double click to choose)`
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
                                      handlePasteToCell(issue.key, col.id);
                                    }}
                                    className="opacity-0 group-hover/cell:opacity-100 p-1 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-100/80 transition-all cursor-pointer"
                                    title={lang === 'es' ? 'Pegar opción (Ctrl+V)' : 'Paste option (Ctrl+V)'}
                                  >
                                    <ClipboardPaste className="w-3 h-3" />
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
                              {renderCornerHandle(issue.key, col.id)}
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
                              onMouseDown={(e) => handleCellMouseDown(issue.key, col.id, e)}
                              onMouseEnter={() => handleCellMouseEnter(issue.key, col.id)}
                              onClick={(e) => handleCellClick(issue.key, col.id, e)}
                              className={`px-3 py-1.5 border-r border-gray-100 max-w-[280px] bg-slate-50/20 text-gray-800 cursor-pointer group/cell transition-all ${getCellClasses(
                                issue.key,
                                col.id
                              )}`}
                              title={`Jira (${fieldKey}) - Clic o arrastrar para seleccionar, Ctrl+C para copiar`}
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
                              {renderCornerHandle(issue.key, col.id)}
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
                              onMouseDown={(e) => handleCellMouseDown(issue.key, col.id, e)}
                              onMouseEnter={() => handleCellMouseEnter(issue.key, col.id)}
                              onClick={(e) => handleCellClick(issue.key, col.id, e)}
                              className={`px-3 py-1.5 border-r border-gray-100 max-w-[220px] bg-slate-50/15 text-gray-800 cursor-pointer hover:bg-indigo-50/40 group/cell transition-all ${getCellClasses(
                                issue.key,
                                col.id
                              )}`}
                              title={
                                col.formula
                                  ? `${col.name} = ${col.formula}\nResultado: ${result ?? '(vacío)'}\n(${
                                      lang === 'es'
                                        ? 'Clic o arrastrar para seleccionar, Ctrl+C para copiar, doble clic para editar fórmula'
                                        : 'Click or drag to select, Ctrl+C to copy, double click to edit formula'
                                    })`
                                  : `${col.name} (${
                                      lang === 'es'
                                        ? 'Clic o arrastrar para seleccionar, Ctrl+C para copiar, doble clic para configurar'
                                        : 'Click or drag to select, Ctrl+C to copy, double click to configure'
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
                              {renderCornerHandle(issue.key, col.id)}
                            </td>
                          );
                        }

                        // 3.6. Linked Records Column (link_row)
                        if (col.type === 'link_row') {
                          const linkedKeys: string[] = Array.isArray(rawCustomValue)
                            ? rawCustomValue
                            : rawCustomValue
                            ? [String(rawCustomValue)]
                            : [];

                          const pool = allIssues && allIssues.length > 0 ? allIssues : issues;

                          return (
                            <td
                              key={col.id}
                              onMouseDown={(e) => handleCellMouseDown(issue.key, col.id, e)}
                              onMouseEnter={() => handleCellMouseEnter(issue.key, col.id)}
                              onClick={(e) => handleCellClick(issue.key, col.id, e)}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleOpenPicker(issue, col);
                              }}
                              className={`px-2.5 py-1.5 border-r border-gray-100 max-w-[280px] cursor-pointer group/cell transition-all ${getCellClasses(
                                issue.key,
                                col.id
                              )}`}
                              title={
                                lang === 'es'
                                  ? 'Doble clic para vincular registros'
                                  : 'Double click to link records'
                              }
                            >
                              <div className="flex items-center justify-between min-h-[24px] gap-1.5">
                                <div className="flex items-center gap-1 flex-wrap overflow-hidden flex-1">
                                  {linkedKeys.length > 0 ? (
                                    linkedKeys.map((key) => {
                                      const matchedIssue = pool.find((i) => i.key === key);
                                      return (
                                        <span
                                          key={key}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs group/pill"
                                          title={matchedIssue ? `${key}: ${matchedIssue.summary}` : key}
                                        >
                                          <Link2 className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                                          <span className="font-mono">{key}</span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const next = linkedKeys.filter((k) => k !== key);
                                              onUpdateCustomValue(issue.key, col.id, next);
                                            }}
                                            className="opacity-0 group-hover/pill:opacity-100 hover:text-rose-600 transition-opacity ml-0.5 cursor-pointer"
                                            title={lang === 'es' ? 'Desvincular' : 'Unlink'}
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </span>
                                      );
                                    })
                                  ) : (
                                    <span className="text-gray-400 italic text-xs">
                                      {lang === 'es' ? 'Sin registros' : 'No records'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenPicker(issue, col);
                                    }}
                                    className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-100/80 transition-all cursor-pointer"
                                    title={lang === 'es' ? 'Vincular registro (+)' : 'Link record (+)'}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyCell(issue.key, col.id);
                                    }}
                                    className="opacity-0 group-hover/cell:opacity-100 p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-100/80 transition-all cursor-pointer"
                                    title={lang === 'es' ? 'Copiar (Ctrl+C)' : 'Copy (Ctrl+C)'}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              {renderCornerHandle(issue.key, col.id)}
                            </td>
                          );
                        }

                        // 3.7. Lookup Column (lookup) (STRICTLY READ-ONLY)
                        if (col.type === 'lookup') {
                          const pool = allIssues && allIssues.length > 0 ? allIssues : issues;
                          const lookupResults = evaluateLookup(issue, col, columns, pool);

                          return (
                            <td
                              key={col.id}
                              onMouseDown={(e) => handleCellMouseDown(issue.key, col.id, e)}
                              onMouseEnter={() => handleCellMouseEnter(issue.key, col.id)}
                              onClick={(e) => handleCellClick(issue.key, col.id, e)}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (onOpenEditColumn) {
                                  onOpenEditColumn(col);
                                }
                              }}
                              className={`px-2.5 py-1.5 border-r border-gray-100 max-w-[280px] bg-amber-50/15 cursor-pointer group/cell transition-all ${getCellClasses(
                                issue.key,
                                col.id
                              )}`}
                              title={
                                lookupResults.length > 0
                                  ? lookupResults.map((r) => `${r.issueKey}: ${r.label}`).join('\n')
                                  : lang === 'es'
                                  ? 'Lookup sin valores'
                                  : 'Lookup empty'
                              }
                            >
                              <div className="flex items-center justify-between min-h-[24px] gap-1.5">
                                <div className="flex items-center gap-1 flex-wrap overflow-hidden flex-1">
                                  {lookupResults.length > 0 ? (
                                    lookupResults.map((r, i) => (
                                      <span
                                        key={i}
                                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs truncate"
                                        title={`${r.issueKey}: ${r.label}`}
                                      >
                                        {r.label}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-gray-400 italic text-xs">-</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyCell(issue.key, col.id);
                                    }}
                                    className="opacity-0 group-hover/cell:opacity-100 p-1 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-100/80 transition-all cursor-pointer"
                                    title={lang === 'es' ? 'Copiar (Ctrl+C)' : 'Copy (Ctrl+C)'}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              {renderCornerHandle(issue.key, col.id)}
                            </td>
                          );
                        }

                        // 4. Standard Custom Columns (Text, Long Text, Number, Date)
                        const displayVal =
                          rawCustomValue !== null && rawCustomValue !== undefined ? String(rawCustomValue) : '';

                        return (
                          <td
                            key={col.id}
                            onMouseDown={(e) => handleCellMouseDown(issue.key, col.id, e)}
                            onMouseEnter={() => handleCellMouseEnter(issue.key, col.id)}
                            onClick={(e) => handleCellClick(issue.key, col.id, e)}
                            className={`px-3 py-1.5 border-r border-gray-100 relative group/cell hover:bg-blue-50/40 cursor-pointer transition-all ${getCellClasses(
                              issue.key,
                              col.id
                            )}`}
                            title={
                              lang === 'es'
                                ? 'Clic o arrastrar para seleccionar (Ctrl+C copiar, Ctrl+V pegar), doble clic o lápiz para editar'
                                : 'Click or drag to select (Ctrl+C to copy, Ctrl+V to paste), double click or pencil to edit'
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
                                      handlePasteToCell(issue.key, col.id);
                                    }}
                                    className="opacity-0 group-hover/cell:opacity-100 p-1 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-100/80 transition-all cursor-pointer"
                                    title={lang === 'es' ? 'Pegar texto (Ctrl+V)' : 'Paste text (Ctrl+V)'}
                                  >
                                    <ClipboardPaste className="w-3 h-3" />
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
                            {renderCornerHandle(issue.key, col.id)}
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

          {issues.length === 0 && (
            <tr>
              <td
                colSpan={(isLocalTable ? 2 : 6) + visibleCustomColumns.length + 1}
                className="py-16 text-center text-gray-500"
              >
                <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">
                    {isLocalTable
                      ? (lang === 'es' ? 'No hay registros en esta tabla local' : 'No records in this local table')
                      : (lang === 'es' ? 'No se encontraron tickets con los filtros actuales' : 'No tickets matching current filters')}
                  </p>
                  <p className="text-xs text-gray-400">
                    {isLocalTable
                      ? (lang === 'es' ? 'Haz clic en "Nueva Fila" en la barra superior para agregar un registro.' : 'Click "New Row" in the top bar to add a record.')
                      : (lang === 'es' ? 'Prueba cambiando o limpiando tus condiciones de filtro.' : 'Try changing or clearing your filter conditions.')}
                  </p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Spreadsheet-style Floating Selection Action Bar */}
      {rangeStats && rangeStats.hasRange && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 bg-gray-900/95 text-white text-xs font-medium rounded-xl shadow-2xl border border-gray-700/80 backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-150 select-none">
          <div className="flex items-center gap-2 pr-3 border-r border-gray-700/80">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="font-semibold text-white">
              {rangeStats.totalCells} {lang === 'es' ? 'celdas' : 'cells'}
            </span>
            <span className="text-[11px] text-gray-400">
              ({rangeStats.rowCount} {lang === 'es' ? 'filas' : 'rows'} × {rangeStats.colCount} {lang === 'es' ? 'col' : 'col'})
            </span>
          </div>

          {rangeStats.numericCount > 0 && (
            <div className="hidden sm:flex items-center gap-3 pr-3 border-r border-gray-700/80 text-[11px] text-gray-300">
              <span>
                <strong className="text-gray-400">{lang === 'es' ? 'Suma:' : 'Sum:'}</strong>{' '}
                <span className="text-white font-mono font-medium">
                  {rangeStats.numericSum % 1 === 0 ? rangeStats.numericSum : rangeStats.numericSum.toFixed(2)}
                </span>
              </span>
              {rangeStats.numericAvg !== null && (
                <span>
                  <strong className="text-gray-400">{lang === 'es' ? 'Prom:' : 'Avg:'}</strong>{' '}
                  <span className="text-white font-mono font-medium">
                    {rangeStats.numericAvg.toFixed(1)}
                  </span>
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleCopyCell()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors cursor-pointer shadow-xs active:scale-95"
              title={lang === 'es' ? 'Copiar selección (Ctrl+C)' : 'Copy selection (Ctrl+C)'}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{lang === 'es' ? 'Copiar' : 'Copy'}</span>
              <span className="text-[10px] text-blue-200 font-mono ml-0.5">Ctrl+C</span>
            </button>

            <button
              type="button"
              onClick={() => handleClearSelectedCells()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors cursor-pointer shadow-xs active:scale-95"
              title={lang === 'es' ? 'Borrar contenido de celdas (Del)' : 'Clear cell contents (Del)'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{lang === 'es' ? 'Limpiar' : 'Clear'}</span>
              <span className="text-[10px] text-gray-400 font-mono ml-0.5">Del</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedCell(null);
                setSelectionEndCell(null);
              }}
              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer ml-1"
              title={lang === 'es' ? 'Deseleccionar (Esc)' : 'Deselect (Esc)'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Copy Toast */}
      {copyToast && (
        <div
          className={`fixed ${
            rangeStats?.hasRange ? 'bottom-20' : 'bottom-6'
          } left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-gray-900/95 text-white text-xs font-medium rounded-full shadow-2xl border border-gray-700 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-none`}
        >
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{lang === 'es' ? 'Copiado al portapapeles:' : 'Copied to clipboard:'}</span>
          <span className="font-semibold text-emerald-300 max-w-[200px] truncate">
            {copyToast.text ? `"${copyToast.text}"` : lang === 'es' ? '(vacío)' : '(empty)'}
          </span>
          <span className="text-[10px] text-gray-400 border-l border-gray-700 pl-2">Ctrl+C</span>
        </div>
      )}

      {/* Floating Paste Toast */}
      {pasteToast && (
        <div
          className={`fixed ${
            rangeStats?.hasRange ? 'bottom-20' : 'bottom-6'
          } left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2 text-xs font-medium rounded-full shadow-2xl border backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-none ${
            pasteToast.isError
              ? 'bg-rose-950/95 text-rose-100 border-rose-800'
              : 'bg-gray-900/95 text-white border-gray-700'
          }`}
        >
          {pasteToast.isError ? (
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          ) : (
            <ClipboardPaste className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          )}
          <div className="flex flex-col">
            <span className="font-semibold text-white">{pasteToast.message}</span>
            {pasteToast.subtext && (
              <span className="text-[10px] text-gray-300">{pasteToast.subtext}</span>
            )}
          </div>
          <span className="text-[10px] text-gray-400 border-l border-gray-700 pl-2 font-mono">
            Ctrl+V
          </span>
        </div>
      )}

      {/* Record Picker Modal for Linked Records */}
      {activePicker && (
        <RecordPickerModal
          isOpen={true}
          onClose={() => setActivePicker(null)}
          onSave={(selectedKeys) => {
            onUpdateCustomValue(activePicker.issueKey, activePicker.column.id, selectedKeys);
            setActivePicker(null);
          }}
          targetTableName={activePicker.targetTableName}
          availableIssues={activePicker.targetIssues}
          selectedKeys={activePicker.selectedKeys}
          allowMultiple={activePicker.column.link_row?.allow_multiple ?? true}
          lang={lang}
        />
      )}
    </div>
  );
};
