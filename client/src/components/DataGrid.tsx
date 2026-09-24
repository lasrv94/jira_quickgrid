import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
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

                        // 2. Single Select Cell (Local Custom)
                        if (col.type === 'single_select') {
                          const currentOpt = col.options?.find((o) => o.id === rawCustomValue);
                          const isDropdownOpen =
                            activeDropdown?.issueKey === issue.key && activeDropdown?.colId === col.id;

                          return (
                            <td
                              key={col.id}
                              className="px-3 py-1.5 border-r border-gray-100 relative group/cell hover:bg-blue-50/40"
                              title={
                                lang === 'es'
                                  ? 'Clic o doble clic para seleccionar opción'
                                  : 'Click or double click to select option'
                              }
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdown({ issueKey: issue.key, colId: col.id });
                              }}
                            >
                              <div
                                className="flex items-center justify-between min-h-[22px] gap-1.5 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdown(isDropdownOpen ? null : { issueKey: issue.key, colId: col.id });
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdown({ issueKey: issue.key, colId: col.id });
                                }}
                              >
                                <div className="inline-flex items-center gap-1.5 py-0.5 truncate flex-1">
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
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDropdown({ issueKey: issue.key, colId: col.id });
                                  }}
                                  className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-100/80 transition-colors cursor-pointer shrink-0"
                                  title={lang === 'es' ? 'Seleccionar opción' : 'Select option'}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
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
                              className="px-3 py-1.5 border-r border-gray-100 max-w-[280px] bg-slate-50/20 text-gray-800"
                              title={`Jira (${fieldKey}) - Solo lectura`}
                            >
                              <div className="truncate">
                                {isComponentField
                                  ? renderComponentPills(jiraRawVal)
                                  : renderJiraFieldValue(jiraRawVal, fieldKey)}
                              </div>
                            </td>
                          );
                        }

                        // 3.5. Formula / Computed Field Columns (STRICTLY READ-ONLY)
                        if (col.type === 'formula') {
                          const result = evaluateFormula(col.formula, issue, columns);
                          const isError = result === 'Error: Formula';
                          const isOne = result === 1 || result === '1' || result === true;
                          const isZero = result === 0 || result === '0' || result === false;

                          return (
                            <td
                              key={col.id}
                              className="px-3 py-1.5 border-r border-gray-100 max-w-[220px] bg-slate-50/15 text-gray-800 cursor-pointer hover:bg-indigo-50/40"
                              title={
                                col.formula
                                  ? `${col.name} = ${col.formula}\nResultado: ${result ?? '(vacío)'}\n(${
                                      lang === 'es' ? 'Doble clic para editar fórmula' : 'Double click to edit formula'
                                    })`
                                  : `${col.name} (${
                                      lang === 'es'
                                        ? 'Doble clic para configurar fórmula'
                                        : 'Double click to configure formula'
                                    })`
                              }
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (onOpenEditColumn) {
                                  onOpenEditColumn(col);
                                }
                              }}
                            >
                              <div className="flex items-center min-h-[22px] truncate">
                                {isError ? (
                                  <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-rose-100 text-rose-700 rounded border border-rose-200">
                                    #ERROR!
                                  </span>
                                ) : isOne ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                                    1
                                  </span>
                                ) : isZero ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                    0
                                  </span>
                                ) : result !== null && result !== undefined && String(result) !== '' ? (
                                  <span className="text-xs font-medium text-gray-900 truncate">
                                    {String(result)}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 italic text-xs">-</span>
                                )}
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
                            className="px-3 py-1.5 border-r border-gray-100 relative group/cell hover:bg-blue-50/40 cursor-text"
                            title={
                              lang === 'es'
                                ? 'Doble clic o clic en lápiz para editar'
                                : 'Double click or click pencil to edit'
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
                                <span
                                  className="truncate text-gray-800 cursor-pointer flex-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCell({
                                      issueKey: issue.key,
                                      colId: col.id,
                                      initialVal: displayVal,
                                    });
                                  }}
                                >
                                  {displayVal !== '' ? (
                                    <span>{displayVal}</span>
                                  ) : (
                                    <span className="text-gray-400 italic text-xs hover:text-blue-600">
                                      {t.col_empty}
                                    </span>
                                  )}
                                </span>
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
                                  className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-100/80 transition-colors cursor-pointer shrink-0"
                                  title="Editar campo"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
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
