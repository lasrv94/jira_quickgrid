# Jira Airtable-like Web App 🚀

Aplicación web interna para la gestión visual, moderna y ligera de tickets de Jira con interfaz interactiva estilo **Airtable**, conexión por **OAuth 2.0 (3LO)** o **API Token**, persistencia garantizada de campos personalizados locales (estados internos, comentarios, single-selects con badges pastel) que **nunca se sobreescriben ni se pierden al sincronizar**, y soporte de notas y documentación técnica integrado con **Archivy**.

---

## 🌟 Características Principales

1. **Interfaz estilo Airtable Data Grid:**
   * **Columnas fijas (Sticky columns):** `Key` y `Summary` quedan fijas a la izquierda para una navegación fluida con scroll horizontal completo y redimensionamiento dinámico de columnas (drag-to-resize).
   * **Distinción visual clara:** Indicador de sólo lectura con candado para campos nativos de Jira. Por regla del sistema, los campos nativos de Jira son estrictamente de solo lectura y no se pueden editar en la interfaz.
   * **Píldoras y Componentes:** Soporte enriquecido para arrays nativos de Jira (Labels, Components) con diseño de múltiples píldoras de colores.
   * **Reordenamiento drag & drop:** Permite arrastrar columnas desde el encabezado o reorganizarlas en el gestor de campos guardando automáticamente la preferencia.
   * **Agrupación dinámica (Group By):** Agrupa tickets por Estado de Jira, Prioridad, Asignado o Columnas Personalizadas con conteo y colapso/expansión.
   * **Visibilidad de Columnas:** Selector desplegable para mostrar, ocultar y reordenar campos a conveniencia.
   * **Creador de Columnas (+):** Añade nuevos campos locales en 2 clics (Single Select, Texto corto, Texto largo, Número, Fecha, Archivy Link). Las celdas personalizadas locales soportan edición rápida mediante icono de lápiz o doble clic.

2. **Regla de Persistencia Segura (No-Overwrite Guarantee):**
   * Los tickets de Jira se sincronizan vía **UPSERT** sobre `jira_issues`.
   * La tabla de valores locales `issue_custom_values` **permanece 100% intacta** indexada por `(issue_key, column_id)`.
   * Si un ticket cambia en Jira (título, estado, asignado), los datos de Jira se actualizan pero las notas, comentarios y estados internos locales se preservan sin alteraciones.
   * Suite de tests automatizados (`pytest server/tests/`) valida esta regla matemáticamente.

3. **Integración con Atlassian Jira:**
   * **Modo Mock / Simulación:** Carga inmediata de tickets realistas de un sprint activo para pruebas y desarrollo sin necesidad de credenciales.
   * **Atlassian OAuth 2.0 (3LO):** Conexión segura estándar mediante Atlassian Developer Console (`read:jira-work`, `read:jira-user`, `offline_access`).
   * **Jira Cloud API Token:** Soporte directo con correo y API Token de Atlassian Security.
   * **Selector de Filtros Favoritos:** Permite consultar y alternar entre filtros guardados de Jira (`/rest/api/3/filter/favourite`).

4. **Integración con Archivy (Knowledge Base):**
   * **Side-Drawer Lateral:** Panel deslizable al hacer clic en "Wiki Doc" en cualquier fila.
   * Generación y vinculación automática de notas Markdown con título `[PROJ-XXX] Summary` y etiquetas `#jira #PROJ-XXX`.
   * Editor Markdown con pestañas de "Editor" y "Vista Previa" renderizada.
   * Portabilidad completa: Las notas se guardan directamente como archivos Markdown (`.md`) en `server/data/archivy_notes/`.

---

## 🏗️ Estructura del Proyecto

```text
JIRA_WEB/
├── client/                      # Frontend SPA (React 19 + TypeScript + Tailwind CSS)
│   ├── src/
│   │   ├── components/
│   │   │   ├── AddColumnModal.tsx   # Modal para crear nuevas columnas locales
│   │   │   ├── ArchivyDrawer.tsx    # Panel lateral de documentación Markdown
│   │   │   ├── DataGrid.tsx         # Tabla Airtable con sticky cols, grouping e inline edit
│   │   │   ├── SettingsModal.tsx    # Modal de configuración de Jira y OAuth
│   │   │   └── Toolbar.tsx          # Barra de herramientas (Filtros, Sync, Sort, Group)
│   │   ├── services/api.ts          # Cliente API REST
│   │   ├── types/index.ts           # Definiciones de tipos TypeScript
│   │   ├── utils/colors.ts          # Paleta de colores pastel estilo Airtable
│   │   ├── App.tsx                  # Componente principal
│   │   └── index.css                # Estilos Tailwind CSS v4
│   └── vite.config.ts               # Proxy al backend en puerto 8000
│
├── server/                      # Backend API (FastAPI + SQLite WAL mode)
│   ├── data/archivy_notes/      # Almacén de notas Markdown de Archivy
│   ├── routers/
│   │   ├── archivy.py               # Endpoints para notas Markdown
│   │   ├── auth.py                  # Endpoints OAuth 2.0 Atlassian y credenciales
│   │   ├── columns.py               # Endpoints CRUD para columnas personalizadas
│   │   └── issues.py                # Endpoints de sincronización y valores locales
│   ├── services/
│   │   ├── archivy_service.py       # Lógica de notas y archivos Markdown
│   │   └── jira_service.py          # Cliente Jira Cloud, OAuth y Mock Data
│   ├── tests/
│   │   ├── test_persistence.py      # Test de preservación de campos personalizados
│   │   └── test_api_endpoints.py    # Test de integración de todos los endpoints
│   ├── database.py                  # Conexión SQLite con WAL mode y foreign keys
│   ├── models.py                    # Modelos SQLAlchemy y esquemas Pydantic
│   └── main.py                      # Punto de entrada FastAPI
│
├── run.bat                      # Lanzador rápido para Windows CMD
├── start.ps1                    # Lanzador rápido para PowerShell
└── plan.md                      # Plan de especificación original
```

---

## 🚀 Puesta en Marcha

### Opción 1: Inicio Rápido con un Clic (Recomendado)
Ejecuta en la terminal de PowerShell o haz doble clic:
```powershell
.\start.ps1
```
O con CMD:
```cmd
run.bat
```
Esto levantará el backend en `http://127.0.0.1:8000`, el frontend en `http://localhost:5173` y abrirá tu navegador automáticamente.

---

### Opción 2: Inicio Manual

#### 1. Backend (FastAPI)
```powershell
cd server
.\.venv\Scripts\Activate.ps1
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
* Swagger Docs interactivo: `http://127.0.0.1:8000/docs`

#### 2. Frontend (Vite + React)
```powershell
cd client
npm run dev
```
* Acceso a la aplicación: `http://localhost:5173`

---

## 🧪 Ejecución de Pruebas Automatizadas

Para validar que los datos personalizados **nunca se sobreescriben al sincronizar** y que todas las APIs funcionan correctamente:

```powershell
.\server\.venv\Scripts\pytest.exe server/tests/ -v
```

Resultado esperado:
```text
server/tests/test_api_endpoints.py::test_health_check PASSED
server/tests/test_api_endpoints.py::test_auth_status PASSED
server/tests/test_api_endpoints.py::test_columns_crud PASSED
server/tests/test_api_endpoints.py::test_issues_list_and_sync PASSED
server/tests/test_api_endpoints.py::test_archivy_notes PASSED
server/tests/test_persistence.py::test_custom_values_never_overwritten_by_jira_sync PASSED
server/tests/test_persistence.py::test_archived_issue_retains_custom_values PASSED

======================== 7 passed in 0.96s ========================
```

---

## ⚙️ Configuración de Conexión con Jira

Puedes configurar la conexión desde la propia interfaz web haciendo clic en el botón de **⚙️ (Configuración)** en la barra de herramientas:

1. **Modo Simulación (Mock):**
   * No requiere credenciales. Viene habilitado por defecto con tickets representativos para probar inmediatamente.
2. **Modo Atlassian OAuth 2.0 (3LO):**
   * En [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/):
     * Crea una App OAuth 2.0 (3LO).
     * Añade la API **Jira platform REST API**.
     * Configura el Callback URL: `http://localhost:5173/auth/callback`.
     * Añade los scopes: `read:jira-work`, `read:jira-user`, `offline_access`.
     * Copia `Client ID` y `Client Secret` en la ventana de configuración y pulsa **"Conectar con Atlassian Jira"**.
3. **Modo Jira API Token:**
   * Introduce tu dominio de Jira (ej: `tu-empresa.atlassian.net`), tu correo electrónico y tu API token generado en [Atlassian Account Security](https://id.atlassian.com/manage-profile/security/api-tokens).
