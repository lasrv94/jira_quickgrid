import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Table, Globe } from 'lucide-react';
import { AddColumnModal } from './components/AddColumnModal';
import { ArchivyDrawer } from './components/ArchivyDrawer';
import { CreateViewModal } from './components/CreateViewModal';
import { DataGrid } from './components/DataGrid';
import { SettingsModal } from './components/SettingsModal';
import { Toolbar } from './components/Toolbar';
import { ViewTabs } from './components/ViewTabs';
import {
  createColumn,
  createView,
  deleteColumn,
  deleteView,
  fetchColumns,
  fetchConfig,
  fetchFilters,
  fetchIssues,
  fetchViews,
  setCustomValue,
  syncIssues,
  updateColumn,
} from './services/api';
import type { AppConfig, CustomColumn, JiraFilter, JiraIssue, SavedView } from './types';
import type { Language } from './utils/i18n';
import { getTranslation } from './utils/i18n';

export function App() {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('jira_grid_lang') as Language) || 'es';
  });
  const t = getTranslation(lang);

  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [columns, setColumns] = useState<CustomColumn[]>([]);
  const [filters, setFilters] = useState<JiraFilter[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [selectedFilterId, setSelectedFilterId] = useState<string>('fav-1');
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Views state
  const [views, setViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string>('view-all');
  const [isCreateViewOpen, setIsCreateViewOpen] = useState(false);

  // Active view layout configuration
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modals & Drawers
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeArchivyIssue, setActiveArchivyIssue] = useState<JiraIssue | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const toggleLanguage = () => {
    const next: Language = lang === 'es' ? 'en' : 'es';
    setLang(next);
    localStorage.setItem('jira_grid_lang', next);
  };

  // Initial Data Load & OAuth Callback handling
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthCode = urlParams.get('code');
    if (oauthCode) {
      window.history.replaceState({}, document.title, window.location.pathname);
      fetch('/api/auth/jira/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: oauthCode, redirect_uri: window.location.origin + '/auth/callback' }),
      })
        .then((res) => res.json())
        .then(() => {
          setBannerMessage(lang === 'es' ? 'Conexión Atlassian OAuth establecida.' : 'Atlassian OAuth connected.');
          setTimeout(() => setBannerMessage(null), 4000);
          loadAllData();
        })
        .catch((err) => alert(`OAuth error: ${err.message}`));
    } else {
      loadAllData();
    }
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [fetchedConfig, fetchedFilters, fetchedColumns, fetchedIssues, fetchedViews] = await Promise.all([
        fetchConfig(),
        fetchFilters(),
        fetchColumns(),
        fetchIssues(),
        fetchViews().catch(() => []),
      ]);
      setConfig(fetchedConfig);
      setFilters(fetchedFilters);
      setColumns(fetchedColumns);
      setIssues(fetchedIssues);
      if (fetchedViews && fetchedViews.length > 0) {
        setViews(fetchedViews);
      }
      if (fetchedConfig.selected_filter_id) {
        setSelectedFilterId(fetchedConfig.selected_filter_id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncIssues(selectedFilterId);
      const updatedIssues = await fetchIssues();
      const updatedConfig = await fetchConfig();
      setIssues(updatedIssues);
      setConfig(updatedConfig);
      setBannerMessage(result.message);
      setTimeout(() => setBannerMessage(null), 4000);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectFilter = async (filterId: string) => {
    setSelectedFilterId(filterId);
    setSyncing(true);
    try {
      await syncIssues(filterId);
      const updatedIssues = await fetchIssues();
      const updatedConfig = await fetchConfig();
      setIssues(updatedIssues);
      setConfig(updatedConfig);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateCustomValue = async (issueKey: string, columnId: string, value: any) => {
    setIssues((prev) =>
      prev.map((item) => {
        if (item.key === issueKey) {
          return {
            ...item,
            custom_values: {
              ...item.custom_values,
              [columnId]: value,
            },
          };
        }
        return item;
      })
    );
    try {
      await setCustomValue(issueKey, columnId, value);
    } catch (err) {
      console.error(err);
      loadAllData();
    }
  };

  const handleAddColumn = async (columnData: Partial<CustomColumn>) => {
    try {
      const newCol = await createColumn(columnData);
      setColumns((prev) => [...prev, newCol]);
    } catch (err: any) {
      alert(`Error al crear columna: ${err.message}`);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    const colToDelete = columns.find((c) => c.id === columnId);
    const colName = colToDelete ? colToDelete.name : columnId;
    if (!window.confirm(`¿Eliminar la columna "${colName}"? Los datos locales asociados se conservarán en base de datos.`)) {
      return;
    }
    try {
      await deleteColumn(columnId);
      setColumns((prev) => prev.filter((c) => c.id !== columnId));
    } catch (err: any) {
      alert(`Error al eliminar columna: ${err.message}`);
    }
  };

  const handleToggleColumnVisibility = async (columnId: string) => {
    const col = columns.find((c) => c.id === columnId);
    if (!col) return;
    const newVisibility = !col.is_visible;
    setColumns((prev) =>
      prev.map((c) => (c.id === columnId ? { ...c, is_visible: newVisibility } : c))
    );
    try {
      await updateColumn(columnId, { is_visible: newVisibility });
    } catch (err) {
      console.error(err);
    }
  };

  // Views handling
  const handleSelectView = (view: SavedView) => {
    setActiveViewId(view.id);
    setGroupBy(view.group_by || null);
    setSortField(view.sort_field || null);
    setSortDirection(view.sort_direction || 'asc');
    setSearchQuery(view.search_query || '');
    if (view.filter_id) {
      handleSelectFilter(view.filter_id);
    }
    if (Array.isArray(view.visible_columns) && view.visible_columns.length > 0) {
      const visibleSet = new Set(view.visible_columns);
      setColumns((prev) =>
        prev.map((c) => ({
          ...c,
          is_visible: visibleSet.has(c.id),
        }))
      );
    }
  };

  const handleCreateView = async (name: string) => {
    const visibleColIds = columns.filter((c) => c.is_visible).map((c) => c.id);
    const newView = await createView({
      name,
      group_by: groupBy,
      sort_field: sortField,
      sort_direction: sortDirection,
      search_query: searchQuery,
      filter_id: selectedFilterId,
      visible_columns: visibleColIds,
    });
    setViews((prev) => [...prev, newView]);
    setActiveViewId(newView.id);
  };

  const handleDeleteView = async (viewId: string) => {
    try {
      await deleteView(viewId);
      const remaining = views.filter((v) => v.id !== viewId);
      setViews(remaining);
      if (activeViewId === viewId) {
        const fallback = remaining[0];
        if (fallback) handleSelectView(fallback);
      }
    } catch (err: any) {
      alert(`Error al eliminar vista: ${err.message}`);
    }
  };

  // Filtered and Sorted Issues
  const filteredAndSortedIssues = useMemo(() => {
    let result = [...issues];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (issue) =>
          issue.key.toLowerCase().includes(q) ||
          issue.summary.toLowerCase().includes(q) ||
          (issue.assignee_name && issue.assignee_name.toLowerCase().includes(q)) ||
          issue.jira_status.toLowerCase().includes(q)
      );
    }

    if (sortField) {
      result.sort((a, b) => {
        let valA: any = (a as any)[sortField] ?? '';
        let valB: any = (b as any)[sortField] ?? '';

        if (sortField === 'priority') {
          const weights: Record<string, number> = { highest: 4, high: 3, medium: 2, low: 1, lowest: 0 };
          valA = weights[String(valA).toLowerCase()] ?? 0;
          valB = weights[String(valB).toLowerCase()] ?? 0;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [issues, searchQuery, sortField, sortDirection]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#f4f5f7] overflow-hidden text-gray-900">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 px-5 py-2.5 flex items-center justify-between shadow-2xs z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold shadow-xs">
            <Table className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-gray-900 tracking-tight">{t.app_title}</h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                {t.persistent_badge}
              </span>
            </div>
            <p className="text-[11px] text-gray-500">{t.app_subtitle}</p>
          </div>
        </div>

        {/* Right Header Status Badges & Language Switcher */}
        <div className="flex items-center gap-2.5">
          {/* Turn to English / Cambiar a Español */}
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 transition-colors shadow-2xs cursor-pointer"
            title="Switch language / Cambiar idioma"
          >
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span>{t.toggle_lang}</span>
          </button>

          <div className="hidden md:flex items-center gap-2 text-xs bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
            <span className="text-gray-500">{t.connection_mode}:</span>
            <span className="font-semibold text-gray-800 uppercase text-[10px]">
              {config?.jira_auth_type === 'oauth'
                ? t.oauth_mode
                : config?.jira_auth_type === 'pat'
                ? t.pat_mode
                : t.mock_mode}
            </span>
          </div>

          <div className="text-xs bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 font-medium">
            <strong>{issues.length}</strong> {t.tickets_loaded}
          </div>
        </div>
      </header>

      {/* Dynamic Sync Banner */}
      {bannerMessage && (
        <div className="bg-blue-600 text-white text-xs px-5 py-2 flex items-center justify-between shadow-sm animate-in slide-in-from-top duration-150 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>{bannerMessage}</span>
          </div>
          <span className="text-[11px] opacity-80">{t.fields_safe_note}</span>
        </div>
      )}

      {/* Airtable Views Bar */}
      <ViewTabs
        views={views}
        activeViewId={activeViewId}
        onSelectView={handleSelectView}
        onOpenCreateView={() => setIsCreateViewOpen(true)}
        onDeleteView={handleDeleteView}
        lang={lang}
      />

      {/* Airtable Toolbar */}
      <Toolbar
        filters={filters}
        selectedFilterId={selectedFilterId}
        onSelectFilter={handleSelectFilter}
        onSync={handleSync}
        syncing={syncing}
        lastSync={config?.last_sync}
        columns={columns}
        onToggleColumnVisibility={handleToggleColumnVisibility}
        onOpenAddColumn={() => setIsAddColumnOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={(field, dir) => {
          setSortField(field);
          setSortDirection(dir);
        }}
        lang={lang}
      />

      {/* Main Data Table Area */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white text-gray-400 gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium">Cargando base de datos y tickets de Jira...</p>
        </div>
      ) : (
        <DataGrid
          issues={filteredAndSortedIssues}
          columns={columns}
          onUpdateCustomValue={handleUpdateCustomValue}
          onOpenArchivyDrawer={(issue) => setActiveArchivyIssue(issue)}
          onOpenAddColumn={() => setIsAddColumnOpen(true)}
          onDeleteColumn={handleDeleteColumn}
          groupBy={groupBy}
          lang={lang}
        />
      )}

      {/* Side Drawer for Archivy Notes */}
      <ArchivyDrawer
        issue={activeArchivyIssue}
        onClose={() => setActiveArchivyIssue(null)}
      />

      {/* Add Column Modal */}
      <AddColumnModal
        isOpen={isAddColumnOpen}
        onClose={() => setIsAddColumnOpen(false)}
        onAddColumn={handleAddColumn}
      />

      {/* Jira Connection Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onRefreshConfig={loadAllData}
        existingColumns={columns}
        lang={lang}
      />

      {/* Create View Modal */}
      <CreateViewModal
        isOpen={isCreateViewOpen}
        onClose={() => setIsCreateViewOpen(false)}
        onSaveView={handleCreateView}
        currentState={{
          groupBy,
          sortField,
          sortDirection,
          searchQuery,
          filterId: selectedFilterId,
          visibleColumnsCount: columns.filter((c) => c.is_visible).length,
        }}
        lang={lang}
      />
    </div>
  );
}

export default App;
