import { useEffect, useState } from 'react';
import { BookOpen, Check, Copy, Loader2, Save, X } from 'lucide-react';
import { fetchArchivyNote, saveArchivyNote } from '../services/api';
import type { ArchivyNote, JiraIssue } from '../types';

interface Props {
  issue: JiraIssue | null;
  onClose: () => void;
}

export const ArchivyDrawer: React.FC<Props> = ({ issue, onClose }) => {
  const [note, setNote] = useState<ArchivyNote | null>(null);
  const [content, setContent] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (!issue) return;
    setLoading(true);
    setSavedSuccess(false);
    fetchArchivyNote(issue.key)
      .then((data) => {
        setNote(data);
        setContent(data.content);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [issue]);

  if (!issue) return null;

  const handleSave = async () => {
    if (!issue) return;
    setSaving(true);
    try {
      const updated = await saveArchivyNote(issue.key, content);
      setNote(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const renderMarkdown = (md: string) => {
    return md
      .split('\n')
      .map((line, idx) => {
        if (line.startsWith('# ')) {
          return <h1 key={idx} className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-1 mt-4 mb-2">{line.slice(2)}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={idx} className="text-base font-semibold text-gray-800 mt-4 mb-1.5">{line.slice(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={idx} className="text-sm font-semibold text-gray-700 mt-3 mb-1">{line.slice(4)}</h3>;
        }
        if (line.startsWith('> ')) {
          return (
            <blockquote key={idx} className="border-l-4 border-blue-400 pl-3 py-1 bg-blue-50/50 text-xs text-gray-700 my-1 rounded-r">
              {line.slice(2)}
            </blockquote>
          );
        }
        if (line.startsWith('- ')) {
          return (
            <li key={idx} className="text-xs text-gray-700 ml-4 list-disc my-0.5">
              {line.slice(2)}
            </li>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          return (
            <li key={idx} className="text-xs text-gray-700 ml-4 list-decimal my-0.5">
              {line.replace(/^\d+\.\s/, '')}
            </li>
          );
        }
        if (!line.trim()) {
          return <div key={idx} className="h-2" />;
        }
        return <p key={idx} className="text-xs text-gray-700 leading-relaxed">{line}</p>;
      });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-md flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 animate-in slide-in-from-right duration-250 transition-spring">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 bg-gray-50/70 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-bold font-mono bg-blue-100 text-blue-800 rounded border border-blue-200">
                {issue.key}
              </span>
              <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                {issue.jira_status}
              </span>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                <span>Archivy Wiki Knowledge Base</span>
              </div>
            </div>
            <h2 className="text-base font-semibold text-gray-900 line-clamp-1">{issue.summary}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Note Metadata Banner */}
        <div className="bg-purple-50/60 border-b border-purple-100 px-5 py-2 flex items-center justify-between text-xs text-purple-900">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Archivo Markdown:</span>
            <code className="text-purple-700 bg-purple-100/70 px-1.5 py-0.5 rounded font-mono text-[11px]">
              {note?.path || `.../data/archivy_notes/${issue.key}.md`}
            </code>
          </div>
          {note?.updated_at && (
            <span className="text-[11px] text-purple-600">
              Modificado: {new Date(note.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Tabs and Actions */}
        <div className="px-5 py-2.5 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setActiveTab('edit')}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTab === 'edit' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Editor Markdown
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTab === 'preview' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Vista Previa
            </button>
          </div>

          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Guardado
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Guardar en Archivy</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-5 overflow-y-auto bg-gray-50/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
              <p className="text-xs">Cargando nota de Archivy...</p>
            </div>
          ) : activeTab === 'edit' ? (
            <div className="h-full flex flex-col">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escribe la documentación técnica, análisis de causa raíz (RCA) o notas del ticket..."
                className="w-full h-full min-h-[400px] p-4 text-xs font-mono bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 resize-none shadow-xs leading-relaxed"
              />
            </div>
          ) : (
            <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-xs min-h-[400px] space-y-1">
              {renderMarkdown(content)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
          <span>Integrado con Archivy Knowledge Base (Markdown Portátil)</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(content);
              alert('Contenido Markdown copiado al portapapeles');
            }}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900 font-medium"
          >
            <Copy className="w-3 h-3" /> Copiar Markdown
          </button>
        </div>
      </div>
    </div>
  );
};
