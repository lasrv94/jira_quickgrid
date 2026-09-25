import React, { useState } from 'react';
import { Layers, Table, X, ArrowDownUp, Filter, Search } from 'lucide-react';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaveView: (name: string) => Promise<void>;
  currentState: {
    groupBy: string | null;
    sortField: string | null;
    sortDirection: 'asc' | 'desc';
    searchQuery: string;
    filterId: string | null;
    visibleColumnsCount: number;
  };
  lang: Language;
}

export const CreateViewModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSaveView,
  currentState,
  lang,
}) => {
  const [viewName, setViewName] = useState('');
  const [saving, setSaving] = useState(false);
  const t = getTranslation(lang);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewName.trim()) return;
    setSaving(true);
    try {
      await onSaveView(viewName.trim());
      setViewName('');
      onClose();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 transition-all duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200/90 overflow-hidden animate-enter-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Table className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">{t.create_view_title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-gray-500">{t.create_view_desc}</p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              {t.view_name_label}
            </label>
            <input
              type="text"
              autoFocus
              placeholder={t.view_name_placeholder}
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 focus:ring-1 focus:ring-blue-500 text-gray-800"
            />
          </div>

          {/* Current Settings Snapshot Preview */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-[11px] space-y-1.5 text-gray-600">
            <div className="font-semibold text-gray-700 text-xs mb-1">
              Configuración actual que se guardará:
            </div>
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-gray-400" />
              <span>Agrupación:</span>
              <strong className="text-gray-800">{currentState.groupBy || 'Sin agrupación'}</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowDownUp className="w-3.5 h-3.5 text-gray-400" />
              <span>Ordenación:</span>
              <strong className="text-gray-800">
                {currentState.sortField ? `${currentState.sortField} (${currentState.sortDirection})` : 'Por defecto'}
              </strong>
            </div>
            {currentState.searchQuery && (
              <div className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-gray-400" />
                <span>Búsqueda activa:</span>
                <strong className="text-gray-800 truncate max-w-[180px]">"{currentState.searchQuery}"</strong>
              </div>
            )}
            {currentState.filterId && (
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <span>Filtro Jira:</span>
                <strong className="text-gray-800">{currentState.filterId}</strong>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={saving || !viewName.trim()}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {saving ? t.saving : t.create_view_submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
