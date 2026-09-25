import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Edit2,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import type { CustomColumn } from '../types';
import type { Language } from '../utils/i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  columns: CustomColumn[];
  onToggleVisibility: (colId: string) => void;
  onShowAll?: () => void;
  onHideAll?: () => void;
  onReorderColumns: (reorderedCols: CustomColumn[]) => Promise<void>;
  onUpdateColumn: (colId: string, data: Partial<CustomColumn>) => Promise<void>;
  onDeleteColumn: (colId: string) => Promise<void>;
  onOpenAddColumn: () => void;
  onOpenEditColumn: (col: CustomColumn) => void;
  lang?: Language;
}

export const ManageFieldsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  columns,
  onToggleVisibility,
  onShowAll,
  onHideAll,
  onReorderColumns,
  onUpdateColumn: _onUpdateColumn,
  onDeleteColumn,
  onOpenAddColumn,
  onOpenEditColumn,
  lang = 'es',
}) => {
  const isEs = lang === 'es';

  const [search, setSearch] = useState('');
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter columns by search query
  const filteredColumns = columns.filter((col) =>
    col.name.toLowerCase().includes(search.toLowerCase())
  );

  const visibleCount = columns.filter((c) => c.is_visible).length;

  const handleShowAll = async () => {
    if (onShowAll) {
      onShowAll();
      return;
    }
    for (const col of columns) {
      if (!col.is_visible) {
        onToggleVisibility(col.id);
      }
    }
  };

  const handleHideAll = async () => {
    if (onHideAll) {
      onHideAll();
      return;
    }
    for (const col of columns) {
      if (col.is_visible) {
        onToggleVisibility(col.id);
      }
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= columns.length) return;

    const updated = [...columns];
    const temp = updated[index];
    updated[index] = updated[newIdx];
    updated[newIdx] = temp;

    // Update positions
    const reordered = updated.map((c, i) => ({ ...c, position: i }));
    await onReorderColumns(reordered);
  };

  const handleRowDrop = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const updated = [...columns];
    const sourceIdx = updated.findIndex((c) => c.id === sourceId);
    const targetIdx = updated.findIndex((c) => c.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const [removed] = updated.splice(sourceIdx, 1);
    updated.splice(targetIdx, 0, removed);

    const reordered = updated.map((c, i) => ({ ...c, position: i }));
    await onReorderColumns(reordered);
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'single_select':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'jira_field':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'archivy_link':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'number':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'date':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'formula':
        return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getTypeLabel = (col: CustomColumn) => {
    if (col.type === 'jira_field' || col.jira_field_key) return 'Jira Field';
    if (col.type === 'formula') return 'fx ' + (isEs ? 'Fórmula' : 'Formula');
    if (col.type === 'single_select') return isEs ? 'Selección Única' : 'Single Select';
    if (col.type === 'archivy_link') return 'Archivy Wiki';
    if (col.type === 'number') return isEs ? 'Número' : 'Number';
    if (col.type === 'date') return isEs ? 'Fecha' : 'Date';
    if (col.type === 'long_text') return isEs ? 'Texto Largo' : 'Long Text';
    return isEs ? 'Texto' : 'Text';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 transition-all duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200/90 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-enter-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                {isEs ? 'Gestionar y Reacomodar Campos' : 'Manage & Reorder Fields'}
              </h2>
              <p className="text-[11px] text-gray-500">
                {isEs
                  ? `Muestra, oculta, reordena y edita las columnas del grid (${visibleCount} visibles)`
                  : `Show, hide, reorder and edit grid columns (${visibleCount} visible)`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Bulk Action Bar */}
        <div className="p-3 border-b border-gray-100 bg-white flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={isEs ? 'Buscar campos...' : 'Find fields...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleShowAll}
              className="px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />
              <span>{isEs ? 'Mostrar todos' : 'Show all'}</span>
            </button>
            <button
              type="button"
              onClick={handleHideAll}
              className="px-2.5 py-1 text-[11px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-200 transition-colors flex items-center gap-1"
            >
              <EyeOff className="w-3 h-3" />
              <span>{isEs ? 'Ocultar todos' : 'Hide all'}</span>
            </button>
          </div>
        </div>

        {/* Fields List with Reordering & Toggles */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 divide-y divide-gray-50">
          {filteredColumns.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              {isEs ? 'No se encontraron campos' : 'No fields found'}
            </div>
          ) : (
            filteredColumns.map((col, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === filteredColumns.length - 1;

              const isDraggingThis = draggingRowId === col.id;
              const isOverThis = dragOverRowId === col.id;

              return (
                <div
                  key={col.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', col.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggingRowId(col.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverRowId !== col.id) {
                      setDragOverRowId(col.id);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverRowId === col.id) setDragOverRowId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const sourceId = e.dataTransfer.getData('text/plain') || draggingRowId;
                    setDraggingRowId(null);
                    setDragOverRowId(null);
                    if (sourceId && sourceId !== col.id) {
                      handleRowDrop(sourceId, col.id);
                    }
                  }}
                  onDragEnd={() => {
                    setDraggingRowId(null);
                    setDragOverRowId(null);
                  }}
                  className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                    isOverThis ? 'border-t-4 border-t-blue-600 bg-blue-50/80 shadow-md' : ''
                  } ${isDraggingThis ? 'opacity-40' : ''} ${
                    col.is_visible
                      ? 'bg-white border-gray-200 shadow-2xs hover:border-blue-300'
                      : 'bg-gray-50/70 border-gray-100 opacity-60 hover:opacity-100'
                  }`}
                >
                  {/* Left: Drag handle, Reorder arrows, Visibility toggle & Name */}
                  <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                    {/* Drag Grip Handle */}
                    <div
                      className="cursor-grab active:cursor-grabbing p-1 text-gray-300 hover:text-gray-600 rounded shrink-0"
                      title={isEs ? 'Arrastrar para reordenar' : 'Drag to reorder'}
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>

                    {/* Reorder Arrows */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => handleMove(idx, 'up')}
                        title={isEs ? 'Mover arriba (a la izquierda)' : 'Move up (left)'}
                        className="p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => handleMove(idx, 'down')}
                        title={isEs ? 'Mover abajo (a la derecha)' : 'Move down (right)'}
                        className="p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Visibility Switch */}
                    <button
                      type="button"
                      onClick={() => onToggleVisibility(col.id)}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        col.is_visible
                          ? 'bg-blue-50 border-blue-200 text-blue-600'
                          : 'bg-gray-100 border-gray-200 text-gray-400'
                      }`}
                      title={col.is_visible ? (isEs ? 'Ocultar campo' : 'Hide field') : isEs ? 'Mostrar campo' : 'Show field'}
                    >
                      {col.is_visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    {/* Field Name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          onClick={() => onOpenEditColumn(col)}
                          onDoubleClick={() => onOpenEditColumn(col)}
                          title={isEs ? 'Clic o doble clic para editar configuración' : 'Click or double click to edit config'}
                          className="font-semibold text-xs text-gray-800 truncate cursor-pointer hover:text-blue-600"
                        >
                          {col.name}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${getBadgeColor(
                            col.type
                          )}`}
                        >
                          {getTypeLabel(col)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions: Rename & Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenEditColumn(col)}
                      title={isEs ? 'Editar configuración del campo' : 'Edit field configuration'}
                      className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteColumn(col.id)}
                      title={isEs ? 'Eliminar campo' : 'Delete field'}
                      className="p-1 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAddColumn();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isEs ? '+ Añadir Nuevo Campo' : '+ Add New Field'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg shadow-2xs transition-colors"
          >
            {isEs ? 'Listo' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
