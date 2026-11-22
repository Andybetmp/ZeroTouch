"""Bateas Onboarding 360 — prototipo demostrativo, equipo MYOPIA.

Solo usar archivos y datos de prueba. No es una herramienta de aprobación oficial.
"""
import hashlib
import json
import sqlite3
import re
from pathlib import Path
from datetime import date, datetime, timedelta

import pymupdf
import pandas as pd
import streamlit as st
from rapidocr import RapidOCR


st.set_page_config(
    page_title="Bateas Onboarding 360",
    page_icon="⛏️",
    layout="wide",
)

if "trabajadores" not in st.session_state:
    st.session_state.trabajadores = []
if "documentos" not in st.session_state:
    st.session_state.documentos = {}
if "aprobaciones" not in st.session_state:
    st.session_state.aprobaciones = {}
if "capacitaciones" not in st.session_state:
    st.session_state.capacitaciones = {}


# PASO 12: base de datos LOCAL SQLite para expedientes de DEMOSTRACIÓN.
# Mantener solo documentos ficticios: los PDF/imágenes se almacenan sin cifrar.
DB_PATH = Path(__file__).resolve().parent / "bateas_demo.sqlite3"


def inicializar_base():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS trabajadores (
                indice INTEGER PRIMARY KEY,
                datos_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS documentos (
                indice INTEGER NOT NULL,
                requisito TEXT NOT NULL,
                nombre TEXT NOT NULL,
                datos BLOB NOT NULL,
                huella TEXT,
                texto TEXT,
                metodo TEXT,
                estado TEXT,
                fecha TEXT,
                PRIMARY KEY (indice, requisito),
                FOREIGN KEY (indice) REFERENCES trabajadores(indice) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS aprobaciones (
                indice INTEGER PRIMARY KEY,
                datos_json TEXT NOT NULL,
                FOREIGN KEY (indice) REFERENCES trabajadores(indice) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS capacitaciones (
                indice INTEGER PRIMARY KEY,
                datos_json TEXT NOT NULL,
                FOREIGN KEY (indice) REFERENCES trabajadores(indice) ON DELETE CASCADE
            );
        """)


def cargar_estado_local():
    """Reconstruye las estructuras en memoria a partir de SQLite."""
    with sqlite3.connect(DB_PATH) as conn:
        st.session_state.trabajadores = [
            json.loads(fila[0])
            for fila in conn.execute(
                "SELECT datos_json FROM trabajadores ORDER BY indice"
            )
        ]
        docs = {}
        for indice, requisito, nombre, datos, huella, texto, metodo, estado, fecha in conn.execute(
            "SELECT indice, requisito, nombre, datos, huella, texto, metodo, estado, fecha FROM documentos"
        ):
            docs.setdefault(indice, {})[requisito] = {
                "nombre": nombre,
                "datos": datos,
                "huella": huella,
                "texto": texto,
                "metodo": metodo,
                "estado": estado,
                "fecha": date.fromisoformat(fecha) if fecha else None,
            }
        st.session_state.documentos = docs
        st.session_state.aprobaciones = {
            indice: json.loads(datos_json)
            for indice, datos_json in conn.execute("SELECT indice, datos_json FROM aprobaciones")
        }
        st.session_state.capacitaciones = {
            indice: json.loads(datos_json)
            for indice, datos_json in conn.execute("SELECT indice, datos_json FROM capacitaciones")
        }


def guardar_estado_local():
    """Guarda una instantánea consistente. Adecuado para un usuario local de prueba."""
    trabajadores = st.session_state.trabajadores
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        # Se reemplazan todas las filas en UNA transacción; no altera el esquema.
        for tabla in ("documentos", "aprobaciones", "capacitaciones", "trabajadores"):
            conn.execute(f"DELETE FROM {tabla}")
        for indice, trabajador in enumerate(trabajadores):
            conn.execute(
                "INSERT INTO trabajadores(indice, datos_json) VALUES (?, ?)",
                (indice, json.dumps(trabajador, ensure_ascii=False)),
            )
        for indice, grupo in st.session_state.documentos.items():
            for requisito, registro in grupo.items():
                fecha = registro.get("fecha")
                conn.execute(
                    """INSERT INTO documentos
                    (indice, requisito, nombre, datos, huella, texto, metodo, estado, fecha)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (indice, requisito, registro.get("nombre", ""),
                     registro.get("datos", b""), registro.get("huella"),
                     registro.get("texto"), registro.get("metodo"),
                     registro.get("estado"), fecha.isoformat() if fecha else None),
                )
        for indice, estado in st.session_state.aprobaciones.items():
            conn.execute(
                "INSERT INTO aprobaciones(indice, datos_json) VALUES (?, ?)",
                (indice, json.dumps(estado, ensure_ascii=False)),
            )
        for indice, estado in st.session_state.capacitaciones.items():
            conn.execute(
                "INSERT INTO capacitaciones(indice, datos_json) VALUES (?, ?)",
                (indice, json.dumps(estado, ensure_ascii=False)),
            )


def recargar_con_guardado():
    """Guarda antes de forzar una recarga de Streamlit."""
    guardar_estado_local()
    st.rerun()


# Ambas vistas consultan la misma base en cada interacción.
# Esto evita que un portal vea datos viejos al cambiar de pestaña.
# Se trata de un MVP local para demostración; no es un backend concurrente seguro.
inicializar_base()
cargar_estado_local()


REQUISITOS = {
    "Contratista permanente": [
        "DNI", "SCTR salud y pensión", "EMO", "CV documentado",
        "Perfil de puesto aprobado", "ISEM - Anexo 4",
    ],
    "Contratista temporal": [
        "DNI", "SCTR", "EMO", "CV", "Perfil de puesto aprobado",
    ],
    "Visita técnica": ["DNI", "SCTR", "EMO"],
    "Visita comercial": ["DNI", "SCTR", "EMO"],
}

# Reglas de DEMOSTRACIÓN. No equivalen a requisitos oficiales de validación.
DOCUMENTOS_CON_VIGENCIA = {
    "SCTR salud y pensión", "SCTR", "EMO", "ISEM - Anexo 4",
    "Certificado de habilidad vigente", "Licencia de conducir",
    "Carné de sanidad",
}


def obtener_requisitos(trabajador):
    requisitos = REQUISITOS[trabajador["Modalidad"]].copy()
    if trabajador["Modalidad"] == "Contratista permanente":
        extras = {
            "Conductor": ["Licencia de conducir", "Récord de conductor"],
            "Ingeniero": ["Certificado de habilidad vigente"],
            "Personal de cocina": ["Carné de sanidad"],
        }
        requisitos.extend(extras.get(trabajador["Puesto"], []))
    return requisitos


@st.cache_resource
def cargar_lector_ocr():
    # Se inicializa solo al analizar una imagen o PDF escaneado.
    return RapidOCR()


def leer_imagen(datos):
    resultado = cargar_lector_ocr()(datos)
    if resultado is not None and resultado.txts:
        return "\n".join(resultado.txts)
    return ""


def extraer_texto(nombre, datos):
    """Devuelve texto y método. Límite deliberado: primeras 3 páginas PDF."""
    if nombre.lower().endswith(".pdf"):
        fragmentos = []
        metodos = []
        with pymupdf.open(stream=datos, filetype="pdf") as archivo_pdf:
            for numero, pagina in enumerate(archivo_pdf):
                if numero >= 3:
                    break
                texto = pagina.get_text("text").strip()
                if len(texto) < 25:
                    imagen = pagina.get_pixmap(dpi=170, alpha=False).tobytes("png")
                    texto = leer_imagen(imagen)
                    metodo = "OCR de página escaneada"
                else:
                    metodo = "Extracción de texto PDF"
                fragmentos.append(f"PÁGINA {numero + 1}\n{texto}")
                metodos.append(metodo)
        return "\n\n".join(fragmentos), ", ".join(sorted(set(metodos)))
    return leer_imagen(datos), "OCR de imagen"


def detectar_vencimiento(texto):
    """Retorna (fecha, estado); no valida autenticidad ni identidad."""
    patron = (
        r"(?:fecha\s+(?:de\s+)?vencimiento|vencimiento|"
        r"vigencia\s+hasta|v[aá]lido\s+hasta)"
        r"\s*[:\-]?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{4})"
    )
    encontrado = re.search(patron, texto, re.IGNORECASE)
    if not encontrado:
        return None, "No se encontró fecha de vencimiento"
    fecha_cadena = re.sub(r"[.\-]", "/", encontrado.group(1))
    try:
        fecha = datetime.strptime(fecha_cadena, "%d/%m/%Y").date()
    except ValueError:
        return None, "La fecha reconocida no es válida"
    return fecha, "Vencido" if fecha < date.today() else "Dentro de vigencia"


def seleccionar_trabajador(mensaje="Seleccionar trabajador"):
    return st.selectbox(
        mensaje,
        range(len(st.session_state.trabajadores)),
        format_func=lambda i: (
            f"#{i + 1} - {st.session_state.trabajadores[i]['Nombre']} "
            f"({st.session_state.trabajadores[i]['Empresa']})"
        ),
    )



# En la primera versión solo simulamos la secuencia indicada para
# contratistas permanentes. El resto de modalidades tiene procesos distintos.
ROLES_APROBACION = ["Área usuaria", "SSOMA", "Médico Ocupacional", "DHO"]


def estado_aprobacion(indice):
    return st.session_state.aprobaciones.setdefault(
        indice,
        {"paso": 0, "estado": "Pendiente", "historial": [], "observacion": None},
    )


def registrar_evento(indice, accion, area, comentario):
    flujo = estado_aprobacion(indice)
    flujo["historial"].append({
        "Fecha y hora": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "Área": area,
        "Acción": accion,
        "Comentario": comentario or "Sin comentarios",
    })


def reiniciar_aprobaciones_si_corresponde(indice):
    """Una modificación documental invalida decisiones anteriores (demo)."""
    if indice not in st.session_state.aprobaciones:
        return
    flujo = estado_aprobacion(indice)
    if flujo["paso"] > 0 or flujo["estado"] != "Pendiente":
        registrar_evento(
            indice, "Reinicio del flujo", "Sistema",
            "Un documento cambió; se requiere revisar nuevamente el expediente.",
        )
        flujo["paso"] = 0
        flujo["estado"] = "Pendiente"
        flujo["observacion"] = None


def evaluar_expediente_para_aprobaciones(indice):
    """Requisitos mínimos del prototipo; NO valida autenticidad ni aptitud."""
    trabajador = st.session_state.trabajadores[indice]
    requisitos = obtener_requisitos(trabajador)
    cargados = st.session_state.documentos.get(indice, {})
    dificultades = []
    for doc in requisitos:
        registro = cargados.get(doc)
        if registro is None:
            dificultades.append(f"{doc}: falta cargar")
        elif registro.get("estado") == "Cargado sin analizar":
            dificultades.append(f"{doc}: falta analizar")
        elif registro.get("estado") in {"Vencido", "Requiere revisión"}:
            dificultades.append(f"{doc}: {registro['estado'].lower()}")
        elif registro.get("estado") not in {
            "Dentro de vigencia", "Texto leído (sin regla de vigencia)"
        }:
            dificultades.append(f"{doc}: sin prevalidación satisfactoria")
    return dificultades


def pdf_demo(nombre_doc, con_vencimiento=False):
    """Crea un PDF ficticio legible sin documentos personales reales."""
    vencimiento = (date.today() + timedelta(days=180)).strftime("%d/%m/%Y")
    pdf = pymupdf.open()
    pagina = pdf.new_page()
    lineas = [
        "DOCUMENTO SIMULADO - SIN VALIDEZ LEGAL",
        "BATEAS ONBOARDING 360 - EQUIPO MYOPIA",
        f"Documento: {nombre_doc}",
        "Trabajador: TRABAJADOR DE PRUEBA",
        "Empresa: CONTRATISTA DEMO S.A.C.",
        "Documento generado solo para demostrar un proceso.",
    ]
    if con_vencimiento:
        lineas.append(f"Fecha de vencimiento: {vencimiento}")
    for i, linea in enumerate(lineas):
        pagina.insert_text((65, 85 + i * 27), linea, fontsize=11)
    datos = pdf.tobytes()
    pdf.close()
    return datos


def crear_caso_demo_aprobaciones():
    """Genera un caso nuevo y le aplica el lector REAL de PDF de texto."""
    trabajador = {
        "Nombre": "TRABAJADOR DEMO (FICTICIO)",
        "Empresa": "CONTRATISTA DEMO S.A.C.",
        "Puesto": "Operario",
        "Modalidad": "Contratista permanente",
        "Acceso": "Superficie",
        "Estado": "Pendiente de aprobaciones (simulación)",
    }
    indice = len(st.session_state.trabajadores)
    st.session_state.trabajadores.append(trabajador)
    cargados = {}
    for documento in obtener_requisitos(trabajador):
        datos = pdf_demo(documento, documento in DOCUMENTOS_CON_VIGENCIA)
        texto, metodo = extraer_texto("demo.pdf", datos)
        if documento in DOCUMENTOS_CON_VIGENCIA:
            fecha, estado = detectar_vencimiento(texto)
        else:
            fecha, estado = None, "Texto leído (sin regla de vigencia)"
        cargados[documento] = {
            "nombre": f"DEMO_{len(cargados)+1}.pdf",
            "datos": datos,
            "huella": hashlib.sha256(datos).hexdigest(),
            "texto": texto,
            "metodo": metodo + " (PDF ficticio generado para prueba)",
            "estado": estado,
            "fecha": fecha,
        }
    st.session_state.documentos[indice] = cargados
    estado_aprobacion(indice)
    return indice

# Módulo 10: formación virtual exclusivamente DEMOSTRATIVA.
# En ninguna circunstancia concede un permiso de ingreso a la unidad minera.
PREGUNTAS_DEMO = [
    {
        "pregunta": "Antes de ingresar a una zona restringida, ¿qué corresponde hacer?",
        "opciones": [
            "Ingresar si otro trabajador ya entró",
            "Confirmar la autorización y seguir el control de acceso",
            "Ingresar si el trabajo es urgente",
        ],
        "correcta": 1,
    },
    {
        "pregunta": "Si observas una condición insegura, ¿cuál es la respuesta apropiada?",
        "opciones": [
            "Continuar para terminar más rápido",
            "Esperar al final del turno para informarla",
            "Detener la actividad cuando sea necesario y avisar al responsable",
        ],
        "correcta": 2,
    },
    {
        "pregunta": "¿Cómo se deben gestionar los residuos durante el trabajo?",
        "opciones": [
            "Segregarlos y disponerlos en los puntos autorizados",
            "Dejarlos junto al lugar de trabajo",
            "Mezclarlos todos para reducir el tiempo",
        ],
        "correcta": 0,
    },
    {
        "pregunta": "¿Qué criterio debe seguirse para usar equipos de protección personal?",
        "opciones": [
            "Utilizarlos solo si un compañero los utiliza",
            "Seleccionarlos y usarlos según los riesgos y procedimientos aplicables",
            "Elegir siempre el equipo más ligero, sin importar la tarea",
        ],
        "correcta": 1,
    },
]


def estado_curso(indice):
    return st.session_state.capacitaciones.setdefault(
        indice,
        {"material_revisado": False, "aprobado": False, "intentos": [], "ultima_nota": None},
    )


def constancia_demostrativa(indice, estado):
    trabajador = st.session_state.trabajadores[indice]
    resultado = next(
        (intento for intento in reversed(estado["intentos"]) if intento["Aciertos"] >= 3),
        estado["intentos"][-1],
    )
    return ("BATEAS ONBOARDING 360 | EQUIPO MYOPIA\n"
            "CONSTANCIA DE SIMULACION - NO VALIDA PARA INGRESO NI CAPACITACION OFICIAL\n"
            "===========================================================\n"
            f"Trabajador ficticio: {trabajador['Nombre']}\n"
            f"Empresa ficticia: {trabajador['Empresa']}\n"
            "Actividad: modulo teorico demostrativo de seguridad y medio ambiente\n"
            f"Resultado: {resultado['Resultado']}\n"
            f"Respuestas correctas: {resultado['Aciertos']}/{len(PREGUNTAS_DEMO)}\n"
            f"Fecha y hora de la simulacion: {resultado['Fecha y hora']}\n\n"
            "Este documento solo acredita la ejecucion de una prueba de software.\n"
            "No sustituye inducciones, Anexo 5, evaluaciones, ni autorizaciones de Bateas.\n")



# Paso 11: resumen de expedientes para uso exclusivo de demostración.
# No incluye archivos ni autoriza ingresos. Calcula los estados desde la sesión actual.
def construir_reporte():
    filas = []
    for indice, trabajador in enumerate(st.session_state.trabajadores):
        requisitos = obtener_requisitos(trabajador)
        cargados = st.session_state.documentos.get(indice, {})
        faltantes = [doc for doc in requisitos if doc not in cargados]
        observados = [
            doc for doc in requisitos
            if doc in cargados and cargados[doc].get("estado") in {"Vencido", "Requiere revisión"}
        ]
        sin_analizar = [
            doc for doc in requisitos
            if doc in cargados and cargados[doc].get("estado") == "Cargado sin analizar"
        ]
        otros_sin_validar = [
            doc for doc in requisitos if doc in cargados
            and cargados[doc].get("estado") not in {
                "Vencido", "Requiere revisión", "Cargado sin analizar",
                "Dentro de vigencia", "Texto leído (sin regla de vigencia)",
            }
        ]
        if observados:
            estado_documental = "Con observaciones"
        elif faltantes:
            estado_documental = "Faltan documentos"
        elif sin_analizar or otros_sin_validar:
            estado_documental = "Pendiente de análisis"
        else:
            estado_documental = "Prevalidación de prueba completa"

        if trabajador["Modalidad"] == "Contratista permanente":
            flujo = st.session_state.aprobaciones.get(indice)
            if flujo is None:
                estado_flujo = "Sin iniciar"
            elif flujo.get("estado") == "Completado":
                estado_flujo = "4/4 revisiones simuladas"
            elif flujo.get("estado") == "Observado":
                estado_flujo = "Observado (simulación)"
            else:
                paso = min(int(flujo.get("paso", 0)), len(ROLES_APROBACION))
                estado_flujo = f"{paso}/4 revisiones simuladas"

            curso = st.session_state.capacitaciones.get(indice)
            if not curso:
                estado_curso_texto = "Sin iniciar"
            elif curso.get("aprobado"):
                estado_curso_texto = "Superado (simulación)"
            elif curso.get("intentos"):
                estado_curso_texto = "Por mejorar (simulación)"
            elif curso.get("material_revisado"):
                estado_curso_texto = "Material revisado"
            else:
                estado_curso_texto = "Sin iniciar"
        else:
            estado_flujo = "No desarrollado para esta modalidad"
            estado_curso_texto = "No desarrollado para esta modalidad"

        filas.append({
            "N.º": indice + 1,
            "Trabajador": trabajador["Nombre"],
            "Empresa": trabajador["Empresa"],
            "Puesto": trabajador["Puesto"],
            "Modalidad": trabajador["Modalidad"],
            "Acceso": trabajador["Acceso"],
            "Documentos cargados": f"{len(requisitos) - len(faltantes)}/{len(requisitos)}",
            "Documentos faltantes": len(faltantes),
            "Documentos observados": len(observados),
            "Pendientes de análisis": len(sin_analizar) + len(otros_sin_validar),
            "Prevalidación": estado_documental,
            "Aprobaciones": estado_flujo,
            "Curso": estado_curso_texto,
            "Habilitación real": "No determinada por este prototipo",
            "Tipo de datos": "Demostración ficticia",
        })
    return filas

# PASO 14. Dos portales con rutas distintas, conectados a una sola base local.
# No hay autenticación ni control de acceso real. Usar solo datos ficticios.
portal = st.query_params.get("portal", "contratista")
if portal not in {"contratista", "revisor"}:
    portal = "contratista"

st.sidebar.title("⛏️ Bateas Onboarding 360")
st.sidebar.caption("Equipo MYOPIA · Prototipo")
st.sidebar.markdown("### Acceso de demostración")
if st.sidebar.button("👷 Portal contratista", use_container_width=True,
                     type="primary" if portal == "contratista" else "secondary"):
    st.query_params["portal"] = "contratista"
    st.rerun()
if st.sidebar.button("🛡️ Portal de revisores", use_container_width=True,
                     type="primary" if portal == "revisor" else "secondary"):
    st.query_params["portal"] = "revisor"
    st.rerun()

if portal == "contratista":
    st.sidebar.caption("Área de la empresa contratista / trabajador")
    opciones_menu = {
        "🏠 Mi panel": "🏠 Panel principal",
        "👷 Registro de trabajadores": "👷 Registro de trabajadores",
        "📄 Mis documentos": "📄 Validación de documentos",
        "📚 Mis capacitaciones": "📚 Capacitaciones",
        "📬 Estado de solicitud": "📬 Estado de solicitud",
    }
else:
    st.sidebar.caption("Área interna de Minera Bateas (simulación)")
    rol_revisor = st.sidebar.selectbox("Área con la que deseas revisar", ROLES_APROBACION)
    opciones_menu = {
        "🏛️ Panel de revisores": "🏛️ Panel de revisores",
        "📂 Expedientes recibidos": "📂 Expedientes recibidos",
        "✅ Aprobaciones": "✅ Aprobaciones",
        "📊 Reportes": "📊 Reportes",
    }

opcion = st.sidebar.radio("Módulos", list(opciones_menu.keys()), key=f"menu_{portal}")
menu = opciones_menu[opcion]
st.sidebar.divider()
st.sidebar.caption("💾 Base de datos local SQLite · datos ficticios")
st.sidebar.warning("Cambio de rol SOLO visual: no es autenticación ni protección de datos.")
with st.sidebar.expander("🎤 Guía de la demostración"):
    st.markdown(
        "**Contratista:** registra un expediente, adjunta documentos, "
        "consulta observaciones y realiza la capacitación ficticia.\n\n"
        "**Revisor:** consulta el expediente, observa o aprueba en su turno, "
        "y revisa los indicadores.\n\n"
        "**Prueba:** crea un caso demo en Aprobaciones y cambia entre portales."
    )


if menu == "🏠 Panel principal":
    st.title("Bateas Onboarding 360")
    st.subheader("Sistema inteligente de afiliación de contratistas")
    st.success("Prototipo operativo")
    pendientes = 0
    observados = 0
    for i, trabajador in enumerate(st.session_state.trabajadores):
        requisitos = obtener_requisitos(trabajador)
        cargados = st.session_state.documentos.get(i, {})
        if any(r not in cargados for r in requisitos):
            pendientes += 1
        for registro in cargados.values():
            if registro.get("estado") in {"Vencido", "Requiere revisión"}:
                observados += 1

    aprobaciones_completas = sum(
        1 for flujo in st.session_state.aprobaciones.values()
        if flujo.get("estado") == "Completado"
    )
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Trabajadores registrados", len(st.session_state.trabajadores))
    c2.metric("Documentos observados", observados)
    c3.metric("Expedientes incompletos", pendientes)
    c4.metric("Revisiones completas (demo)", aprobaciones_completas)
    cursos_completos = sum(
        1 for v in st.session_state.capacitaciones.values() if v.get("aprobado")
    )
    st.caption(f"📚 Evaluaciones teóricas completadas (demo): **{cursos_completos}**")
    st.divider()
    st.info(
        "Registra trabajadores, carga documentos ficticios y usa la "
        "prevalidación automática. Las aprobaciones oficiales permanecen "
        "a cargo de las áreas responsables."
    )

elif menu == "🏛️ Panel de revisores":
    st.title("🛡️ Portal de revisión documental")
    st.caption("Panel de uso interno simulado · Área seleccionada: " + rol_revisor)
    st.warning("No es un acceso real a Bateas Mobile 360. No autoriza el ingreso de personas.")
    filas = construir_reporte()
    if not filas:
        st.info("Sin expedientes. Puedes crear un caso ficticio en el módulo Aprobaciones.")
    else:
        df = pd.DataFrame(filas)
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Expedientes recibidos", len(df))
        c2.metric("Con observaciones", int((df["Prevalidación"] == "Con observaciones").sum()))
        c3.metric("Con revisión 4/4", int((df["Aprobaciones"] == "4/4 revisiones simuladas").sum()))
        c4.metric("Prevalidación completa", int((df["Prevalidación"] == "Prevalidación de prueba completa").sum()))
        st.subheader("Últimos expedientes")
        st.dataframe(df[["Trabajador", "Empresa", "Modalidad", "Prevalidación", "Aprobaciones"]],
                     hide_index=True, use_container_width=True)
        st.info("Ve a Expedientes recibidos para revisar estados y a Aprobaciones para emitir una decisión ficticia.")

elif menu == "📂 Expedientes recibidos":
    st.title("📂 Bandeja de expedientes")
    st.caption("Consulta de estados y fechas extraídas, sin visualizar datos médicos ni contenido sensible.")
    if not st.session_state.trabajadores:
        st.info("No hay expedientes registrados.")
    else:
        indice = seleccionar_trabajador("Elegir expediente para consultar")
        trabajador = st.session_state.trabajadores[indice]
        st.write("**Trabajador ficticio:**", trabajador["Nombre"])
        st.write("**Empresa:**", trabajador["Empresa"])
        registros = st.session_state.documentos.get(indice, {})
        filas_estado = []
        for req in obtener_requisitos(trabajador):
            registro = registros.get(req, {})
            fecha = registro.get("fecha")
            filas_estado.append({
                "Requisito": req,
                "Estado": registro.get("estado", "No cargado"),
                "Fecha identificada": fecha.strftime("%d/%m/%Y") if fecha else "—",
            })
        st.dataframe(filas_estado, hide_index=True, use_container_width=True)
        flujo = estado_aprobacion(indice)
        st.write("**Estado de revisiones:**", flujo["estado"])
        if flujo.get("observacion"):
            st.warning("Observación vigente: " + flujo["observacion"])
        st.caption("Los resultados automáticos NO validan identidad, autenticidad, seguro ni aptitud médica.")

elif menu == "📬 Estado de solicitud":
    st.title("📬 Seguimiento de mi solicitud")
    st.info("En esta demostración puedes seleccionar un expediente. En producción cada usuario solo vería los suyos.")
    if not st.session_state.trabajadores:
        st.warning("Registra primero un trabajador ficticio.")
    else:
        indice = seleccionar_trabajador("Trabajador de la empresa contratista")
        trabajador = st.session_state.trabajadores[indice]
        requeridos = obtener_requisitos(trabajador)
        cargados = st.session_state.documentos.get(indice, {})
        progreso = sum(req in cargados for req in requeridos)
        st.metric("Documentos aportados", f"{progreso}/{len(requeridos)}")
        st.progress(progreso / len(requeridos))
        faltantes = [req for req in requeridos if req not in cargados]
        if faltantes:
            st.warning("Pendientes de carga: " + ", ".join(faltantes))
        flujo = estado_aprobacion(indice)
        st.write("**Revisiones internas simuladas:**", min(flujo["paso"], 4), "de 4")
        if flujo["estado"] == "Observado":
            st.error("Observación del área " + ROLES_APROBACION[flujo["paso"]] + ": " + str(flujo["observacion"]))
            st.info("Primero corrige o reemplaza el documento en ‘Mis documentos’ cuando corresponda.")
            with st.form(f"subsanar_portal_{indice}"):
                respuesta = st.text_area("Explica la corrección realizada (simulada)")
                reenviar = st.form_submit_button("Reenviar a revisión", type="primary")
            if reenviar:
                if not respuesta.strip():
                    st.error("Debes escribir una explicación de la corrección.")
                else:
                    registrar_evento(indice, "Reenviado", "Empresa contratista", respuesta.strip())
                    flujo["estado"] = "Pendiente"
                    flujo["observacion"] = None
                    recargar_con_guardado()
        elif flujo["estado"] == "Completado":
            st.success("Todas las revisiones simuladas están completadas.")
        else:
            st.info("Expediente pendiente de revisión por las áreas correspondientes.")
        curso = st.session_state.capacitaciones.get(indice, {})
        st.write("**Módulo teórico de prueba:**", "Superado" if curso.get("aprobado") else "Pendiente")
        if flujo["historial"]:
            st.subheader("Historial de la solicitud")
            st.dataframe(flujo["historial"], hide_index=True, use_container_width=True)
        st.warning("El registro no es una autorización de ingreso ni acredita capacitación oficial.")

elif menu == "👷 Registro de trabajadores":
    st.title("👷 Registro de trabajadores")
    with st.form("registro_trabajador", clear_on_submit=True):
        nombre = st.text_input("Nombre completo (ficticio)")
        empresa = st.text_input("Empresa contratista (ficticia)")
        puesto = st.selectbox(
            "Puesto de trabajo",
            ["Operario", "Técnico", "Ingeniero", "Conductor", "Personal de cocina", "Otros"],
        )
        modalidad = st.selectbox(
            "Modalidad de ingreso",
            ["Contratista permanente", "Contratista temporal", "Visita técnica", "Visita comercial"],
        )
        acceso = st.selectbox("Zona de acceso", ["Superficie", "Socavón"])
        registrar = st.form_submit_button("Registrar trabajador", type="primary")
    if registrar:
        if nombre.strip() and empresa.strip():
            st.session_state.trabajadores.append(
                {
                    "Nombre": nombre.strip(),
                    "Empresa": empresa.strip(),
                    "Puesto": puesto,
                    "Modalidad": modalidad,
                    "Acceso": acceso,
                    "Estado": "Pendiente de documentos",
                }
            )
            st.success("Trabajador de prueba registrado correctamente")
        else:
            st.error("Completa el nombre y la empresa.")
    st.divider()
    st.subheader("Trabajadores registrados")
    if st.session_state.trabajadores:
        st.dataframe(st.session_state.trabajadores, hide_index=True, use_container_width=True)
    else:
        st.info("Todavía no hay trabajadores registrados.")

elif menu == "📄 Validación de documentos":
    st.title("📄 Prevalidación de documentos")
    st.write("Carga documentos ficticios y analiza su texto y su fecha de vencimiento.")

    if not st.session_state.trabajadores:
        st.warning("Primero registra un trabajador en el módulo anterior.")
    else:
        indice = seleccionar_trabajador()
        trabajador = st.session_state.trabajadores[indice]
        requisitos = obtener_requisitos(trabajador)
        cargados = st.session_state.documentos.setdefault(indice, {})
        st.caption(
            f"**Puesto:** {trabajador['Puesto']}  |  "
            f"**Modalidad:** {trabajador['Modalidad']}  |  "
            f"**Acceso:** {trabajador['Acceso']}"
        )
        st.divider()
        st.subheader("Documentos requeridos")
        st.caption("Lista inicial demostrativa; requisitos reales sujetos a confirmación con Bateas.")

        for num, documento in enumerate(requisitos):
            previo = cargados.get(documento, {})
            encabezado = "✅" if previo.get("estado") == "Dentro de vigencia" else "📄"
            with st.expander(f"{encabezado} {documento}"):
                archivo = st.file_uploader(
                    f"Adjuntar {documento} (PDF o imagen)",
                    type=["pdf", "png", "jpg", "jpeg"],
                    key=f"archivo_{indice}_{num}",
                )
                if archivo is not None:
                    if archivo.size > 5 * 1024 * 1024:
                        st.error("Máximo 5 MB por archivo. Selecciona un archivo más pequeño.")
                    else:
                        datos = archivo.getvalue()
                        huella = hashlib.sha256(datos).hexdigest()
                        if previo.get("huella") != huella:
                            reiniciar_aprobaciones_si_corresponde(indice)
                            cargados[documento] = {
                                "nombre": archivo.name,
                                "datos": datos,
                                "huella": huella,
                                "texto": None,
                                "metodo": None,
                                "estado": "Cargado sin analizar",
                                "fecha": None,
                            }
                            previo = cargados[documento]

                if documento in cargados:
                    registro = cargados[documento]
                    st.write(f"**Archivo:** {registro['nombre']}")
                    if st.button("🔎 Analizar documento", key=f"analizar_{indice}_{num}"):
                        with st.spinner("Leyendo documento..."):
                            try:
                                texto, metodo = extraer_texto(registro["nombre"], registro["datos"])
                                registro["texto"] = texto
                                registro["metodo"] = metodo
                                if not texto.strip():
                                    registro["estado"] = "Requiere revisión"
                                    registro["fecha"] = None
                                elif documento in DOCUMENTOS_CON_VIGENCIA:
                                    fecha, estado = detectar_vencimiento(texto)
                                    registro["fecha"] = fecha
                                    registro["estado"] = (
                                        "Requiere revisión" if fecha is None else estado
                                    )
                                else:
                                    registro["fecha"] = None
                                    registro["estado"] = "Texto leído (sin regla de vigencia)"
                            except Exception as error:
                                registro["estado"] = "Requiere revisión"
                                registro["texto"] = None
                                st.error(f"No fue posible leer el archivo: {error}")

                    estado = registro["estado"]
                    if estado == "Vencido":
                        st.error("❌ Fecha de vencimiento anterior a hoy: requiere revisión.")
                    elif estado == "Requiere revisión":
                        st.warning("⚠️ No se pudo comprobar la vigencia o leer el contenido.")
                    elif estado == "Dentro de vigencia":
                        st.success("✅ La fecha identificada aún no ha vencido.")
                    else:
                        st.info(f"Estado: {estado}")

                    if registro.get("fecha"):
                        st.write("**Vencimiento reconocido:**", registro["fecha"].strftime("%d/%m/%Y"))
                    if registro.get("texto") is not None:
                        st.caption("Método: " + str(registro.get("metodo", "")))
                        with st.expander("Ver texto reconocido"):
                            st.code(registro["texto"][:6000], language=None)
                else:
                    st.warning("Documento pendiente de carga")

        cantidad = sum(1 for req in requisitos if req in cargados)
        st.divider()
        st.subheader("Avance del expediente")
        st.progress(cantidad / len(requisitos))
        st.write(f"**Archivos cargados: {cantidad} de {len(requisitos)}**")
        sin_analizar = sum(
            1 for req in requisitos
            if req in cargados and cargados[req]["estado"] == "Cargado sin analizar"
        )
        observaciones = sum(
            1 for req in requisitos
            if req in cargados and cargados[req]["estado"] in {"Vencido", "Requiere revisión"}
        )
        if cantidad < len(requisitos):
            trabajador["Estado"] = "Pendiente de documentos"
            st.warning(f"Faltan {len(requisitos) - cantidad} documentos por cargar.")
        else:
            trabajador["Estado"] = "Documentación cargada"
            st.success("Todos los archivos iniciales fueron cargados.")
        st.write(f"Pendientes de análisis: **{sin_analizar}** · Observaciones automáticas: **{observaciones}**")
        st.info(
            "Esta herramienta solo realiza una prevalidación de prueba. "
            "No comprueba autenticidad, identidad ni cumplimiento médico y "
            "no genera autorizaciones de ingreso."
        )
        if trabajador["Modalidad"] == "Contratista permanente":
            st.caption(
                "Las inducciones, el Anexo 5, evaluaciones y requisitos posteriores "
                "al ingreso deben cumplirse conforme al procedimiento autorizado."
            )


elif menu == "✅ Aprobaciones":
    st.title("✅ Flujo de aprobaciones (simulación)")
    st.write(
        "Representación del flujo de revisión del contratista permanente: "
        "Área usuaria → SSOMA → Médico Ocupacional → DHO."
    )
    st.warning(
        "Demostración académica con datos ficticios. Ninguna acción de esta "
        "pantalla equivale a una aprobación real, autoriza el ingreso ni genera fotocheck."
    )

    with st.expander("🧪 Crear un expediente de prueba completo", expanded=not st.session_state.trabajadores):
        st.write(
            "Esta opción agrega un trabajador FICTICIO y seis documentos PDF creados "
            "automáticamente. Se analizan mediante la extracción de texto de PDF. "
            "Es una prueba del flujo, no de autenticidad documental ni de OCR de imágenes."
        )
        if st.button("Crear caso de prueba para aprobaciones", type="secondary"):
            nuevo = crear_caso_demo_aprobaciones()
            st.success(f"Caso de prueba #{nuevo + 1} creado. Selecciónalo abajo.")
            recargar_con_guardado()

    if not st.session_state.trabajadores:
        st.info("Registra un contratista permanente o crea un caso de prueba arriba.")
    else:
        indice = seleccionar_trabajador("Seleccionar expediente")
        trabajador = st.session_state.trabajadores[indice]
        st.caption(
            f"Trabajador: **{trabajador['Nombre']}** · Empresa: **{trabajador['Empresa']}** "
            f"· Modalidad: **{trabajador['Modalidad']}**"
        )

        if trabajador["Modalidad"] != "Contratista permanente":
            st.info(
                "El flujo de esta demostración corresponde solo a contratistas "
                "permanentes. Las visitas y contratistas temporales tienen otros procedimientos."
            )
        else:
            flujo = estado_aprobacion(indice)
            problemas = evaluar_expediente_para_aprobaciones(indice)
            st.divider()
            st.subheader("1. Estado documental previo")
            if problemas:
                st.error("El expediente todavía no está listo para iniciar la simulación de aprobaciones.")
                for problema in problemas:
                    st.write("• " + problema)
                st.info(
                    "Vuelve a «Validación de documentos», carga los archivos faltantes "
                    "y pulsa «Analizar documento». Para una prueba rápida puedes "
                    "crear un expediente ficticio completo arriba."
                )
            else:
                st.success(
                    "Prevalidación de prueba completa. Los documentos aún requieren "
                    "comprobación y aprobación humana."
                )

            st.divider()
            st.subheader("2. Seguimiento de áreas")
            columnas = st.columns(4)
            for paso, area in enumerate(ROLES_APROBACION):
                with columnas[paso]:
                    if paso < flujo["paso"]:
                        st.success(f"✅ {area}")
                    elif paso == flujo["paso"] and flujo["estado"] == "Observado":
                        st.warning(f"⚠️ {area}: observado")
                    elif paso == flujo["paso"] and flujo["estado"] == "Completado":
                        st.success(f"✅ {area}")
                    elif paso == flujo["paso"]:
                        st.info(f"🔎 {area}: pendiente")
                    else:
                        st.write(f"⏳ {area}: en espera")
            st.progress(min(flujo["paso"], 4) / 4)
            st.caption(f"Aprobaciones simuladas completadas: {min(flujo['paso'], 4)} de 4")

            st.divider()
            st.subheader("3. Registrar revisión (solo simulación)")
            if flujo["estado"] == "Completado":
                trabajador["Estado"] = (
                    "Revisiones simuladas completas; pendiente de formación y habilitación"
                )
                st.success("Las cuatro revisiones simuladas fueron completadas.")
                st.warning(
                    "Todavía faltan inducciones, capacitación específica, evaluación "
                    "y autorización final según corresponda. No se habilita ningún ingreso."
                )
            elif problemas:
                st.info("Las decisiones se habilitarán cuando el expediente de prueba esté completo.")
            elif flujo["estado"] == "Observado":
                st.warning(
                    f"Expediente observado por {ROLES_APROBACION[flujo['paso']]}: "
                    f"{flujo['observacion']}"
                )
                st.info(
                    "La empresa contratista debe ingresar a su portal, ver el "
                    "estado de la solicitud y reenviar la corrección para una nueva revisión."
                )
            else:
                area_actual = ROLES_APROBACION[flujo["paso"]]
                st.write(f"**Responsable de esta revisión:** {area_actual}")
                if rol_revisor != area_actual:
                    st.info(
                        "Tu área de prueba es ‘" + rol_revisor + "’. "
                        "Para registrar la revisión, elige ‘" + area_actual + "’ en el menú lateral."
                    )
                else:
                    with st.form(f"evaluar_{indice}_{flujo['paso']}"):
                        decision = st.radio(
                            "Resultado de la revisión simulada",
                            ["Aprobar (simulado)", "Observar y solicitar corrección"],
                        )
                        comentario = st.text_area("Comentario de revisión")
                        enviar = st.form_submit_button("Registrar decisión", type="primary")
                    if enviar:
                        if decision == "Observar y solicitar corrección" and not comentario.strip():
                            st.error("Para observar un expediente debes indicar el motivo.")
                        elif decision == "Aprobar (simulado)":
                            registrar_evento(indice, "Aprobación simulada", area_actual, comentario.strip())
                            flujo["paso"] += 1
                            if flujo["paso"] == len(ROLES_APROBACION):
                                flujo["estado"] = "Completado"
                            recargar_con_guardado()
                        else:
                            registrar_evento(indice, "Observado", area_actual, comentario.strip())
                            flujo["estado"] = "Observado"
                            flujo["observacion"] = comentario.strip()
                            recargar_con_guardado()

            st.divider()
            st.subheader("4. Historial de acciones")
            if flujo["historial"]:
                st.dataframe(flujo["historial"], use_container_width=True, hide_index=True)
            else:
                st.info("Todavía no se registraron acciones de revisión.")

elif menu == "📚 Capacitaciones":
    st.title("📚 Capacitaciones teóricas (simulación)")
    st.write(
        "Demostración de aprendizaje autónomo con contenido breve, "
        "preguntas y registro de resultados por trabajador."
    )
    st.warning(
        "Contenido y evaluación ficticios para demostrar la plataforma. "
        "No equivalen a las inducciones oficiales ni sustituyen capacitaciones "
        "presenciales obligatorias, Anexo 5 o autorizaciones de ingreso."
    )

    if not st.session_state.trabajadores:
        st.info("Registra primero un trabajador o crea un caso ficticio en ✅ Aprobaciones.")
    else:
        indice = seleccionar_trabajador("Seleccionar trabajador para capacitación de prueba")
        trabajador = st.session_state.trabajadores[indice]
        st.caption(
            f"**Trabajador:** {trabajador['Nombre']}  |  "
            f"**Modalidad:** {trabajador['Modalidad']}"
        )
        if trabajador["Modalidad"] != "Contratista permanente":
            st.info(
                "En este prototipo el contenido demostrativo está habilitado "
                "únicamente para contratistas permanentes."
            )
        else:
            problemas = evaluar_expediente_para_aprobaciones(indice)
            if problemas:
                st.error(
                    "Para habilitar el curso de demostración, completa la "
                    "prevalidación documental inicial."
                )
                st.write("**Pendientes del expediente:**")
                for pendiente in problemas:
                    st.write("• " + pendiente)
                st.info(
                    "Para probarlo rápidamente, entra en ✅ Aprobaciones y usa "
                    "«Crear caso de prueba para aprobaciones»."
                )
            else:
                curso = estado_curso(indice)
                st.success("Prevalidación documental de prueba completada.")
                st.caption(
                    "El módulo teórico puede realizarse antes de completar "
                    "las aprobaciones simuladas; no habilita acceso a la mina."
                )
                st.divider()
                st.subheader("1. Contenido teórico")
                c1, c2 = st.columns(2)
                with c1:
                    with st.container(border=True):
                        st.markdown("**🦺 Seguridad general**")
                        st.write(
                            "Antes de iniciar actividades, respeta los controles "
                            "de acceso y las indicaciones del área responsable. "
                            "Identifica condiciones inseguras, comunica incidentes "
                            "y utiliza los equipos de protección determinados por "
                            "los riesgos y procedimientos aplicables."
                        )
                with c2:
                    with st.container(border=True):
                        st.markdown("**🌱 Medio ambiente**")
                        st.write(
                            "Gestiona los residuos en los lugares autorizados, "
                            "evita derrames, comunica situaciones que puedan "
                            "afectar el entorno y cumple las instrucciones "
                            "ambientales del área de trabajo."
                        )
                if not curso["material_revisado"]:
                    if st.button("✅ Marcar material revisado", type="primary"):
                        curso["material_revisado"] = True
                        recargar_con_guardado()
                else:
                    st.success("Material teórico marcado como revisado (simulación).")

                st.divider()
                st.subheader("2. Evaluación de práctica")
                st.caption(
                    "Cuatro preguntas de ejemplo. Criterio de éxito solo para "
                    "esta demostración: al menos 3 respuestas correctas."
                )
                if not curso["material_revisado"]:
                    st.info("Primero revisa el contenido y pulsa «Marcar material revisado».")
                else:
                    with st.form(f"cuestionario_{indice}"):
                        respuestas = []
                        for num, item in enumerate(PREGUNTAS_DEMO):
                            st.markdown(f"**{num + 1}. {item['pregunta']}**")
                            eleccion = st.radio(
                                f"Selecciona la respuesta de la pregunta {num + 1}",
                                item["opciones"],
                                index=None,
                                key=f"curso_{indice}_preg_{num}",
                                label_visibility="collapsed",
                            )
                            respuestas.append(eleccion)
                        enviar_cuestionario = st.form_submit_button(
                            "Calificar evaluación de prueba", type="primary"
                        )
                    if enviar_cuestionario:
                        if any(eleccion is None for eleccion in respuestas):
                            st.error("Responde las cuatro preguntas antes de enviar.")
                        else:
                            aciertos = sum(
                                1 for eleccion, item in zip(respuestas, PREGUNTAS_DEMO)
                                if eleccion == item["opciones"][item["correcta"]]
                            )
                            superado = aciertos >= 3
                            curso["ultima_nota"] = aciertos
                            curso["intentos"].append({
                                "Fecha y hora": datetime.now().strftime("%d/%m/%Y %H:%M"),
                                "Aciertos": aciertos,
                                "Resultado": "Superado (simulación)" if superado else "Por mejorar (simulación)",
                            })
                            if superado:
                                curso["aprobado"] = True
                            recargar_con_guardado()

                st.divider()
                st.subheader("3. Resultado y seguimiento")
                estado_texto = "Finalizado (simulación)" if curso["aprobado"] else "Pendiente"
                st.write(f"**Estado del módulo teórico:** {estado_texto}")
                st.progress(1.0 if curso["aprobado"] else 0.5 if curso["material_revisado"] else 0.0)
                if curso["intentos"]:
                    ultimo = curso["intentos"][-1]
                    if ultimo["Aciertos"] >= 3:
                        st.success(
                            f"Último resultado: {ultimo['Aciertos']} de 4 respuestas correctas. "
                            "Evaluación demostrativa superada."
                        )
                    else:
                        st.warning(
                            f"Último resultado: {ultimo['Aciertos']} de 4 respuestas correctas. "
                            "Repasa el contenido y vuelve a intentarlo."
                        )
                    st.dataframe(curso["intentos"], use_container_width=True, hide_index=True)
                    if curso["aprobado"]:
                        st.download_button(
                            "📥 Descargar constancia de simulación (TXT)",
                            data=constancia_demostrativa(indice, curso),
                            file_name=f"constancia_simulacion_trabajador_{indice + 1}.txt",
                            mime="text/plain",
                        )
                else:
                    st.info("Todavía no se ha enviado ninguna evaluación.")
                st.warning(
                    "Aunque el curso de demostración figure como finalizado, "
                    "el trabajador NO está habilitado para ingresar. "
                    "Las capacitaciones prácticas y aprobaciones oficiales son independientes."
                )


elif menu == "📊 Reportes":
    st.title("📊 Dashboard y reportes")
    st.write(
        "Seguimiento de expedientes ficticios: documentos, revisiones simuladas "
        "y evaluaciones teóricas de prueba."
    )
    st.warning(
        "Dashboard demostrativo. Ninguno de estos indicadores equivale a una "
        "autorización de ingreso, validación médica o aprobación de Minera Bateas."
    )

    filas = construir_reporte()
    if not filas:
        st.info(
            "Todavía no hay expedientes. Registra un trabajador en 👷 Registro "
            "o crea un caso ficticio en ✅ Aprobaciones."
        )
    else:
        df = pd.DataFrame(filas)
        total = len(df)
        completos = int((df["Prevalidación"] == "Prevalidación de prueba completa").sum())
        observados = int(df["Documentos observados"].sum())
        revisiones = int((df["Aprobaciones"] == "4/4 revisiones simuladas").sum())
        cursos = int((df["Curso"] == "Superado (simulación)").sum())

        st.subheader("1. Indicadores generales")
        columnas = st.columns(5)
        columnas[0].metric("Trabajadores", total)
        columnas[1].metric("Prevalidaciones completas", completos)
        columnas[2].metric("Documentos observados", observados)
        columnas[3].metric("Revisiones 4/4 (demo)", revisiones)
        columnas[4].metric("Cursos superados (demo)", cursos)
        st.caption(
            "Las cifras se calculan con expedientes ficticios guardados localmente; "
            "no son métricas operativas reales de la minera."
        )

        st.divider()
        st.subheader("2. Distribución de expedientes")
        izq, der = st.columns(2)
        with izq:
            st.markdown("**Por modalidad de ingreso**")
            datos = (
                df["Modalidad"].value_counts()
                .rename_axis("Modalidad")
                .reset_index(name="Trabajadores")
            )
            st.bar_chart(datos, x="Modalidad", y="Trabajadores")
        with der:
            st.markdown("**Por estado de prevalidación**")
            datos = (
                df["Prevalidación"].value_counts()
                .rename_axis("Estado")
                .reset_index(name="Expedientes")
            )
            st.bar_chart(datos, x="Estado", y="Expedientes")

        st.divider()
        st.subheader("3. Consultar y exportar el reporte")
        modalidades = sorted(df["Modalidad"].unique().tolist())
        filtro = st.selectbox("Filtrar modalidad", ["Todas"] + modalidades)
        solo_pendientes = st.checkbox("Mostrar solo expedientes con pendientes u observaciones")
        filtrado = df.copy()
        if filtro != "Todas":
            filtrado = filtrado[filtrado["Modalidad"] == filtro]
        if solo_pendientes:
            filtrado = filtrado[
                filtrado["Prevalidación"] != "Prevalidación de prueba completa"
            ]
        st.caption(f"Mostrando {len(filtrado)} de {len(df)} trabajadores")
        if filtrado.empty:
            st.info("No hay registros que coincidan con los filtros.")
        else:
            st.dataframe(filtrado, hide_index=True, use_container_width=True)
        st.download_button(
            "📥 Descargar reporte CSV (datos ficticios)",
            data=filtrado.to_csv(index=False).encode("utf-8-sig"),
            file_name="reporte_bateas_onboarding_360_demo.csv",
            mime="text/csv",
            disabled=filtrado.empty,
        )
        st.caption(
            "El CSV contiene solo un resumen de los expedientes; "
            "no exporta los archivos adjuntos."
        )

        st.divider()
        st.subheader("4. Ficha resumida de un expediente")
        indice = seleccionar_trabajador("Seleccionar expediente para revisar")
        fila = filas[indice]
        trabajador = st.session_state.trabajadores[indice]
        requisitos = obtener_requisitos(trabajador)
        cargados = st.session_state.documentos.get(indice, {})
        st.write(
            f"**Trabajador:** {fila['Trabajador']} · **Empresa:** {fila['Empresa']}"
        )
        st.progress(sum(doc in cargados for doc in requisitos) / len(requisitos))
        st.write(f"**Documentos cargados:** {fila['Documentos cargados']}")
        st.write(f"**Prevalidación:** {fila['Prevalidación']}")
        st.write(f"**Aprobaciones:** {fila['Aprobaciones']}")
        st.write(f"**Capacitación:** {fila['Curso']}")
        faltantes = [doc for doc in requisitos if doc not in cargados]
        if faltantes:
            st.write("**Documentos pendientes:** " + ", ".join(faltantes))
        observados = [
            doc for doc in requisitos if doc in cargados
            and cargados[doc].get("estado") in {"Vencido", "Requiere revisión"}
        ]
        if observados:
            st.write("**Documentos observados:** " + ", ".join(observados))
        st.info(
            "Este reporte no acredita la autenticidad de los documentos "
            "ni habilita el ingreso a la unidad minera."
        )

else:
    st.title(menu)
    st.info("Módulo pendiente de desarrollo. Próxima etapa del prototipo.")

st.divider()
st.caption("Prototipo demostrativo | Equipo MYOPIA | Solo datos ficticios")

# Guardado tras cada ejecución ordinaria (registro, subida y análisis de archivos,
# y cualquier cambio que Streamlit haga al actualizar los controles).
try:
    guardar_estado_local()
except sqlite3.Error as error:
    st.error(f"No se pudo guardar la base de datos local: {error}")

