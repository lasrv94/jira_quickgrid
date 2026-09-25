import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Table, Globe } from 'lucide-react';
import { AddColumnModal } from './components/AddColumnModal';
import { EditColumnModal } from './components/EditColumnModal';
import { ArchivyDrawer } from './components/ArchivyDrawer';
import { CreateViewModal } from './components/CreateViewModal';
import { DataGrid } from './components/DataGrid';
import { ManageFieldsModal } from './components/ManageFieldsModal';
import { SettingsModal } from './components/SettingsModal';
import { TableTabs } from './components/TableTabs';
import { CreateTableModal } from './components/CreateTableModal';
import { Toolbar } from './components/Toolbar';
import { ViewsSidebar } from './components/ViewsSidebar';
import {
  addConfiguredFilter,
  apiFetch,
  bulkSetCustomValues,
  createColumn,
  createIssue,
  createView,
  deleteColumn,
  deleteIssue,
  deleteView,
  fetchColumns,
  fetchConfig,
  fetchFilters,
  fetchIssues,
  fetchViews,
  removeConfiguredFilter,
  reorderColumns,
  setCustomValue,
  syncIssues,
  updateColumn,
  updateLocalIssue,
  updateView,
} from './services/api';
import type { AppConfig, CustomColumn, FilterCondition, FilterConjunction, JiraFilter, JiraIssue, SavedView } from './types';
import type { Language } from './utils/i18n';
import { getTranslation } from './utils/i18n';
import { exportIssuesToPdf } from './utils/pdfExport';
import { filterIssues } from './utils/filterEvaluator';

export function App() {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('jira_grid_lang') as Language) || 'es';
  });
  const t = getTranslation(lang);

  const [allIssues, setAllIssues] = useState<JiraIssue[]>([]);
  const [columns, setColumns] = useState<CustomColumn[]>([]);
  const [filters, setFilters] = useState<JiraFilter[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [selectedFilterId, setSelectedFilterId] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Views & Sidebar state
  const [views, setViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string>('view-all');
  const [isCreateViewOpen, setIsCreateViewOpen] = useState(false);
  const [isViewsSidebarOpen, setIsViewsSidebarOpen] = useState<boolean>(true);

  // Active table metadata & scoped issues
  const activeTable = useMemo(
    () => filters.find((f) => f.id === selectedFilterId),
    [filters, selectedFilterId]
  );
  const isLocalTable = Boolean(activeTable?.type === 'local' || selectedFilterId?.startsWith('tbl-'));

  const tableIssues = useMemo(() => {
    if (!selectedFilterId) return allIssues;
    if (selectedFilterId.startsWith('tbl-') || selectedFilterId.startsWith('local-')) {
      return allIssues.filter((i) => i.table_id === selectedFilterId);
    }
    return allIssues.filter((i) => !i.table_id || i.table_id === selectedFilterId);
  }, [allIssues, selectedFilterId]);

  // Active view layout configuration
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
  const [filterConjunction, setFilterConjunction] = useState<FilterConjunction>('and');

  // Modals & Drawers
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<CustomColumn | null>(null);
  const [editColumnOrigin, setEditColumnOrigin] = useState<'manage_fields' | 'grid' | null>(null);
  const [isManageFieldsOpen, setIsManageFieldsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeArchivyIssue, setActiveArchivyIssue] = useState<JiraIssue | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const toggleLanguage = () => {
    const next: Language = lang === 'es' ? 'en' : 'es';
    setLang(next);
    localStorage.setItem('jira_grid_lang', next);
  };

  const pendingSaveRef = useRef<{ viewId: string; patch: Partial<SavedView> } | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingSave = () => {
    if (pendingSaveRef.current) {
      const { viewId, patch } = pendingSaveRef.current;
      pendingSaveRef.current = null;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      updateView(viewId, patch).catch((err) =>
        console.error('Error flushing view auto-save:', err)
      );
    }
  };

  const autoSaveActiveView = useCallback(
    (patch: Partial<SavedView>, debounceMs: number = 0) => {
      if (!activeViewId) return;
      const targetViewId = activeViewId;

      // 1. Immediately update in-memory views array so switching tabs or UI reflects it instantly
      setViews((prevViews) =>
        prevViews.map((v) => (v.id === targetViewId ? { ...v, ...patch } : v))
      );

      // 2. Persist to backend (with optional debounce)
      if (debounceMs > 0) {
        pendingSaveRef.current = {
          viewId: targetViewId,
          patch: {
            ...(pendingSaveRef.current?.viewId === targetViewId ? pendingSaveRef.current.patch : {}),
            ...patch,
          },
        };
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          if (pendingSaveRef.current && pendingSaveRef.current.viewId === targetViewId) {
            const p = pendingSaveRef.current.patch;
            pendingSaveRef.current = null;
            updateView(targetViewId, p).catch((err) =>
              console.error('Failed to auto-save view to backend:', err)
            );
          }
        }, debounceMs);
      } else {
        let finalPatch = patch;
        if (pendingSaveRef.current && pendingSaveRef.current.viewId === targetViewId) {
          finalPatch = { ...pendingSaveRef.current.patch, ...patch };
          pendingSaveRef.current = null;
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
          }
        }
        updateView(targetViewId, finalPatch).catch((err) =>
          console.error('Failed to auto-save view to backend:', err)
        );
      }
    },
    [activeViewId]
  );

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncIssues(selectedFilterId);
      const updatedIssues = await fetchIssues();
      const updatedConfig = await fetchConfig();
      setAllIssues(updatedIssues);
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
    flushPendingSave();
    setSelectedFilterId(filterId);
    try {
      // 1. Fetch views scoped to this project / filter
      const projectViews = await fetchViews(filterId).catch(() => []);
      if (projectViews && projectViews.length > 0) {
        setViews(projectViews);
        const initialView = projectViews.find((v) => v.is_default) || projectViews[0];
        if (initialView) {
          applyView(initialView);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const applyView = (view: SavedView, availableCols: CustomColumn[] = columns) => {
    setActiveViewId(view.id);
    setGroupBy(view.group_by || null);
    setSortField(view.sort_field || null);
    setSortDirection(view.sort_direction || 'asc');
    setSearchQuery(view.search_query || '');

    if (view.filter_rules?.conditions) {
      setFilterConditions(view.filter_rules.conditions);
      setFilterConjunction(view.filter_rules.conjunction || 'and');
    } else {
      setFilterConditions([]);
      setFilterConjunction('and');
    }

    // Apply column visibility and column order
    if (Array.isArray(view.visible_columns) && view.visible_columns.length > 0) {
      const visibleSet = new Set(view.visible_columns);
      const orderMap = new Map(view.visible_columns.map((id, idx) => [id, idx]));
      setColumns(() => {
        const updated = availableCols.map((c) => ({
          ...c,
          is_visible: visibleSet.has(c.id),
        }));
        return [...updated].sort((a, b) => {
          const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999 + a.position;
          const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999 + b.position;
          return idxA - idxB;
        });
      });
    } else {
      // If view has no custom column filter or visible_columns is null/empty,
      // all available columns are visible by default!
      setColumns(() =>
        availableCols.map((c) => ({
          ...c,
          is_visible: true,
        }))
      );
    }
  };

  const handleSelectView = (view: SavedView) => {
    flushPendingSave();
    applyView(view);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [fetchedConfig, fetchedFilters, fetchedColumns, fetchedIssues] = await Promise.all([
        fetchConfig(),
        fetchFilters(),
        fetchColumns(),
        fetchIssues(),
      ]);
      setConfig(fetchedConfig);
      setFilters(fetchedFilters);
      setColumns(fetchedColumns);
      setAllIssues(fetchedIssues);

      const activeFilter = fetchedConfig.selected_filter_id || (fetchedFilters[0]?.id) || '';
      if (activeFilter) {
        setSelectedFilterId(activeFilter);
      }

      const fetchedViews = await fetchViews(activeFilter || undefined).catch(() => []);
      if (fetchedViews && fetchedViews.length > 0) {
        setViews(fetchedViews);
        const initialView =
          fetchedViews.find((v) => v.id === activeViewId) ||
          fetchedViews.find((v) => v.is_default) ||
          fetchedViews[0];
        if (initialView) {
          applyView(initialView, fetchedColumns);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Initial Data Load & OAuth Callback handling
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthCode = urlParams.get('code');
    if (oauthCode) {
      window.history.replaceState({}, document.title, window.location.pathname);
      apiFetch('/api/auth/jira/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: oauthCode, state: urlParams.get('state') || '', redirect_uri: window.location.origin + '/auth/callback' }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(lang === 'es' ? 'No se pudo conectar con Atlassian.' : 'Could not connect to Atlassian.');
          return res.json();
        })
        .then(() => {
          setBannerMessage(lang === 'es' ? 'Conexión Atlassian OAuth establecida.' : 'Atlassian OAuth connected.');
          setTimeout(() => setBannerMessage(null), 4000);
          loadAllData();
        })
        .catch((err) => alert(`OAuth error: ${err.message}`));
    } else {
      loadAllData();
    }
  }, [lang]);

  const handleUpdateCustomValue = async (issueKey: string, columnId: string, value: any) => {
    setAllIssues((prev) =>
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

  const handleUpdateCustomValuesBulk = async (
    updates: Array<{ issueKey: string; columnId: string; value: any }>
  ) => {
    if (updates.length === 0) return;

    setAllIssues((prev) => {
      const updateMap = new Map<string, Record<string, any>>();
      for (const u of updates) {
        if (!updateMap.has(u.issueKey)) {
          updateMap.set(u.issueKey, {});
        }
        updateMap.get(u.issueKey)![u.columnId] = u.value;
      }

      return prev.map((item) => {
        const itemUpdates = updateMap.get(item.key);
        if (itemUpdates) {
          return {
            ...item,
            custom_values: {
              ...item.custom_values,
              ...itemUpdates,
            },
          };
        }
        return item;
      });
    });

    try {
      await bulkSetCustomValues(
        updates.map((u) => ({
          issue_key: u.issueKey,
          column_id: u.columnId,
          value: u.value,
        }))
      );
    } catch (err) {
      console.error(err);
      loadAllData();
    }
  };

  // Table Management & Local Issues CRUD
  const handleCreateLocalTable = async (name: string) => {
    try {
      const updatedFilters = await addConfiguredFilter({ name, type: 'local' });
      setFilters(updatedFilters);
      const newTable = updatedFilters.find((f) => f.name === name);
      if (newTable) {
        handleSelectFilter(newTable.id);
      }
    } catch (err: any) {
      alert(`Error al crear tabla local: ${err.message}`);
    }
  };

  const handleCreateJiraFilterTable = async (data: { id?: string; name: string; jql?: string }) => {
    try {
      const updatedFilters = await addConfiguredFilter({
        id: data.id,
        name: data.name,
        jql: data.jql,
        type: 'jira_filter',
      });
      setFilters(updatedFilters);
      const newTable = data.id
        ? updatedFilters.find((f) => f.id === data.id)
        : updatedFilters.find((f) => f.name === data.name);
      if (newTable) {
        handleSelectFilter(newTable.id);
        // Pull issues for this Jira filter in background
        syncIssues(newTable.id)
          .then(async (res) => {
            const [updatedIssues, updatedConfig] = await Promise.all([
              fetchIssues(),
              fetchConfig(),
            ]);
            setAllIssues(updatedIssues);
            setConfig(updatedConfig);
            setBannerMessage(res.message);
            setTimeout(() => setBannerMessage(null), 4000);
          })
          .catch(console.error);
      }
    } catch (err: any) {
      alert(`Error al vincular filtro de Jira: ${err.message}`);
      throw err;
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    try {
      const updatedFilters = await removeConfiguredFilter(tableId);
      setFilters(updatedFilters);
      if (selectedFilterId === tableId && updatedFilters.length > 0) {
        handleSelectFilter(updatedFilters[0].id);
      }
    } catch (err: any) {
      alert(`Error al eliminar tabla: ${err.message}`);
    }
  };

  const handleCreateRow = async () => {
    if (!selectedFilterId) return;
    try {
      const newIssue = await createIssue({
        table_id: selectedFilterId,
        summary: lang === 'es' ? 'Nuevo registro' : 'New record',
      });
      setAllIssues((prev) => [newIssue, ...prev]);
    } catch (err: any) {
      alert(`Error al crear fila: ${err.message}`);
    }
  };

  const handleUpdateLocalIssue = async (key: string, data: Partial<JiraIssue>) => {
    setAllIssues((prev) =>
      prev.map((i) => (i.key === key ? { ...i, ...data } : i))
    );
    try {
      await updateLocalIssue(key, data);
    } catch (err: any) {
      alert(`Error al actualizar fila: ${err.message}`);
      loadAllData();
    }
  };

  const handleDeleteIssue = async (key: string) => {
    setAllIssues((prev) => prev.filter((i) => i.key !== key));
    try {
      await deleteIssue(key);
    } catch (err: any) {
      alert(`Error al eliminar fila: ${err.message}`);
      loadAllData();
    }
  };

  const handleAddColumn = async (columnData: Partial<CustomColumn>) => {
    try {
      const newCol = await createColumn(columnData);
      setColumns((prev) => {
        const next = [...prev, newCol];
        const visibleIds = next.filter((c) => c.is_visible).map((c) => c.id);
        autoSaveActiveView({ visible_columns: visibleIds }, 0);
        return next;
      });
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
      setColumns((prev) => {
        const next = prev.filter((c) => c.id !== columnId);
        const visibleIds = next.filter((c) => c.is_visible).map((c) => c.id);
        autoSaveActiveView({ visible_columns: visibleIds }, 0);
        return next;
      });
    } catch (err: any) {
      alert(`Error al eliminar columna: ${err.message}`);
    }
  };

  const handleToggleColumnVisibility = async (columnId: string) => {
    const targetCol = columns.find((c) => c.id === columnId);
    if (!targetCol) return;
    const newVisibility = !targetCol.is_visible;
    const updated = columns.map((c) =>
      c.id === columnId ? { ...c, is_visible: newVisibility } : c
    );
    setColumns(updated);
    const visibleIds = updated.filter((c) => c.is_visible).map((c) => c.id);
    autoSaveActiveView({ visible_columns: visibleIds }, 0);
    try {
      await updateColumn(columnId, { is_visible: newVisibility });
    } catch (err) {
      console.error(err);
    }
  };

  const handleShowAllColumns = async () => {
    const updated = columns.map((c) => ({ ...c, is_visible: true }));
    setColumns(updated);
    const visibleIds = updated.map((c) => c.id);
    autoSaveActiveView({ visible_columns: visibleIds }, 0);
  };

  const handleHideAllColumns = async () => {
    const updated = columns.map((c) => ({ ...c, is_visible: false }));
    setColumns(updated);
    autoSaveActiveView({ visible_columns: [] }, 0);
  };

  const handleUpdateColumnWidth = async (columnId: string, width: number) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === columnId ? { ...c, width } : c))
    );
    try {
      await updateColumn(columnId, { width });
    } catch (err) {
      console.error('Error saving column width:', err);
    }
  };

  const handleReorderColumns = async (reorderedCols: CustomColumn[]) => {
    setColumns(reorderedCols);
    const visibleIds = reorderedCols.filter((c) => c.is_visible).map((c) => c.id);
    autoSaveActiveView({ visible_columns: visibleIds }, 0);
    try {
      await reorderColumns(reorderedCols.map((c) => c.id));
    } catch (err) {
      console.error('Error saving column reorder:', err);
    }
  };

  const handleUpdateColumn = async (columnId: string, data: Partial<CustomColumn>) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === columnId ? { ...c, ...data } : c))
    );
    try {
      await updateColumn(columnId, data);
    } catch (err) {
      console.error('Error updating column:', err);
      throw err;
    }
  };

  const handleFilterConditionsChange = (newConditions: FilterCondition[]) => {
    setFilterConditions(newConditions);
    const filterRules = newConditions.length > 0 ? {
      conditions: newConditions,
      conjunction: filterConjunction,
    } : null;
    const isRemoving = newConditions.length <= filterConditions.length;
    autoSaveActiveView({ filter_rules: filterRules }, isRemoving ? 0 : 400);
  };

  const handleFilterConjunctionChange = (newConjunction: FilterConjunction) => {
    setFilterConjunction(newConjunction);
    const filterRules = filterConditions.length > 0 ? {
      conditions: filterConditions,
      conjunction: newConjunction,
    } : null;
    autoSaveActiveView({ filter_rules: filterRules }, 0);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    autoSaveActiveView({ search_query: query }, 400);
  };

  const handleGroupByChange = (field: string | null) => {
    setGroupBy(field);
    autoSaveActiveView({ group_by: field }, 0);
  };

  const handleSortChange = (field: string | null, dir: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(dir);
    autoSaveActiveView({ sort_field: field, sort_direction: dir }, 0);
  };

  const handleExportPdf = () => {
    exportIssuesToPdf({
      issues: filteredAndSortedIssues,
      columns,
      groupBy,
      config,
      filterName: filters.find((f) => f.id === selectedFilterId)?.name,
      lang,
    });
  };

  const handleCreateView = async (name: string) => {
    flushPendingSave();
    const visibleColIds = columns.filter((c) => c.is_visible).map((c) => c.id);
    const filterRules = filterConditions.length > 0 ? {
      conditions: filterConditions,
      conjunction: filterConjunction,
    } : null;

    const newView = await createView({
      name,
      group_by: groupBy,
      sort_field: sortField,
      sort_direction: sortDirection,
      search_query: searchQuery,
      filter_id: selectedFilterId,
      visible_columns: visibleColIds,
      filter_rules: filterRules,
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
        const fallback = remaining.find((v) => v.is_default) || remaining[0];
        if (fallback) handleSelectView(fallback);
      }
    } catch (err: any) {
      alert(`Error al eliminar vista: ${err.message}`);
    }
  };

  // Filtered and Sorted Issues
  const filteredAndSortedIssues = useMemo(() => {
    let result = [...tableIssues];

    // 1. Text Search Query
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

    // 2. QuickGrid Multi-Field Filters
    if (filterConditions.length > 0) {
      result = filterIssues(result, filterConditions, filterConjunction, columns);
    }

    // 3. Sorting
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
  }, [tableIssues, searchQuery, filterConditions, filterConjunction, columns, sortField, sortDirection]);

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
            <strong>{tableIssues.length}</strong> {t.tickets_loaded}
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

      {/* Tables / Projects Tabs across the top */}
      <TableTabs
        tables={filters}
        activeTableId={selectedFilterId}
        onSelectTable={handleSelectFilter}
        onOpenCreateTable={() => setIsCreateTableOpen(true)}
        onDeleteTable={handleDeleteTable}
        lang={lang}
      />

      {/* Main Workspace Body: Views Sidebar on Left + Grid/Toolbar on Right */}
      <div className="flex-1 flex overflow-hidden">
        {/* Collapsible Left Views Sidebar */}
        <ViewsSidebar
          views={views}
          activeViewId={activeViewId}
          onSelectView={handleSelectView}
          onOpenCreateView={() => setIsCreateViewOpen(true)}
          onDeleteView={handleDeleteView}
          isOpen={isViewsSidebarOpen}
          onToggleOpen={() => setIsViewsSidebarOpen((prev) => !prev)}
          lang={lang}
        />

        {/* Right Content Area (Toolbar + DataGrid) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* QuickGrid Toolbar */}
          <Toolbar
            filters={filters}
            selectedFilterId={selectedFilterId}
            onSelectFilter={handleSelectFilter}
            onSync={handleSync}
            syncing={syncing}
            lastSync={config?.last_sync}
            isLocalTable={isLocalTable}
            onAddRow={handleCreateRow}
            isViewsSidebarOpen={isViewsSidebarOpen}
            onToggleViewsSidebar={() => setIsViewsSidebarOpen((prev) => !prev)}
            columns={columns}
            onToggleColumnVisibility={handleToggleColumnVisibility}
            onOpenManageFields={() => setIsManageFieldsOpen(true)}
            onOpenAddColumn={() => setIsAddColumnOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onExportPdf={handleExportPdf}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            groupBy={groupBy}
            onGroupByChange={handleGroupByChange}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            filterConditions={filterConditions}
            onFilterConditionsChange={handleFilterConditionsChange}
            filterConjunction={filterConjunction}
            onFilterConjunctionChange={handleFilterConjunctionChange}
            issues={tableIssues}
            matchingCount={filteredAndSortedIssues.length}
            totalCount={tableIssues.length}
            lang={lang}
          />

          {/* Main Data Table Area */}
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-white text-gray-400 gap-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Cargando base de datos y registros...</p>
            </div>
          ) : (
            <DataGrid
              issues={filteredAndSortedIssues}
              columns={columns}
              allIssues={allIssues}
              tables={filters}
              onUpdateCustomValue={handleUpdateCustomValue}
              onUpdateCustomValuesBulk={handleUpdateCustomValuesBulk}
              onUpdateLocalIssue={handleUpdateLocalIssue}
              onDeleteIssue={handleDeleteIssue}
              onOpenArchivyDrawer={(issue) => setActiveArchivyIssue(issue)}
              onOpenAddColumn={() => setIsAddColumnOpen(true)}
              onOpenEditColumn={(col) => {
                setEditColumnOrigin('grid');
                setEditingColumn(col);
              }}
              onDeleteColumn={handleDeleteColumn}
              onUpdateColumnWidth={handleUpdateColumnWidth}
              onReorderColumns={handleReorderColumns}
              groupBy={groupBy}
              jiraDomain={config?.jira_domain}
              lang={lang}
            />
          )}
        </div>
      </div>

      {/* Side Drawer for Archivy Notes */}
      <ArchivyDrawer
        issue={activeArchivyIssue}
        onClose={() => setActiveArchivyIssue(null)}
      />

      {/* Manage Fields Modal */}
      <ManageFieldsModal
        isOpen={isManageFieldsOpen}
        onClose={() => setIsManageFieldsOpen(false)}
        columns={columns}
        onToggleVisibility={handleToggleColumnVisibility}
        onShowAll={handleShowAllColumns}
        onHideAll={handleHideAllColumns}
        onReorderColumns={handleReorderColumns}
        onUpdateColumn={handleUpdateColumn}
        onDeleteColumn={handleDeleteColumn}
        onOpenAddColumn={() => {
          setIsManageFieldsOpen(false);
          setIsAddColumnOpen(true);
        }}
        onOpenEditColumn={(col) => {
          setIsManageFieldsOpen(false);
          setEditColumnOrigin('manage_fields');
          setEditingColumn(col);
        }}
        lang={lang}
      />

      {/* Add Column Modal */}
      <AddColumnModal
        isOpen={isAddColumnOpen}
        onClose={() => setIsAddColumnOpen(false)}
        onAddColumn={handleAddColumn}
        existingColumns={columns}
        tables={filters}
        activeTableId={selectedFilterId}
        lang={lang}
      />

      {/* Edit Column Modal */}
      <EditColumnModal
        isOpen={!!editingColumn}
        onClose={() => {
          const origin = editColumnOrigin;
          setEditingColumn(null);
          setEditColumnOrigin(null);
          if (origin === 'manage_fields') {
            setIsManageFieldsOpen(true);
          }
        }}
        column={editingColumn}
        onUpdateColumn={handleUpdateColumn}
        existingColumns={columns}
        lang={lang}
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

      {/* Create Table Modal (Local Table or Jira Filter) */}
      <CreateTableModal
        isOpen={isCreateTableOpen}
        onClose={() => setIsCreateTableOpen(false)}
        onCreateLocalTable={handleCreateLocalTable}
        onCreateJiraFilterTable={handleCreateJiraFilterTable}
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
