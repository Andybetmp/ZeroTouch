# Spec 05 — Especificación Frontend Web Corporativo, Portal del Trabajador y Estado de Habilitación (SDD — v3.0)

## 1. Arquitectura Visual y Separación de Interfaces (RBAC)

El frontend en **React 19 + TypeScript + Tailwind CSS v4 + Lucide Icons** ofrece dos experiencias completamente diferenciadas según el rol autenticado:

1. **Consola Administrativa (`SSOMA`, `ECM`, `GARITA`) — Layout App Bateas v2.1.0 (`#222d32`)**:
   - Barra lateral izquierda fija con navegación a:
     - `Inicio` (Acceso directo y Panel de Control KPIs AS-IS vs. TO-BE)
     - `Afiliaciones` → `Afiliados (Motor OCR + Perfil CV Estructurado + Selector de Área)`, `Bandeja Excepciones Split-Screen`, `Inducciones E-Learning`, `Documentos por estadía`, `Lista negra`
     - `Estado de Habilitación` (Consulta directa por DNI y Área de Ingreso, sin códigos QR)
     - `Torre SSOMA` → `Torre Control / Bio`, `Gestión de Capacitaciones` (asociación automática por Área de Ingreso), `Seguimiento y Reportes` (Exportación Excel `.xlsx`, PDF Corporativo y Constancia PDF sin QR) e `Integraciones EMO/SCTR`.
2. **Portal Aislado del Trabajador (`TRABAJADOR` → `/portal-trabajador`)**:
   - Layout limpio **sin sidebar administrativo**, protegido con `ProtectedRoute` contra acceso directo a rutas de administración.

---

## 2. Cambios Clave de Diseño y UX (Versión 3.0)

### 2.1. Eliminación Total de Códigos QR → Tarjeta Simple "Estado de Habilitación"
- Se eliminaron todos los componentes `QRCodeSVG`, botones de escaneo/descarga de QR y pantallas de "Pase de Garita QR" en el Portal del Trabajador, la vista de Control de Acceso (`garita@bateas.pe`), Afiliados, Torre de Control y Constancias PDF.
- En su lugar se muestra una tarjeta clara de **Estado de Habilitación** (`Habilitado` en verde suave / `Pendiente` en ámbar suave) asociada directamente al **DNI del trabajador** y al **Área de Ingreso** asignada.

### 2.2. Asignación Automática de Cursos por Área de Ingreso
- **En Afiliados (`SSOMA` / `ECM`)**: Tanto el modal de registro de trabajador como la cabecera del expediente incluyen el selector **Área de Ingreso** (*Interior Mina / Socavón*, *Planta Concentradora*, *Superficie / Talleres*, *Oficinas Administrativas*). Al guardar o cambiar el área, se cargan automáticamente los cursos obligatorios correspondientes.
- **En Gestión de Capacitaciones (`SSOMA`)**: Panel simplificado con tarjetas resumen por área y un selector de Área de Ingreso por curso (`Etapa 1: Inducción General` o un área específica de `Etapa 2`), con sincronización automática hacia los trabajadores.
- **En Portal del Trabajador**: No existe ninguna pantalla ni botón de inscripción manual; el trabajador recibe su malla 100% asignada según su área.

### 2.3. Portal del Trabajador Limpio, Amigable y Ordenado (`WorkerPortal.tsx`)
- **Encabezado resumido:** Tarjeta principal con nombre, DNI, empresa contratista, etiqueta de área asignada y barra de progreso simple (`"X de Y cursos completados"` + porcentaje), acompañada de la tarjeta **Estado de Habilitación** (sin QR).
- **Organización en 2 bloques claros:**
  - **Etapa 1: Inducción General**
  - **Etapa 2: Capacitación Específica del Área**
- **Tarjetas minimalistas:** Espaciado generoso (`gap-5`, `p-6`, `rounded-2xl`) mostrando únicamente:
  1. Título del curso
  2. Duración en horas (`Clock`)
  3. Modalidad (`E-learning` o `Presencial`)
  4. Etiqueta de estado en color suave (`Completado`, `En curso`, `Pendiente`)
  5. Un único botón principal (`Iniciar` o `Continuar`) que abre el visor de contenido y evaluación en un modal enfocado.
