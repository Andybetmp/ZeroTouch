# Informe de Auditoría UX/UI Post-Rediseño — App Bateas v3.0 (Zero-Touch)

**Plataforma:** App Bateas v3.0 · Zero-Touch (Minera Bateas S.A.C.)  
**Alcance:** Validación integral de usabilidad, jerarquía visual, aislamiento por roles (RBAC), estados de carga amigables y respuesta móvil tras completar las 4 fases de rediseño UI/UX.  
**Entorno evaluado:** Frontend React 19 + TypeScript + Tailwind CSS v4 (`http://localhost:5173`) conectado a Backend Node.js/Express + Supabase PostgreSQL + Google Gemini IA (`http://localhost:4000`).  
**Resoluciones probadas:** Escritorio (`1440×900`) y Móvil (`390×844`).  
**Evidencia visual:** 21 capturas reales almacenadas en `docs/ui-audit-final/screenshots/`.

---

## 1. Resumen de Cambios Aplicados por Fase y Sistema de Diseño

El rediseño tomó la estética limpia, espaciosa y minimalista del **Portal del Trabajador** como lenguaje visual unificado para toda la aplicación, sin alterar la lógica de negocio, rutas, endpoints REST ni las reglas de aislamiento RBAC (`SSOMA`, `ECM`, `GARITA`, `TRABAJADOR`).

### 1.1. Sistema de Diseño Unificado

| Elemento | Especificación Aplicada | Propósito UX |
| :--- | :--- | :--- |
| **Lienzo y Superficies** | Fondo global `#F8FAFC` (`--bateas-bg`), tarjetas `#FFFFFF` (`--bateas-surface`) con borde `1px solid #E2E8F0` (`--bateas-border`) y radios `rounded-xl`. | Reduce la fatiga visual y homologa las vistas administrativas con el portal del trabajador. |
| **Tipografía** | Sans-serif del sistema (`Inter` / `Segoe UI` / `system-ui`), escala jerárquica clara (`h1`–`h4`, texto operativo `12px–14px`, metadatos `11px`). | Lectura rápida en tablas densas y tarjetas de habilitación en garita. |
| **CTA Primario Único** | Verde esmeralda corporativo (`emerald-700` / hover `emerald-800`). | Identifica inequívocamente la acción principal en cada pantalla sin competencia visual. |
| **Acciones Secundarias** | Botones *outline/ghost* en tonos `slate` neutros (`bg-white border-slate-200 text-slate-700`). | Elimina la sobrecarga de botones sólidos de colores chillones repetidos por fila. |
| **Semáforo y Estados** | *Soft pills* con borde sutil: `bg-emerald-50 text-emerald-700 border-emerald-200` (**Habilitado**), `bg-amber-50 text-amber-700 border-amber-200` (**Observado / Pendiente**), `bg-rose-50 text-rose-700 border-rose-200` (**Bloqueado**). | Escaneo inmediato de cumplimiento sin saturar la tabla con bloques saturados. |
| **Acento Exclusivo IA** | Tonos `indigo` suaves (`bg-indigo-50 text-indigo-700 border-indigo-200`) reservados únicamente a funciones Gemini IA (`Copiloto Gemini IA`, `Analizar con Gemini IA`, `Autocompletar desde PDF con Gemini IA`). | Diferencia claramente la asistencia por Inteligencia Artificial del resto de acciones operativas. |
| **Accesibilidad de Movimiento** | Transiciones suaves (`transition-all duration-200 ease-out`) y soporte explícito para `@media (prefers-reduced-motion: reduce)` en `index.css`. | Respeta preferencias de accesibilidad del sistema operativo. |

### 1.2. Sistema de Animaciones Amigables de Carga (`LoadingStates.tsx`)

Se implementó un módulo reutilizable en `packages/frontend/src/components/ui/LoadingStates.tsx` con 5 primitivas integradas en las operaciones asíncronas:

1. **`TopProgressBar`:** Barra superior de `2.5px` (`emerald-600`) con animación continua para transiciones y recargas en segundo plano.
2. **`SkeletonCard`:** Variantes `kpi`, `course`, `summary` y `worker` con efecto *shimmer* suave (`bateas-shimmer`).
3. **`SkeletonTable`:** Esqueleto tabular parametrizable (`rows` × `columns`) para matrices de seguimiento y tablas administrativas.
4. **`SmartProcessLoader`:** Tarjeta animada (inline u overlay) con ícono temático (haz de escaneo OCR `bateas-scan-beam`, pulso `Sparkles` para Gemini IA/CV, giro para sincronización), barra de progreso fluida y mensajes rotativos amigables (ej. *"Conectando con Google Gemini IA..."*, *"Evaluando consistencia documental..."*).
5. **`LoadingButton`:** Wrapper de botón en 5 variantes (`primary`, `secondary`, `ghost`, `ai`, `danger`) que preserva el layout al cargar, muestra spinner inline con texto contextual (*"Analizando..."*, *"Filtrando..."*, *"Consultando DNI..."*, *"Generando PDF..."*) y micro-animación de check verde (`bateas-check-pop`) al completar.

### 1.3. Desglose por Fase Ejecutada

- **Fase 1 — Tokens, Layout Global, Modo Demo y Loading System:** Creación de tokens y animaciones en `index.css`, componentes `LoadingStates.tsx` y `DemoModeDrawer.tsx`. Se retiró la barra fija horizontal de escenarios demo OCR y el selector de rol del flujo principal, agrupándolos en el botón discreto `Modo Demo` del header. Se reemplazó el bloque técnico fijo del sidebar por un indicador discreto de punto verde (`Servicios conectados`) con tooltip. Se eliminó toda mención a "QR" en breadcrumbs y navegación.
- **Fase 2 — Control de Acceso (Garita) y Portal del Trabajador:** Se aisló **Garita** en un componente independiente sin sidebar (`GaritaAccessPortal.tsx`) centrado en un buscador prominente de DNI de 8 dígitos con foco automático y tarjetas de alta legibilidad sin códigos QR. Se integró el sistema completo de carga (`TopProgressBar`, `SkeletonCard`, `SmartProcessLoader`, `LoadingButton`) en `WorkerPortal.tsx`.
- **Fase 3 — Admin ECM y Modal Perfil CV:** Se unificó la vista de **Afiliados** en un **Stepper horizontal de 2 pasos** (*Paso 1 · Primer Filtro (DNI + CV)* y *Paso 2 · Habilitación (EMO, SCTR y Certificados)*), eliminando banners y tablas duplicadas. En `WorkerCvProfileModal.tsx` se añadieron `<label>` visibles sobre cada input en las 6 secciones estructuradas, esqueletos de carga inicial y botones `LoadingButton` / `SmartProcessLoader`.
- **Fase 4 — Vistas SSOMA:**
  - *Gestión de Capacitaciones:* 5 tarjetas de Área como filtros clicables y traslado del formulario `+ Nuevo Curso` / `Editar` a un **Slide-over Drawer lateral**.
  - *Seguimiento y Reportes:* `SkeletonCard` + `SkeletonTable`, exportación Excel como CTA primario `emerald-700`, `Constancia PDF` por fila con `LoadingButton`.
  - *Bandeja de Excepciones:* Reemplazo de la consola negra OCR por la tarjeta estructurada **"Datos detectados"** + acordeón colapsado por defecto **"Ver texto crudo OCR"**, junto con `SmartProcessLoader` para Gemini IA.
  - *Torre de Control SSOMA:* Separación en **3 pestañas limpias** (`Avance y Habilitación`, `Registro Presencial y RV`, `Log Biométrico`) y **Modal de Confirmación auditado** antes de Habilitar o Revocar.
  - *Integraciones EMO/SCTR:* 4 tarjetas limpias con *soft pills* y colapso del **Simulador / Sandbox de Webhooks Externos** dentro de un acordeón cerrado por defecto.

---

## 2. Evaluación Paso a Paso de los 4 Flujos Principales

### 2.1. Flujo 1: Portal del Trabajador (`trabajador@bateas.pe`)

**Recorrido verificado (escritorio `1440×900` y móvil `390×844`):**
1. En Login (`http://localhost:5173/`), clic en acceso rápido `🪪 Trabajador (Bio + RV)` (`trabajador@bateas.pe`) → clic en `Ingresar a la Plataforma`.
2. Se despliega el modal de seguridad `Verificación Biométrica Facial con IA` → clic en `✅ Simular Rostro Válido`.
3. Redirección automática a `/portal-trabajador` (sin sidebar administrativo ni controles demo). Durante la consulta inicial se muestra el esqueleto `SkeletonCard` (`Cargando contenido`).
4. En pantalla se visualizan:
   - Header limpio: `Portal del Trabajador` (`Minera Bateas · Capacitación y Habilitación`) y botón `Cerrar sesión`.
   - Tarjeta resumen superior izquierda: badges `TRANSPORTES PESADOS ANDINOS S.A.C.` y `Superficie / Talleres`, nombre `JORGE LUIS HUAMAN CONDORI`, `DNI: 45812034` y barra `0 de 4 cursos completados` (`0%`).
   - Tarjeta superior derecha `ESTADO DE HABILITACIÓN`: badge suave `Pendiente`, `DNI: 45812034` y `Área de ingreso: Superficie / Talleres` (**0 referencias a QR**).
   - Bloque `Etapa 1: Inducción General` (`0 de 2 completados`) con 2 tarjetas minimalistas y único botón verde `Iniciar`.
   - Bloque `Etapa 2: Capacitación Específica del Área` (`Superficie / Talleres`) con 2 cursos asignados automáticamente y bloqueo claro `Completa la Etapa 1 para continuar`.

**Evaluación UX y puntos de fricción detectados:**
- **Fortalezas:** Aislamiento RBAC total (`0` elementos `<aside>`/`<nav>`), ausencia total de QR, progresión intuitiva entre Etapa 1 y Etapa 2, y apilamiento móvil sin desbordamiento horizontal (`0px` overflow a `390px`).
- **Fricciones menores detectadas:**
  - En móvil (`390×844`), el subtítulo del header y el botón `Cerrar sesión` (`101×50px`) se parten en 2 líneas, y el botón `Iniciar` mide `38px` de alto (ligeramente debajo de los `44px` recomendados para tacto móvil).
  - En escritorio, `DNI: 45812034` y `Superficie / Talleres` aparecen repetidos tanto en la tarjeta de perfil como en la tarjeta de `Estado de Habilitación`.

---

### 2.2. Flujo 2: Control de Acceso — Garita (`garita@bateas.pe`)

**Recorrido verificado (escritorio `1440×900` y móvil `390×844`):**
1. En Login, clic en `🚧 Control de Acceso` (`garita@bateas.pe`) → clic en `Ingresar a la Plataforma`.
2. Redirección automática a `/garita/accesos` **sin sidebar administrativo** y **cero menciones a QR** en la interfaz.
3. El cursor queda enfocado en el campo prominente de 8 dígitos (`Ingresa el DNI de 8 dígitos (ej. 72702372)...`).
4. **Escenario positivo (DNI habilitado):** Ingresar `72702372` → clic en `Consultar DNI` → tarjeta verde de alta legibilidad: badge `HABILITADO PARA INGRESO`, `DNI: 72702372`, `RONDON ELIAS RODRIGO WALTER`, `Área: Interior Mina / Socavón`, mensaje `ACCESO AUTORIZADO EN GARITA: Semáforo VERDE y documentos vigentes hasta 2027-05-23. Fotocheck PVC: QUEUED_GARITA.` y botón rápido `Nueva consulta`.
5. **Escenario de error controlado (DNI inexistente):** Clic en `Nueva consulta` → ingresar `99999999` → clic en `Consultar DNI` → tarjeta inline sin fallos de UI: badge `PENDIENTE DE HABILITACIÓN`, mensaje `ACCESO DENEGADO EN GARITA: No existe credencial QR ni trabajador afiliado con el código/DNI "99999999".` y botón `Nueva consulta`.
6. Debajo se muestra el `Padrón de Estado de Habilitación (7)` con filtros `Todos (7)`, `Habilitados (1)`, `Pendientes (6)` y botones `Verificar DNI` / `PVC`.

**Evaluación UX y puntos de fricción detectados:**
- **Fortalezas:** Flujo ultrarrápido de 1 clic + Enter para garita, cero sidebar, cero desbordamiento móvil, botón `Nueva consulta` ágil.
- **Fricciones / hallazgos críticos para corregir:**
  1. **Texto heredado `"credencial QR"` en respuesta del backend:** Al consultar un DNI inexistente (`99999999`), el mensaje devuelto por el API aún dice *"No existe credencial QR ni trabajador afiliado..."*. Debe actualizarse en el backend a *"No existe trabajador afiliado con el DNI..."*.
  2. **Severidad de badge ante DNI inexistente:** Un DNI no registrado muestra el badge ámbar `PENDIENTE DE HABILITACIÓN`, lo cual puede confundirse con un trabajador registrado con cursos pendientes; debería mostrarse en rojo (`NO REGISTRADO` / `ACCESO DENEGADO`).
  3. **Enum interno expuesto:** El mensaje de autorización muestra `Fotocheck PVC: QUEUED_GARITA.` en lugar de un texto legible (*"En cola de impresión"*).
  4. **En móvil (`390×844`):** El placeholder del input de DNI se corta visualmente en `"Ingresa el DNI de 8 dígitos ("`, y los filtros/botones secundarios (`28px–34px`) son algo compactos para uso táctil con guantes o en exteriores.

---

### 2.3. Flujo 3: Administrador ECM / Contratista (`ecm@bateas.pe`)

**Recorrido verificado (escritorio `1440×900`):**
1. En Login, clic en `👷 Admin ECM` (`ecm@bateas.pe`) → clic en `Ingresar a la Plataforma` → vista `/ecm/afiliados`.
2. Panel izquierdo `Padrón de Afiliados (ECM)` con buscador, filtros (`Todos`, `VERDE`, `AMBAR`, `ROJO`), `CSV` y `+ Nuevo`. Al seleccionar un trabajador (`PEDRO PABLO MENDOZA SALAZAR`, `Bloqueado`), el panel derecho muestra su cabecera, el selector `Área: Interior Mina / Socavón` (que reasigna cursos automáticamente al cambiar) y accesos `Perfil CV Estructurado`, `E-Learning` y `Estado de Habilitación`.
3. **Stepper horizontal de 2 pasos:** Muestra `Paso 1 · Primer Filtro (DNI + CV)` (`2 de 2 aprobados`, `Aprobado`) y `Paso 2 · Habilitación (EMO, SCTR y Certificados)` (`3 de 5 aprobados`, `Habilitada`), seguido de una única tabla limpia de requisitos con botones `Subir PDF/Img`, `Ver detalle OCR`, `Simular Vigente` y `Sin Especialidad`.
4. **Modal Perfil CV Estructurado:** Clic en `Perfil CV Estructurado` → transición con esqueleto de 3 tarjetas → split-pane con las 6 secciones a la izquierda (`1. Formación Académica` a `6. Cursos Realizados`) y el visor `Documento CV en PDF` + `Subir PDF` + `Autocompletar desde PDF con Gemini IA (Opcional)` a la derecha. Al pulsar `+ Agregar` en Formación o Experiencia en Minería aparecen los inputs con etiquetas visibles encima (`Institución`, `Título / Grado`, `Año`, `Unidad Minera`, `Cargo / Puesto`, `Tiempo / Años`).

**Evaluación UX y puntos de fricción detectados:**
- **Fortalezas:** Eliminación total de la duplicación visual de Etapa 1 y Etapa 2; selector de Área muy accesible; modal CV muy claro con mensaje explícito de no sobrescritura al subir PDF y etiquetas visibles con ejemplos mineros peruanos (`TECSUP Arequipa`, `U.M. San Cristóbal`).
- **Fricciones detectadas:**
  - Los títulos del Stepper se truncan con puntos suspensivos a `1440×900` (`Paso 1 · Prime...` y `Paso 2 · Habili...`) al compartir ancho con sus badges.
  - El Paso 2 muestra badge verde `Habilitada` (indicando que la etapa está desbloqueada) aunque el trabajador esté `Bloqueado` por SCTR vencido; renombrarlo a `Desbloqueada` o `3/5 aprobados` evitaría ambigüedad.
  - En el Modal CV, las secciones 1–3 muestran texto de estado vacío (*"Sin registros..."*) pero las secciones 4–6 no; además, el botón de eliminar fila en la sección 2 carece de `aria-label`.

---

### 2.4. Flujo 4: Administrador SSOMA / DHO (`ssoma@bateas.pe`)

**Recorrido verificado (escritorio `1440×900`):**
1. **Panel de Control (`/admin/panel`):** 5 KPIs superiores + comparativa AS-IS vs. TO-BE. Controles demo ocultos bajo `Modo Demo` en el header y telemetría reducida a un punto verde `Servicios conectados` en el pie del sidebar.
2. **Drawer Modo Demo:** Clic en `Modo Demo` → apertura suave del drawer lateral (`Modo Demo y Presentación`) con `Simulador de Vista por Rol` y 4 botones de `Generar Expediente Demo (Motor OCR)`.
3. **Gestión de Capacitaciones:** 5 tarjetas de Área clicables como filtros + botones `Sincronizar por área` y `+ Nuevo Curso` (que abre el **Drawer lateral `Nuevo Curso Obligatorio`** con sus 7 campos y botones `Crear y Asociar al Área` / `Cancelar`). Catálogo a ancho completo con *soft pills*.
4. **Seguimiento y Reportes:** Al navegar se observa en vivo `SkeletonCard` (5 KPIs) + `SkeletonTable` (6 filas × 8 columnas) + `LoadingButton` (`Filtrando...`). Al cargar muestra KPIs, barra de filtros, `Exportar PDF` (outline) y `Exportar Excel (.xlsx)` (verde primario). Al buscar `NO_EXISTE_999` + `Filtrar`, se muestra el estado vacío controlado (`No se encontraron registros para los filtros seleccionados.`).
5. **Bandeja de Excepciones:** Cola izquierda de tickets observados + inspector derecho con tarjeta limpia `Datos detectados` (`DNI detectado`, `Fecha de vigencia detectada`, `Archivo analizado`, `Método de extracción`, `Confianza OCR: 99%`) y acordeón colapsado por defecto `Ver texto crudo OCR`. Al pulsar `Analizar con Gemini IA`, se visualizan simultáneamente el `LoadingButton` (`Analizando...`) y el `SmartProcessLoader` en tono indigo (`Analizando con Gemini IA` · `35%` · *"Conectando con Google Gemini IA..."*).
6. **Torre de Control SSOMA:** 3 pestañas limpias (`Avance y Habilitación`, `Registro Presencial y RV`, `Log Biométrico`), tabla con *soft pills* y botones suaves `Habilitar` / `Revocar` que requieren confirmación modal antes de ejecutarse.
7. **Integraciones EMO/SCTR:** Selector de trabajador + 4 tarjetas limpias (`CLINIC EMO`, `SCTR SALUD`, `SCTR PENSION`, `VIDA LEY`) + acordeón `Simulador / Sandbox de Webhooks Externos` (`Pruebas técnicas`) **colapsado por defecto**.
8. **Documentos por Estadía (Maestros):** Tabla maestra de 10 requisitos con filtros y badges `Sí`/`No`.

**Evaluación UX y puntos de fricción detectados:**
- **Fortalezas:** Drástica reducción de sobrecarga cognitiva en todas las vistas SSOMA; excelente visibilidad de estados de carga (`Skeleton`, `SmartProcessLoader`, `LoadingButton`); separación clara de herramientas de prueba (`Modo Demo`, `Sandbox de Webhooks`).
- **Fricciones detectadas:**
  1. **Integraciones EMO/SCTR (bug visual):** En la tarjeta `CLINIC EMO` con estado `APTO`, el texto positivo `"Ninguna restricción para trabajos en altura ni socavón."` se muestra dentro de una caja roja de alerta porque el campo `restrictions` no es nulo.
  2. **Gestión de Capacitaciones:** Los nombres de las 5 tarjetas de área se truncan con `...` a `1440×900` (`Interior Mina / S...`, `Planta Concentra...`), y falta pluralización condicional (`1 cursos`, `1 recursos`).
  3. **Seguimiento y Reportes:** En `1440×900` algunos chips (`En progreso`) y botones (`Constancia PDF`) se parten en 2 líneas dentro de la tabla; en estado vacío falta un botón rápido `Limpiar filtros` y deshabilitar los botones de exportación con `0` resultados.
  4. **Bandeja de Excepciones:** Los botones de dictamen final (`Validar y Aprobar Documento` / `Observar y Rechazar`) quedan ligeramente por debajo del pliegue a `1440×900` y se muestran códigos crudos (`AREA_MEDICA`) en lugar de `Área Médica`.
  5. **Panel de Control:** Diferencia leve de conteo entre el badge `Bandeja Excepciones (2)` en el sidebar (tickets abiertos) y el KPI `SEMÁFORO ÁMBAR (3)` (trabajadores en ámbar); además el título de la dona izquierda envuelve en 2 líneas desplazando ~20px la alineación respecto a la dona derecha.
  6. **Documentos por Estadía:** Vista heredada aún con breadcrumb duplicado y botones de icono sin `aria-label` visible.

---

## 3. Galería Indexada de Evidencia Visual (21 Capturas)

### 3.1. Vistas de Escritorio (`1440×900`) — Acceso y Rol SSOMA / DHO

| # | Rol / Estado | Descripción | Archivo |
| :---: | :--- | :--- | :--- |
| 01 | **General — Login** | Pantalla de inicio de sesión multi-rol con accesos rápidos 1-clic (`1440×900`). | [`01_desktop_login.png`](screenshots/01_desktop_login.png) |
| 02 | **SSOMA — Panel KPIs** | Dashboard ejecutivo sin barra demo fija, botón `Modo Demo` en header y punto verde discreto en sidebar. | [`02_desktop_ssoma_panel.png`](screenshots/02_desktop_ssoma_panel.png) |
| 03 | **Interactivo — Drawer Modo Demo** | Drawer lateral abierto agrupando cambio de rol y generadores OCR demo. | [`03_desktop_ssoma_demo_drawer.png`](screenshots/03_desktop_ssoma_demo_drawer.png) |
| 04 | **SSOMA — Gestión de Capacitaciones** | 5 tarjetas de Área como filtros clicables y catálogo a ancho completo. | [`04_desktop_ssoma_capacitaciones.png`](screenshots/04_desktop_ssoma_capacitaciones.png) |
| 05 | **Interactivo — Drawer "+ Nuevo Curso"** | Slide-over lateral abierto para alta/edición de cursos obligatorios por área. | [`05_desktop_ssoma_nuevo_curso_drawer.png`](screenshots/05_desktop_ssoma_nuevo_curso_drawer.png) |
| 06 | **SSOMA — Seguimiento y Reportes** | KPIs, barra de filtros, matriz de cumplimiento y acciones PDF/Excel. | [`06_desktop_ssoma_reportes.png`](screenshots/06_desktop_ssoma_reportes.png) |
| 07 | **Estado Vacío — Tabla Filtrada** | Búsqueda sin coincidencias (`NO_EXISTE_999`) con KPIs en `0` y mensaje controlado. | [`07_desktop_ssoma_reportes_empty_state.png`](screenshots/07_desktop_ssoma_reportes_empty_state.png) |
| 08 | **SSOMA — Bandeja de Excepciones** | Tarjeta limpia `Datos detectados` y acordeón `Ver texto crudo OCR` cerrado por defecto. | [`08_desktop_ssoma_excepciones.png`](screenshots/08_desktop_ssoma_excepciones.png) |
| 09 | **Carga — `SmartProcessLoader` + `LoadingButton`** | Ejecución en vivo de `Analizar con Gemini IA`: barra de progreso indigo (`35%`) y botón `Analizando...`. | [`09_desktop_loading_smart_loader_and_button.png`](screenshots/09_desktop_loading_smart_loader_and_button.png) |
| 10 | **Carga — `SkeletonCard` + `SkeletonTable` + `LoadingButton`** | Carga inicial de Seguimiento y Reportes mostrando 5 skeletons KPI, matriz skeleton 6×8 y botón `Filtrando...`. | [`10_desktop_loading_skeleton_reportes.png`](screenshots/10_desktop_loading_skeleton_reportes.png) |
| 11 | **SSOMA — Torre de Control** | Vista separada en 3 pestañas limpias con *soft pills* y botones suaves `Habilitar`/`Revocar`. | [`11_desktop_ssoma_torre_control.png`](screenshots/11_desktop_ssoma_torre_control.png) |
| 12 | **SSOMA — Integraciones EMO/SCTR** | 4 tarjetas de proveedores y acordeón `Simulador / Sandbox de Webhooks Externos` cerrado por defecto. | [`12_desktop_ssoma_integraciones.png`](screenshots/12_desktop_ssoma_integraciones.png) |
| 13 | **SSOMA — Documentos por Estadía** | Tabla maestra de requisitos documentales por tipo de estadía y puesto. | [`13_desktop_ssoma_maestros_estadia.png`](screenshots/13_desktop_ssoma_maestros_estadia.png) |

### 3.2. Vistas de Escritorio (`1440×900`) — Admin ECM, Trabajador y Garita

| # | Rol / Estado | Descripción | Archivo |
| :---: | :--- | :--- | :--- |
| 14 | **Admin ECM — Afiliados** | Padrón izquierdo + Stepper horizontal unificado de 2 pasos + selector de Área de ingreso. | [`14_desktop_ecm_afiliados_stepper.png`](screenshots/14_desktop_ecm_afiliados_stepper.png) |
| 15 | **Interactivo — Modal Perfil CV** | Modal split-pane con etiquetas visibles sobre cada input en Formación y Experiencia Minera + botón Gemini IA. | [`15_desktop_ecm_modal_cv.png`](screenshots/15_desktop_ecm_modal_cv.png) |
| 16 | **Trabajador — Portal Aislado** | Vista sin sidebar ni QR con progreso, `Estado de Habilitación` y bloques Etapa 1 / Etapa 2. | [`16_desktop_trabajador_portal.png`](screenshots/16_desktop_trabajador_portal.png) |
| 17 | **Garita — Control de Acceso (Habilitado)** | Vista sin sidebar ni QR con buscador DNI y tarjeta verde `HABILITADO PARA INGRESO` (`DNI 72702372`). | [`17_desktop_garita_portal.png`](screenshots/17_desktop_garita_portal.png) |
| 21 | **Error Controlado — Garita DNI Inexistente** | Consulta de DNI no registrado (`99999999`) con tarjeta de denegación controlada y botón `Nueva consulta`. | [`21_desktop_garita_error_dni.png`](screenshots/21_desktop_garita_error_dni.png) |

### 3.3. Vistas Móviles (`390×844`)

| # | Rol / Estado | Descripción | Archivo |
| :---: | :--- | :--- | :--- |
| 18 | **Móvil — Login (`390×844`)** | Tarjeta centrada sin scroll ni desbordamiento horizontal; accesos rápidos en grilla 2×2. | [`18_mobile_login.png`](screenshots/18_mobile_login.png) |
| 19 | **Móvil — Portal del Trabajador (`390×844`)** | Apilamiento en 1 columna limpia sin overflow horizontal ni sidebar. | [`19_mobile_trabajador_portal.png`](screenshots/19_mobile_trabajador_portal.png) |
| 20 | **Móvil — Garita (`390×844`)** | Buscador prominente de DNI y tarjetas de estado en 1 columna sin sidebar ni QR. | [`20_mobile_garita_portal.png`](screenshots/20_mobile_garita_portal.png) |

#### Muestra visual incrustada

![01 Login Escritorio](screenshots/01_desktop_login.png)
![02 SSOMA Panel](screenshots/02_desktop_ssoma_panel.png)
![03 Drawer Modo Demo](screenshots/03_desktop_ssoma_demo_drawer.png)
![04 Gestión de Capacitaciones](screenshots/04_desktop_ssoma_capacitaciones.png)
![05 Drawer Nuevo Curso](screenshots/05_desktop_ssoma_nuevo_curso_drawer.png)
![06 Seguimiento y Reportes](screenshots/06_desktop_ssoma_reportes.png)
![07 Reportes Estado Vacío](screenshots/07_desktop_ssoma_reportes_empty_state.png)
![08 Bandeja de Excepciones](screenshots/08_desktop_ssoma_excepciones.png)
![09 SmartProcessLoader y LoadingButton](screenshots/09_desktop_loading_smart_loader_and_button.png)
![10 SkeletonCard y SkeletonTable](screenshots/10_desktop_loading_skeleton_reportes.png)
![11 Torre de Control SSOMA](screenshots/11_desktop_ssoma_torre_control.png)
![12 Integraciones EMO/SCTR](screenshots/12_desktop_ssoma_integraciones.png)
![13 Maestros Documentos por Estadía](screenshots/13_desktop_ssoma_maestros_estadia.png)
![14 Admin ECM Afiliados Stepper](screenshots/14_desktop_ecm_afiliados_stepper.png)
![15 Modal Perfil CV Estructurado](screenshots/15_desktop_ecm_modal_cv.png)
![16 Portal del Trabajador Escritorio](screenshots/16_desktop_trabajador_portal.png)
![17 Garita Escritorio Habilitado](screenshots/17_desktop_garita_portal.png)
![21 Garita Error DNI Inexistente](screenshots/21_desktop_garita_error_dni.png)
![18 Login Móvil](screenshots/18_mobile_login.png)
![19 Portal del Trabajador Móvil](screenshots/19_mobile_trabajador_portal.png)
![20 Garita Móvil](screenshots/20_mobile_garita_portal.png)

---

## 4. Mapa Técnico de Archivos UI Modificados

| Capa / Vista | Ruta Exacta en el Repositorio | Responsabilidad y Cambios del Rediseño |
| :--- | :--- | :--- |
| **Estilos y Tokens Globales** | `packages/frontend/src/index.css` | Tokens CSS (`--bateas-bg: #F8FAFC`, `--bateas-surface: #FFFFFF`, `--bateas-border: #E2E8F0`), animaciones `@keyframes` (`bateas-shimmer`, `bateas-top-progress`, `bateas-scan-beam`, `bateas-slide-in-right`, `bateas-fade-in`, `bateas-check-pop`) y regla `prefers-reduced-motion`. |
| **Componentes de Carga UI** | `packages/frontend/src/components/ui/LoadingStates.tsx` | Módulo reutilizable nuevo: `TopProgressBar`, `SkeletonCard`, `SkeletonTable`, `SmartProcessLoader` y `LoadingButton`. |
| **Drawer Modo Demo** | `packages/frontend/src/components/ui/DemoModeDrawer.tsx` | Componente nuevo slide-over que encapsula el selector de vista por rol y los 4 generadores OCR demo fuera del flujo diario. |
| **Shell Global, Login, ECM Afiliados, Excepciones y Maestros** | `packages/frontend/src/App.tsx` | Layout global limpio, header con botón `Modo Demo`, telemetría discreta en sidebar, Stepper horizontal de 2 pasos en Afiliados, tarjeta `Datos detectados` + acordeón OCR + Gemini `SmartProcessLoader` en Excepciones, montaje sin sidebar de `GaritaAccessPortal` y `WorkerPortal`. |
| **Control de Acceso (Garita)** | `packages/frontend/src/components/GaritaAccessPortal.tsx` | Vista dedicada sin sidebar (`standalone`), buscador DNI 8 dígitos con `autoFocus`, tarjetas de resultado sin QR, filtros suaves y `LoadingButton`. |
| **Portal del Trabajador** | `packages/frontend/src/components/WorkerPortal.tsx` | Portal aislado minimalista sin sidebar ni QR; integración de `TopProgressBar`, `SkeletonCard`, `SmartProcessLoader` y `LoadingButton`. |
| **Modal Perfil CV Estructurado** | `packages/frontend/src/components/WorkerCvProfileModal.tsx` | Etiquetas `<label>` visibles sobre cada input en las 6 secciones, `SkeletonCard` de carga inicial, `SmartProcessLoader` (`cv_autofill`/`ocr`) y `LoadingButton`. |
| **SSOMA — Gestión de Capacitaciones** | `packages/frontend/src/components/CourseManagementPanel.tsx` | 5 tarjetas de Área clicables, traslado de `+ Nuevo Curso`/`Editar` a Slide-over Drawer lateral, catálogo ancho completo, `SkeletonCard`, `SmartProcessLoader` (`sync`) y `LoadingButton`. |
| **SSOMA — Seguimiento y Reportes** | `packages/frontend/src/components/TrackingReportsPanel.tsx` | `SkeletonCard` para KPIs, `SkeletonTable` para matriz, `LoadingButton` en exportaciones Excel/PDF y Constancia PDF por fila, *soft pills*. |
| **SSOMA — Torre de Control e Integraciones** | `packages/frontend/src/components/SsomaControlPanels.tsx` | Torre de Control en 3 pestañas limpias + modal de confirmación auditado para Habilitar/Revocar; Integraciones con 4 tarjetas limpias y acordeón Sandbox cerrado por defecto. |

---

## 5. Pendientes y Limitaciones Detectadas en Pruebas Visuales (Escritorio y Móvil)

Las pruebas en navegador real (`1440×900` y `390×844`) confirmaron que los 4 flujos principales operan sin errores de consola ni regresiones funcionales, pero identificaron mejoras concretas recomendadas para una iteración de pulido final (*Quick Wins*):

| Prioridad | Vista / Plataforma | Hallazgo Detectado en Prueba Real | Acción Recomendada |
| :---: | :--- | :--- | :--- |
| **Alta** | Garita / Backend (`21_desktop_garita_error_dni.png`) | Al consultar un DNI inexistente (`99999999`), el mensaje del backend aún menciona *"No existe credencial QR ni trabajador afiliado..."* y la tarjeta muestra el badge ámbar `PENDIENTE DE HABILITACIÓN`. | Limpiar la palabra `"QR"` del endpoint `/api/v1/badges/verify/:code` y renderizar un badge rojo `NO REGISTRADO` cuando `worker === null`. |
| **Alta** | Integraciones EMO/SCTR (`12_desktop_ssoma_integraciones.png`) | La tarjeta `CLINIC EMO` en estado `APTO` renderiza el texto positivo *"Ninguna restricción para trabajos en altura ni socavón."* en una caja de alerta roja (`bg-rose-50`). | Aplicar estilo rojo únicamente cuando el estado sea `NO_APTO` o `APTO_CON_RESTRICCIONES`; usar tono `slate` neutro para notas informativas en `APTO`. |
| **Media** | Capacitaciones y Afiliados ECM (`04_`, `14_`) | Truncamiento con `...` en los títulos de las 5 tarjetas de área (`Interior Mina / S...`) y en los pasos del Stepper (`Paso 1 · Prime...`, `Paso 2 · Habili...`) incluso a `1440px`. | Permitir `line-clamp-2` (2 líneas) en lugar de `truncate` en tarjetas de área y abreviar/apilar el badge en el Stepper. |
| **Media** | Afiliados ECM (`14_desktop_ecm_afiliados_stepper.png`) | El badge verde `Habilitada` en el Paso 2 puede confundirse con el estado global cuando el trabajador está `Bloqueado` por un documento vencido de la Etapa 2. | Cambiar la etiqueta del Paso 2 a `Desbloqueada` (en tono neutro `slate`) o mostrar `Observada / Pendiente` según sus documentos. |
| **Media** | Seguimiento y Reportes (`06_`, `07_`) | `En progreso`, `Constancia PDF` y `HORAS (V / P)` se parten en 2 líneas en la tabla; el estado vacío no tiene botón `Limpiar filtros` y mantiene habilitados los botones de exportación. | Añadir `whitespace-nowrap` en pills/botones de tabla, deshabilitar exportación cuando `rows.length === 0` e incluir botón `Limpiar filtros`. |
| **Media** | Garita Autorizado (`17_desktop_garita_portal.png`) | El texto de autorización expone el enum interno `Fotocheck PVC: QUEUED_GARITA.` y los contadores dicen `1 Habilitados`. | Mapear `QUEUED_GARITA` → *"En cola de impresión"* y corregir pluralización condicional (`1 Habilitado` / `1 curso`). |
| **Baja** | Móvil `390×844` (`18_`, `19_`, `20_`) | Cero overflow horizontal, pero: (1) el placeholder del input DNI en Garita se corta en `"Ingresa el DNI de 8 dígitos ("`; (2) `Cerrar sesión` envuelve en 2 líneas en el header móvil; (3) `Trabajador (Bio + RV)` hace salto huérfano en Login móvil; (4) botones secundarios miden `28px–38px` de alto. | Acortar placeholder a `"DNI de 8 dígitos (ej. 72702372)"`, usar `Salir` compacto en `< sm`, ajustar altura mínima `min-h-[44px]` en botones táctiles móviles. |
| **Baja** | Accesibilidad / Enums crudos (`05_`, `08_`, `13_`, `15_`) | El drawer `+ Nuevo Curso` carece de `role="dialog" aria-modal="true"`; el icono borrar de sección 2 del Modal CV y los iconos de Maestros carecen de `aria-label`; enums como `AREA_MEDICA` y `PERMANENTE_CIA` se muestran sin formatear. | Añadir atributos ARIA consistentes y un diccionario de etiquetas legibles para áreas y tipos de estadía. |
