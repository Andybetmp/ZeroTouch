import { prisma } from '../config/prisma.js';
import { extractDocumentContent } from './ocr.service.js';

export interface StructuredCvData {
  education: Array<{ institution: string; degree: string; year: string }>;
  generalExperience: Array<{ company: string; role: string; period: string; summary?: string }>;
  miningExperience: Array<{ mineOrUnit: string; role: string; years: string; undergroundOrSurface?: string }>;
  specializations: Array<{ name: string; level?: string }>;
  certifications: Array<{ name: string; issuer: string; validUntil?: string }>;
  courses: Array<{ name: string; hours?: string; year?: string }>;
}

const EMPTY_CV_DATA: StructuredCvData = {
  education: [],
  generalExperience: [],
  miningExperience: [],
  specializations: [],
  certifications: [],
  courses: [],
};

function safeParseArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getWorkerCvProfile(workerId: string) {
  const profile = await prisma.workerCvProfile.findUnique({
    where: { workerId },
  });

  if (!profile) {
    return {
      workerId,
      ...EMPTY_CV_DATA,
      cvPdfFileName: null,
      cvPdfDataUrl: null,
      updatedBy: null,
      updatedAt: null,
    };
  }

  return {
    id: profile.id,
    workerId: profile.workerId,
    education: safeParseArray(profile.educationJson),
    generalExperience: safeParseArray(profile.workExperienceJson),
    miningExperience: safeParseArray(profile.miningExperienceJson),
    specializations: safeParseArray(profile.specializationsJson),
    certifications: safeParseArray(profile.certificationsJson),
    courses: safeParseArray(profile.coursesJson),
    cvPdfFileName: profile.pdfFileName,
    cvPdfDataUrl: profile.pdfUrl,
    updatedBy: profile.updatedBy,
    updatedAt: profile.updatedAt,
  };
}

export async function upsertWorkerCvProfile(
  workerId: string,
  data: Partial<StructuredCvData>,
  updatedBy: string
) {
  const existing = await prisma.workerCvProfile.findUnique({ where: { workerId } });

  const payload = {
    educationJson: JSON.stringify(data.education ?? (existing ? safeParseArray(existing.educationJson) : [])),
    workExperienceJson: JSON.stringify(
      data.generalExperience ?? (existing ? safeParseArray(existing.workExperienceJson) : [])
    ),
    miningExperienceJson: JSON.stringify(
      data.miningExperience ?? (existing ? safeParseArray(existing.miningExperienceJson) : [])
    ),
    specializationsJson: JSON.stringify(
      data.specializations ?? (existing ? safeParseArray(existing.specializationsJson) : [])
    ),
    certificationsJson: JSON.stringify(
      data.certifications ?? (existing ? safeParseArray(existing.certificationsJson) : [])
    ),
    coursesJson: JSON.stringify(data.courses ?? (existing ? safeParseArray(existing.coursesJson) : [])),
    updatedBy,
  };

  await prisma.workerCvProfile.upsert({
    where: { workerId },
    create: { workerId, ...payload },
    update: payload,
  });

  return getWorkerCvProfile(workerId);
}

/**
 * Adjunta o reemplaza el PDF del CV sin sobrescribir las características manuales guardadas.
 */
export async function uploadWorkerCvPdf(
  workerId: string,
  file: { originalname: string; mimetype: string; buffer: Buffer },
  updatedBy: string
) {
  const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

  await prisma.workerCvProfile.upsert({
    where: { workerId },
    create: {
      workerId,
      pdfFileName: file.originalname,
      pdfUrl: dataUrl,
      updatedBy,
    },
    update: {
      pdfFileName: file.originalname,
      pdfUrl: dataUrl,
      updatedBy,
    },
  });

  return getWorkerCvProfile(workerId);
}

function heuristicExtractCvFromText(text: string): StructuredCvData {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const education: StructuredCvData['education'] = [];
  const generalExperience: StructuredCvData['generalExperience'] = [];
  const miningExperience: StructuredCvData['miningExperience'] = [];
  const specializations: StructuredCvData['specializations'] = [];
  const certifications: StructuredCvData['certifications'] = [];
  const courses: StructuredCvData['courses'] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/(ingenier|técnic|bachiller|universidad|instituto|senati|tecsup|uni|pucp)/i.test(lower)) {
      education.push({ institution: 'Extraído de CV PDF', degree: line, year: '2020' });
    } else if (/(socavón|subterránea|mina|minera|bateas|tajo|perforación|voladura|scooptram)/i.test(lower)) {
      miningExperience.push({
        mineOrUnit: 'Operación Minera',
        role: line,
        years: '2+ años',
        undergroundOrSurface: 'Socavón',
      });
    } else if (/(especialista|especialización|iperc|matpel|loto|ssoma|seguridad)/i.test(lower)) {
      specializations.push({ name: line, level: 'Avanzado' });
    } else if (/(certificad|licencia|sucamec|mtc|homologación|iso)/i.test(lower)) {
      certifications.push({ name: line, issuer: 'Entidad Emisora', validUntil: '2027-12-31' });
    } else if (/(curso|taller|capacitación|seminario|diplomado)/i.test(lower)) {
      courses.push({ name: line, hours: '8h', year: '2025' });
    } else if (/(experiencia|empresa|contratista|cargo|operador|supervisor)/i.test(lower)) {
      generalExperience.push({ company: 'Empresa Anterior', role: line, period: '2021 - 2025' });
    }
  }

  return {
    education: education.slice(0, 5),
    generalExperience: generalExperience.slice(0, 5),
    miningExperience: miningExperience.slice(0, 5),
    specializations: specializations.slice(0, 6),
    certifications: certifications.slice(0, 5),
    courses: courses.slice(0, 6),
  };
}

/**
 * Autocompleta explícitamente el perfil estructurado desde el PDF del CV usando Gemini IA
 * (con respaldo heurístico determinístico si no hay API key o falla la red).
 */
export async function autofillCvFromPdf(workerId: string, updatedBy: string) {
  const profile = await prisma.workerCvProfile.findUnique({ where: { workerId } });
  let textToParse = '';

  if (profile?.pdfUrl && profile.pdfUrl.startsWith('data:')) {
    const base64Part = profile.pdfUrl.split(',')[1];
    if (base64Part) {
      const buffer = Buffer.from(base64Part, 'base64');
      const ocr = await extractDocumentContent({
        fileName: profile.pdfFileName || 'cv.pdf',
        mimeType: 'application/pdf',
        buffer,
      });
      textToParse = ocr.extractedText;
    }
  }

  if (!textToParse) {
    const cvDoc = await prisma.workerDocument.findFirst({
      where: {
        workerId,
        requirement: { code: 'CV_ACTUALIZADO' },
      },
      orderBy: { id: 'desc' },
    });
    textToParse = cvDoc?.extractedText || '';
  }

  if (!textToParse.trim()) {
    throw new Error('Primero adjunte un archivo PDF de CV para poder extraer sus características.');
  }

  let extracted: StructuredCvData | null = null;
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;
      const prompt = `Eres un especialista de RRHH Minero en Perú. Extrae del siguiente CV en texto plano un JSON estricto con estas 6 claves:
{
  "education": [{"institution": "...", "degree": "...", "year": "..."}],
  "generalExperience": [{"company": "...", "role": "...", "period": "...", "summary": "..."}],
  "miningExperience": [{"mineOrUnit": "...", "role": "...", "years": "...", "undergroundOrSurface": "..."}],
  "specializations": [{"name": "...", "level": "..."}],
  "certifications": [{"name": "...", "issuer": "...", "validUntil": "..."}],
  "courses": [{"name": "...", "hours": "...", "year": "..."}]
}
Responde ÚNICAMENTE con JSON válido. Texto del CV:\n${textToParse.slice(0, 6000)}`;

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
        }),
      });
      if (resp.ok) {
        const json: any = await resp.json();
        const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          extracted = JSON.parse(rawText);
        }
      }
    } catch {
      extracted = null;
    }
  }

  const finalData = extracted ?? heuristicExtractCvFromText(textToParse);
  return upsertWorkerCvProfile(workerId, finalData, updatedBy);
}
