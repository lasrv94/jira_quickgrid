import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Settings, ShieldCheck, X } from 'lucide-react';
import { updateConfig } from '../services/api';
import type { AppConfig } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig | null;
  onRefreshConfig: () => Promise<void>;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, config, onRefreshConfig }) => {
  const [authType, setAuthType] = useState<'mock' | 'pat' | 'oauth'>(config?.jira_auth_type || 'mock');
  const [domain, setDomain] = useState(config?.jira_domain || '');
  const [email, setEmail] = useState(config?.jira_email || '');
  const [apiToken, setApiToken] = useState('');
  const [clientId, setClientId] = useState(config?.jira_client_id || '');
  const [clientSecret, setClientSecret] = useState('');
  const [archivyDir, setArchivyDir] = useState(config?.archivy_dir || '');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setAuthType(config.jira_auth_type || 'mock');
      setDomain(config.jira_domain || '');
      setEmail(config.jira_email || '');
      setClientId(config.jira_client_id || '');
      setArchivyDir(config.archivy_dir || '');
    }
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      await updateConfig({
        jira_auth_type: authType,
        jira_domain: domain,
        jira_email: email,
        jira_api_token: apiToken || undefined,
        jira_client_id: clientId,
        jira_client_secret: clientSecret || undefined,
        archivy_dir: archivyDir || undefined,
      });
      await onRefreshConfig();
      setStatusMsg('Configuración guardada exitosamente. Sincronizando con Jira...');
      setTimeout(() => {
        setStatusMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOAuthLogin = async () => {
    try {
      if (clientId) {
        await updateConfig({ jira_client_id: clientId, jira_client_secret: clientSecret || undefined });
      }
      const res = await fetch('/api/auth/jira/login');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.detail || 'Error al generar URL de Atlassian OAuth');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden my-8 animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-800 text-base">Configuración de Jira & Conexión</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {statusMsg && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                statusMsg.startsWith('Error') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {statusMsg.startsWith('Error') ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
              Modo de Integración Jira
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAuthType('mock')}
                className={`px-3 py-2.5 rounded-lg border text-xs font-medium text-left transition-all ${
                  authType === 'mock'
                    ? 'border-blue-500 bg-blue-50/50 text-blue-800 shadow-xs'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  <span>⚡ Modo Mock</span>
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">Demostración instantánea</div>
              </button>

              <button
                type="button"
                onClick={() => setAuthType('oauth')}
                className={`px-3 py-2.5 rounded-lg border text-xs font-medium text-left transition-all ${
                  authType === 'oauth'
                    ? 'border-blue-500 bg-blue-50/50 text-blue-800 shadow-xs'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  <span>🔒 Atlassian OAuth</span>
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">OAuth 2.0 (3LO)</div>
              </button>

              <button
                type="button"
                onClick={() => setAuthType('pat')}
                className={`px-3 py-2.5 rounded-lg border text-xs font-medium text-left transition-all ${
                  authType === 'pat'
                    ? 'border-blue-500 bg-blue-50/50 text-blue-800 shadow-xs'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  <span>🔑 API Token</span>
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">Jira Cloud Token</div>
              </button>
            </div>
          </div>

          {/* Conditional Form Fields */}
          {authType === 'mock' && (
            <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 leading-relaxed">
              <p className="font-semibold mb-1">ℹ️ Modo Simulación Activo</p>
              El sistema cargará automáticamente datos de prueba realistas correspondientes al sprint activo de Jira. Puedes probar la creación de columnas personalizadas, notas de Archivy, y sincronización sin necesitar claves de API.
            </div>
          )}

          {authType === 'oauth' && (
            <div className="space-y-3.5 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Credenciales de Atlassian Developer</span>
                <a
                  href="https://developer.atlassian.com/console/myapps/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                >
                  Atlassian Console <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Client ID</label>
                <input
                  type="text"
                  placeholder="Atlassian OAuth Client ID"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Client Secret</label>
                <input
                  type="password"
                  placeholder={config?.jira_client_id ? '••••••••••••••••' : 'Atlassian OAuth Client Secret'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="text-[11px] text-gray-500 bg-white p-2.5 rounded border border-gray-200">
                <strong>Redirect URI requerido en Atlassian Console:</strong>
                <code className="block mt-1 text-blue-700 font-mono">http://localhost:5173/auth/callback</code>
                <span className="block mt-1 text-gray-400">Scopes necesarios: read:jira-work, read:jira-user, offline_access</span>
              </div>

              <button
                type="button"
                onClick={handleOAuthLogin}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Conectar con Atlassian Jira (OAuth 2.0)</span>
              </button>
            </div>
          )}

          {authType === 'pat' && (
            <div className="space-y-3.5 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Dominio Jira (ej. miempresa.atlassian.net)</label>
                <input
                  type="text"
                  placeholder="miempresa.atlassian.net"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Correo Electrónico de Jira</label>
                <input
                  type="email"
                  placeholder="usuario@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Jira API Token</label>
                <input
                  type="password"
                  placeholder={config?.has_api_token ? '••••••••••••••••' : 'Pega tu Jira Cloud API Token'}
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500"
                />
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
                >
                  Generar token en Atlassian Security <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          )}

          {/* Archivy Storage Dir */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
              Directorio de Notas Archivy (Markdown)
            </label>
            <input
              type="text"
              placeholder="Ruta local o dejar vacío para ./data/archivy_notes"
              value={archivyDir}
              onChange={(e) => setArchivyDir(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500 font-mono text-gray-700"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
