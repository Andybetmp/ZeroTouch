# Spec 05 — Especificación Frontend Web Corporativo React (App Bateas v2.1.0) y Carné Digital QR (SDD)

## 1. Arquitectura Visual Web Desktop (Look & Feel Oficial App Bateas v2.1.0)

El frontend en **React 19 + TypeScript + Tailwind CSS + Lucide Icons** es una **Aplicación Web Corporativa (Desktop-first)** que replica fielmente la interfaz real del **Sistema de Recursos Humanos — App Bateas v2.1.0** documentada en los Entregables 2 y 3:

1. **Barra Lateral Izquierda Fija (`#232d3b`)**:
   - Cabecera con logo `App Bateas` y navegación jerárquica de módulos:
     - `🏠 Inicio (Acceso directo / Panel de Control)`
     - `📋 Afiliaciones` → `Afiliados y Carga OCR (ECM)`, `Bandeja de Excepciones (SSOMA/Médico/DHO)`, `Capacitaciones Web (E-Learning)`, `Documentos por estadía`, `Lista negra`
     - `🛡️ Control de accesos` → `Carné Digital QR y Cola Fotocheck PVC (Garita)`
2. **Barra Superior Blanca (`Top Header`)**:
   - Enlaces `Inicio | Salir`, selector rápido de Rol de Simulación (`Administrador ECM / Contratista`, `Especialista SSOMA / Médico / DHO`, `Control Garita`) y perfil del usuario conectado.
3. **Área de Trabajo Principal con Breadcrumbs**:
   - Encabezado `Sistema de Recursos Humanos` o título del módulo con ruta de navegación (`Inicio / Afiliación / ...`).

---

## 2. Especificación de Módulos Web

### 2.1. Módulo 1: Inicio — Acceso Directo y Panel de Control
- **Pestaña "Acceso directo"** (Réplica de Entregable 3, Figura 2):
  - Grid de tarjetas ilustradas con borde destacado para los módulos intervenidos por **Bateas Zero-Touch**:
    - **Afiliación (Borde Verde Zero-Touch)**: *"Revise el estado de su afiliación, adjunte sus documentos para pre-validación OCR, revise el Semáforo Operativo."*
    - **Capacitaciones E-Learning (Borde Índigo)**: *"Complete sus inducciones teóricas obligatorias 24/7 y rinda su evaluación web."*
    - **Bandeja de Excepciones SSOMA/DHO (Borde Ámbar)**: *"Audite únicamente el ~20% de documentos observados o con incertidumbre OCR."*
    - **Reservas de Viaje y Carné Digital QR (Borde Azul)**: *"Verifique su habilitación en Semáforo Verde, visualice su Carné Digital QR y orden de Fotocheck PVC."*
- **Pestaña "Panel de control"** (Réplica de Entregable 2, Figura 2):
  - Gráfico comparativo de Barras por Empresa Contratista (ECM) y Gráficos de Dona (**Situación Diagnóstico AS-IS: 3,152 vencidos / 87.9%** vs. **Situación Tiempo Real TO-BE en Supabase PostgreSQL**).

### 2.2. Módulo 2: Afiliación, Carga OCR y Semáforo Operativo (Vista Web ECM)
- **Layout Web de 2 Columnas (Master-Detail)**:
  - Columna izquierda: Lista de trabajadores afiliados con filtro por Semáforo (`🟢 VERDE`, `🟡 ÁMBAR`, `🔴 ROJO`), buscador por DNI/Nombre, botón `+ Nuevo Afiliado` y barra de simulación rápida de los 4 casos OCR.
  - Columna derecha: Ficha integral del expediente seleccionado, Semáforo Operativo, tabla de requisitos con las banderas `¿Es obligatorio?` y `¿Requiere vigencia?`, subida de PDF/Imagen con lectura OCR instantánea e historial de auditoría.

### 2.3. Módulo 3: Bandeja de Excepciones Split-Screen (SSOMA / Área Médica / DHO)
- **Layout Web Split-Screen (Pantalla Dividida)**:
  - Panel izquierdo: Cola de tickets `OPEN` en estado `ÁMBAR` filtrables por área (`SSOMA`, `AREA_MEDICA`, `DHO`, `AREA_USUARIA`).
  - Panel derecho (Inspector Documental): Muestra lado a lado el **Visor del Documento / Texto Extraído por OCR** y el **Formulario de Dictamen Técnico**, permitiendo corregir manualmente la fecha de vencimiento y aprobar (`VERDE`) o rechazar (`ROJO`) sin reiniciar el resto del expediente.

### 2.4. Módulo 4: Documentos por Estadía y Lista Negra (Maestros App Bateas v2.1.0)
- **Tabla Maestra `Documentos por estadía`** (Réplica exacta de Entregable 3, Figura 3):
  - Columnas `#`, `Tipo de Estadía`, `Descripción`, `Perfil`, `¿Es obligatorio?` (badge `Sí` verde / `No` ámbar), `¿Requiere vigencia?` (badge `Sí` verde / `No` ámbar), `Área Responsable` y botones de acción.
- **Tabla `Lista negra`**:
  - Buscador y formulario para registrar DNIs con restricción activa en unidad minera.

### 2.5. Módulo 5: Aula Web E-Learning Asíncrona y Carné Digital QR / Garita PVC
- **Aula Web E-Learning**: Vista web estructurada con módulos de *Seguridad General* y *Medio Ambiente* y examen de certificación en línea.
- **Control de Garita y Carné Digital QR**: Vista web de tarjetas de credenciales habilitadas (`Semáforo VERDE`) con código QR verificable y gestión de cola de impresión de **Fotocheck físico en PVC**.

