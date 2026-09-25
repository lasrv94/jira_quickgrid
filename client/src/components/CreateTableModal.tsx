import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Filter,
  X,
  Sparkles,
  CheckCircle2,
  Search,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { fetchAvailableJiraFilters } from '../services/api';
import type { JiraFilter } from '../types';
import type { Language } from '../utils/i18n';
import { getTranslation } from '../utils/i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreateLocalTable: (name: string) => Promise<void>;
  onCreateJiraFilterTable: (data: { id?: string; name: string; jql?: string }) => Promise<void>;
  lang: Language;
}

export const CreateTableModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onCreateLocalTable,
  onCreateJiraFilterTable,
  lang,
}) => {
  const t = getTranslation(lang);
  const [tableType, setTableType] = useState<'local' | 'jira'>('local');

  // Local table form state
  const [localName, setLocalName] = useState('');
  const localInputRef = useRef<HTMLInputElement>(null);

  // Jira filter form state
  const [jiraMode, setJiraMode] = useState<'saved' | 'custom'>('saved');
  const [jiraName, setJiraName] = useState('');
  const [jiraJql, setJiraJql] = useState('');
  const [jiraFilterId, setJiraFilterId] = useState('');
  const [availableFilters, setAvailableFilters] = useState<JiraFilter[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [selectedFilterObj, setSelectedFilterObj] = useState<JiraFilter | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Suggestions for fast local table creation
  const localSuggestions = lang === 'es'
    ? ['Sprint Backlog', 'Entregables', 'Clientes', 'Riesgos', 'Inventario']
    : ['Sprint Backlog', 'Deliverables', 'Clients', 'Risks', 'Inventory'];

  // Load available Jira filters when modal opens or Jira tab selected
  useEffect(() => {
    if (!isOpen) {
      setLocalName('');
      setJiraName('');
      setJiraJql('');
      setJiraFilterId('');
      setSelectedFilterObj(null);
      setErrorMsg(null);
      setSubmitting(false);
      return;
    }

    if (tableType === 'local') {
      setTimeout(() => localInputRef.current?.focus(), 80);
    } else if (tableType === 'jira' && availableFilters.length === 0) {
      setLoadingFilters(true);
      fetchAvailableJiraFilters()
        .then((filters) => {
          setAvailableFilters(filters || []);
        })
        .catch(() => {
          // If fail, user can still enter custom JQL
          setJiraMode('custom');
        })
        .finally(() => {
          setLoadingFilters(false);
        });
    }
  }, [isOpen, tableType, availableFilters.length]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectLocalSuggestion = (chip: string) => {
    setLocalName(chip);
    localInputRef.current?.focus();
  };

  const handleSelectAvailableFilter = (f: JiraFilter) => {
    setSelectedFilterObj(f);
    setJiraFilterId(f.id);
    setJiraName(f.name);
    setJiraJql(f.jql || '');
    setErrorMsg(null);
  };

  const handleSubmitLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = localName.trim();
    if (!name) {
      setErrorMsg(t.create_table_error_empty);
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onCreateLocalTable(name);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear tabla local');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitJira = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = jiraName.trim() || selectedFilterObj?.name || 'Filtro Jira';
    if (!name && !jiraFilterId && !jiraJql) {
      setErrorMsg(t.create_table_error_empty);
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onCreateJiraFilterTable({
        id: jiraFilterId.trim() || undefined,
        name,
        jql: jiraJql.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al vincular filtro de Jira');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredJiraFilters = availableFilters.filter((f) =>
    f.name.toLowerCase().includes(filterSearch.toLowerCase()) ||
    f.id.toLowerCase().includes(filterSearch.toLowerCase())
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-table-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-md transition-all duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200/90 overflow-hidden animate-enter-modal flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 id="create-table-modal-title" className="text-base font-bold text-gray-900 leading-tight">
                {t.create_table_title}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {t.create_table_subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.create_table_cancel}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Visual Option Cards Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Option 1: Local Table */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setTableType('local');
                setErrorMsg(null);
                setTimeout(() => localInputRef.current?.focus(), 50);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setTableType('local');
                  setErrorMsg(null);
                }
              }}
              className={`relative text-left p-4 rounded-xl border-2 transition-all cursor-pointer select-none flex flex-col justify-between ${
                tableType === 'local'
                  ? 'border-indigo-600 bg-indigo-50/30 ring-4 ring-indigo-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md">
                    <Database className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 rounded-full border border-indigo-200/60">
                      {t.create_table_tab_local_badge}
                    </span>
                    {tableType === 'local' && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{lang === 'es' ? 'Seleccionado' : 'Selected'}</span>
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  {t.create_table_tab_local}
                  <span className="text-[11px] font-normal text-gray-500">
                    ({t.create_table_tab_local_sub})
                  </span>
                </h3>

                <p className="text-xs text-gray-600 leading-relaxed">
                  {t.create_table_tab_local_desc}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-indigo-100/60 flex items-center justify-between text-[11px] text-indigo-700 font-medium">
                <span>{t.create_table_tab_local_rec}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Option 2: Jira Filter */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setTableType('jira');
                setErrorMsg(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setTableType('jira');
                  setErrorMsg(null);
                }
              }}
              className={`relative text-left p-4 rounded-xl border-2 transition-all cursor-pointer select-none flex flex-col justify-between ${
                tableType === 'jira'
                  ? 'border-blue-600 bg-blue-50/30 ring-4 ring-blue-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-sky-600 text-white flex items-center justify-center shadow-md">
                    <Filter className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 rounded-full border border-blue-200/60">
                      {t.create_table_tab_jira_badge}
                    </span>
                    {tableType === 'jira' && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{lang === 'es' ? 'Seleccionado' : 'Selected'}</span>
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                  {t.create_table_tab_jira}
                  <span className="text-[11px] font-normal text-gray-500">
                    ({t.create_table_tab_jira_sub})
                  </span>
                </h3>

                <p className="text-xs text-gray-600 leading-relaxed">
                  {t.create_table_tab_jira_desc}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-blue-100/60 flex items-center justify-between text-[11px] text-blue-700 font-medium">
                <span>{lang === 'es' ? 'Filtro JQL o ID guardado' : 'JQL query or saved ID'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Error Message Display */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form Area Based on Selected Table Type */}
          {tableType === 'local' ? (
            <form onSubmit={handleSubmitLocal} className="space-y-4 pt-1 animate-fade-spring">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  {t.create_table_local_name_label}
                </label>
                <input
                  ref={localInputRef}
                  type="text"
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  placeholder={t.create_table_local_name_placeholder}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 font-medium shadow-2xs"
                />
              </div>

              {/* Suggestions chips */}
              <div>
                <div className="text-[11px] font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t.create_table_suggestions}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {localSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleSelectLocalSuggestion(suggestion)}
                      className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 bg-gray-50/70 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-gray-700 transition-colors btn-tactile font-medium"
                    >
                      + {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors btn-tactile cursor-pointer"
                >
                  {t.create_table_cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !localName.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 rounded-xl transition-all shadow-sm btn-tactile cursor-pointer flex items-center gap-1.5"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>{submitting ? '...' : t.create_table_local_submit}</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmitJira} className="space-y-4 pt-1 animate-fade-spring">
              {/* Jira Mode Switch (Saved vs Custom JQL) */}
              <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setJiraMode('saved')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    jiraMode === 'saved'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {t.create_table_jira_mode_saved}
                </button>
                <button
                  type="button"
                  onClick={() => setJiraMode('custom')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    jiraMode === 'custom'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {t.create_table_jira_mode_custom}
                </button>
              </div>

              {jiraMode === 'saved' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700">
                      {t.create_table_jira_select_filter}
                    </label>
                    <span className="text-[11px] text-gray-400">
                      {availableFilters.length} {lang === 'es' ? 'filtros encontrados' : 'filters found'}
                    </span>
                  </div>

                  {/* Filter Search Input */}
                  {availableFilters.length > 3 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder={lang === 'es' ? 'Buscar filtro de Jira...' : 'Search Jira filter...'}
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {/* Available Filters Box */}
                  <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-gray-50/40 p-1">
                    {loadingFilters ? (
                      <div className="p-4 text-center text-xs text-gray-500">
                        {t.create_table_jira_loading_filters}
                      </div>
                    ) : filteredJiraFilters.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400">
                        {t.create_table_jira_no_filters}
                      </div>
                    ) : (
                      filteredJiraFilters.map((f) => {
                        const isSelected = selectedFilterObj?.id === f.id;
                        return (
                          <div
                            key={f.id}
                            onClick={() => handleSelectAvailableFilter(f)}
                            className={`p-2.5 rounded-lg text-xs cursor-pointer transition-colors flex items-center justify-between ${
                              isSelected
                                ? 'bg-blue-100/70 text-blue-900 font-semibold'
                                : 'hover:bg-white text-gray-700'
                            }`}
                          >
                            <div className="truncate mr-2">
                              <div className="font-semibold text-gray-900">{f.name}</div>
                              {f.jql && (
                                <div className="text-[10px] text-gray-400 truncate font-mono">
                                  {f.jql}
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200 shrink-0">
                              #{f.id}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {selectedFilterObj && (
                    <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center justify-between">
                      <div className="truncate">
                        <strong>{selectedFilterObj.name}</strong> (#{selectedFilterObj.id})
                      </div>
                      <span className="text-[10px] bg-blue-200/80 text-blue-900 px-1.5 py-0.5 rounded font-bold">
                        Listo
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      {t.create_table_jira_name_label}
                    </label>
                    <input
                      type="text"
                      value={jiraName}
                      onChange={(e) => setJiraName(e.target.value)}
                      placeholder={t.create_table_jira_name_placeholder}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      {t.create_table_jira_jql_label}
                    </label>
                    <textarea
                      rows={2}
                      value={jiraJql}
                      onChange={(e) => setJiraJql(e.target.value)}
                      placeholder="project = 'PROJ' AND status != 'Done' ORDER BY created DESC"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {t.create_table_jira_filter_id_label}
                    </label>
                    <input
                      type="text"
                      value={jiraFilterId}
                      onChange={(e) => setJiraFilterId(e.target.value)}
                      placeholder="Ej. 10001"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors btn-tactile cursor-pointer"
                >
                  {t.create_table_cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting || (jiraMode === 'saved' && !selectedFilterObj && !jiraName.trim()) || (jiraMode === 'custom' && !jiraName.trim() && !jiraJql.trim())}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-xl transition-all shadow-sm btn-tactile cursor-pointer flex items-center gap-1.5"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{submitting ? '...' : t.create_table_jira_submit}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
