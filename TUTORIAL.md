# 📘 Guía de Instalación y Manual de Uso: Jira Airtable Web App

Bienvenido a **Jira Airtable Grid**. Este manual explica paso a paso cómo instalar, ejecutar, utilizar y publicar esta aplicación en GitHub para que cualquier miembro del equipo pueda utilizarla sin complicaciones.

---

## 📋 1. Requisitos Previos

Antes de comenzar, asegúrate de tener instalado en tu computadora:

* **Python:** Versión 3.10 o superior ([Descargar Python](https://www.python.org/downloads/)). *(En Windows, asegúrate de marcar la casilla "Add Python to PATH")*.
* **Node.js:** Versión 18 o superior ([Descargar Node.js LTS](https://nodejs.org/)).
* **Git:** Para clonar y versionar el repositorio ([Descargar Git](https://git-scm.com/)).

---

## 🚀 2. Instalación Paso a Paso

### En Windows (Recomendado con 1 Clic)
1. Abre la carpeta del proyecto en el Explorador de Archivos o la terminal.
2. Haz doble clic en el archivo **`setup.bat`** (o ejecútalo desde CMD).
3. El instalador creará automáticamente el entorno virtual de Python (`.venv`), instalará las librerías del backend y los paquetes de Node.js del frontend.

### En macOS / Linux
Abre tu terminal en la carpeta del proyecto y ejecuta:
```bash
chmod +x setup.sh start.sh
./setup.sh
```

### Instalación Manual (Opcional)
Si prefieres instalar cada componente de forma individual:
```bash
# 1. Configurar Backend
cd server
python -m venv .venv
# En Windows: .venv\Scripts\activate
# En Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
cd ..

# 2. Configurar Frontend
cd client
npm install
cd ..
```

---

## 💻 3. Cómo Iniciar la Aplicación

### En Windows
* **Doble clic en `run.bat`**  
  *O en PowerShell:*
  ```powershell
  .\start.ps1
  ```
Esto iniciará el backend y el frontend simultáneamente y abrirá tu navegador predeterminado.

### En macOS / Linux
```bash
./start.sh
```

### URLs de Acceso:
* **Aplicación Web (Airtable Grid):** [http://localhost:5173](http://localhost:5173)
* **Documentación Interactiva Swagger API:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🎯 4. Manual de Uso de la Aplicación

### 4.1. Navegación en el Data Grid Estilo Airtable
* **Columnas fijas (Sticky):** Las columnas **Clave Jira** (`Key`) y **Título** (`Summary`) se mantienen visibles a la izquierda mientras te desplazas horizontalmente.
* **Columnas Nativas de Jira (Read-Only):** Tienen un icono de candado que indica que provienen de Jira y no pueden ser editadas arbitrariamente para garantizar fidelidad con la fuente oficial.

### 4.2. Creación de Campos Locales Personalizados
Puedes agregar campos de trabajo interno que **Jira no tiene**, pulsando el botón **`+ Campo`** en la cabecera o **`Añadir Campo`** en la barra superior:
1. **Single Select (Pills de Colores):** Define estados internos (ej: *"En Análisis"*, *"Listo para Dev"*, *"Bloqueado"*). Puedes asociarle un color pastel temático a cada opción.
2. **Texto Corto / Texto Largo:** Para comentarios de QA, notas técnicas o anotaciones privadas del equipo.
3. **Fecha y Número:** Para seguimiento de estimaciones o plazos internos.
4. **Vínculo Archivy Wiki:** Enlace directo a documentación Markdown.

### 4.3. Regla Crítica: Sincronización sin Pérdida de Datos (No-Overwrite)
* Al presionar el botón **`[ 🔄 Actualizar Datos ]`**:
  * El sistema consulta Jira y actualiza estados, títulos y asignados de los tickets.
  * **Tus campos locales (estados internos, notas de QA, etc.) NUNCA se sobreescriben ni se pierden**, ya que residen en una tabla independiente indexada por la clave del ticket.

### 4.4. Agrupación Dinámica (Group By)
Haz clic en el botón **`📑 Agrupar`** de la barra superior:
* Agrupa tickets por **Estado Jira**, **Prioridad**, **Asignado** o por tus **Columnas de Selección Única locales**.
* Cada grupo cuenta con una cabecera temática colapsable que muestra el número total de tickets en ese estado.

### 4.5. Documentación Técnica con Archivy Side-Drawer
* En cualquier ticket, haz clic en el botón **`Wiki Doc`**.
* Se abrirá un panel lateral deslizante (Drawer) con la plantilla de documentación del ticket (`[CORE-101] Summary`).
* Puedes redactar análisis de causa raíz (RCA), guías de pruebas o actas en Markdown con vista previa instantánea.
* Las notas se guardan automáticamente como archivos `.md` en la carpeta `server/data/archivy_notes/`.

---

## ⚙️ 5. Modos de Conexión con Jira

Abre el modal de configuración haciendo clic en el engranaje **`⚙️`** en la esquina superior derecha:

### Modo 1: Simulación / Mock (Por defecto)
* No requiere credenciales ni cuenta de Jira.
* Carga un sprint activo completo con tickets realistas de diferentes prioridades y estados para demostraciones inmediatas.

### Modo 2: Jira Cloud API Token
Ideal para conectar rápidamente con la instancia de tu empresa:
1. **Dominio:** Tu subdominio de Jira (ej: `miempresa.atlassian.net`).
2. **Correo:** Tu dirección de correo de Atlassian.
3. **API Token:** Genera un token personal en [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens).

### Modo 3: Atlassian OAuth 2.0 (3LO)
Para conexiones corporativas estándar:
1. Entra a [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/).
2. Crea una app OAuth 2.0 (3LO) y agrega la API **Jira platform REST API**.
3. En **Callback URL**, especifica: `http://localhost:5173/auth/callback`.
4. En **Scopes**, añade: `read:jira-work`, `read:jira-user`, `offline_access`.
5. Copia el `Client ID` y `Client Secret` en la app y pulsa **Conectar con Atlassian Jira**.

---

## 🌐 6. Cómo Publicar este Proyecto en GitHub

Para subir este proyecto a tu cuenta de GitHub con control de versiones y tags:

### Paso 1: Crear un nuevo repositorio en GitHub
1. Ve a [github.com/new](https://github.com/new).
2. Nómbralo (por ejemplo: `jira-airtable-grid`).
3. Déjalo como **Público** o **Privado**.
4. **NO marques** "Initialize with README" ni añadas .gitignore (ya están configurados en este proyecto).
5. Haz clic en **Create repository**.

### Paso 2: Conectar y subir el código
En tu terminal local, dentro de la carpeta `JIRA_WEB`:

```powershell
# 1. Vincular el repositorio remoto (reemplaza con tu URL de GitHub)
git remote add origin https://github.com/TU_USUARIO/jira-airtable-grid.git

# 2. Asegurarte de que la rama principal se llame main
git branch -M main

# 3. Subir el código y la etiqueta de versión v1.0.0
git push -u origin main --tags
```

¡Listo! Cualquier persona que visite tu repositorio podrá clonarlo y seguir la sección **2. Instalación Paso a Paso** para correrlo en segundos.
