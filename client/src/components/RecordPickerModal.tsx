import React, { useState, useMemo } from 'react';
import { Check, Link, Search, X } from 'lucide-react';
import type { JiraIssue } from '../types';
import type { Language } from '../utils/i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetTableName: string;
  availableIssues: JiraIssue[];
  selectedKeys: string[];
  allowMultiple?: boolean;
  onSave: (keys: string[]) => void;
  lang: Language;
}

export const RecordPickerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  targetTableName,
  availableIssues,
  selectedKeys,
  allowMultiple = true,
  onSave,
  lang,
}) => {
  const [search, setSearch] = useState('');
  const [currentSelected, setCurrentSelected] = useState<string[]>(selectedKeys);

  // Sync state when opened
  React.useEffect(() => {
    if (isOpen) {
      setCurrentSelected(selectedKeys);
      setSearch('');
    }
  }, [isOpen, selectedKeys]);

  const filteredIssues = useMemo(() => {
    if (!search.trim()) return availableIssues;
    const q = search.toLowerCase();
    return availableIssues.filter(
      (issue) =>
        issue.key.toLowerCase().includes(q) ||
        issue.summary.toLowerCase().includes(q) ||
        issue.jira_status.toLowerCase().includes(q) ||
        (issue.assignee_name && issue.assignee_name.toLowerCase().includes(q))
    );
  }, [availableIssues, search]);

  if (!isOpen) return null;

  const handleToggle = (key: string) => {
    if (!allowMultiple) {
      setCurrentSelected(currentSelected.includes(key) ? [] : [key]);
      return;
    }
    if (currentSelected.includes(key)) {
      setCurrentSelected(currentSelected.filter((k) => k !== key));
    } else {
      setCurrentSelected([...currentSelected, key]);
    }
  };

  const handleConfirm = () => {
    onSave(currentSelected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <Link className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                {lang === 'es' ? 'Vincular registros' : 'Link records'}
              </h3>
              <p className="text-[11px] text-gray-500">
                {lang === 'es' ? `Tabla destino: ${targetTableName}` : `Target table: ${targetTableName}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={lang === 'es' ? 'Buscar registro por clave o resumen...' : 'Search record by key or summary...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Records list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-gray-50">
          {filteredIssues.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">
              {lang === 'es' ? 'No se encontraron registros' : 'No records found'}
            </div>
          ) : (
            filteredIssues.map((issue) => {
              const isSelected = currentSelected.includes(issue.key);
              return (
                <div
                  key={issue.key}
                  onClick={() => handleToggle(issue.key)}
                  className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50/80 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>

                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100/60 px-1.5 py-0.5 rounded shrink-0">
                      {issue.key}
                    </span>

                    <span className="text-xs text-gray-800 truncate">{issue.summary}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700">
                      {issue.jira_status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {currentSelected.length} {lang === 'es' ? 'seleccionado(s)' : 'selected'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {lang === 'es' ? 'Cancelar' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
            >
              {lang === 'es' ? 'Guardar vínculos' : 'Save links'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
