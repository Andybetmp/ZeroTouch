# Spec 02 — Esquema de Base de Datos PostgreSQL y Prisma ORM (SDD)

## 1. Principios de Diseño para PostgreSQL y Futura Migración a Spring Boot
1. **Nombres de tablas y columnas en `snake_case`** mediante directivas `@map` y `@@map` en Prisma, garantizando que cuando se conecte **Spring Boot (Spring Data JPA / Hibernate)** en la Fase 2, las entidades `@Entity` mapeen directamente sin migraciones destructivas.
2. **Claves primarias UUID v4** (`@default(uuid())`) en lugar de índices secuenciales en memoria.
3. **Integridad transaccional ACID**: Ninguna operación borra tablas completas; todas las actualizaciones son atómicas por registro y dejan rastro en `audit_logs`.

---

## 2. Archivo `schema.prisma` Oficial

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum StayType {
  PERMANENTE_CIA
  TEMPORAL
  VISITA_TECNICA
  VISITA_COMERCIAL
}

enum JobPosition {
  OPERARIO
  TECNICO
  INGENIERO
  CONDUCTOR
  PERSONAL_COCINA
  OTROS
}

enum AccessZone {
  SUPERFICIE
  SOCAVON
}

enum ResponsibleArea {
  AREA_USUARIA
  SSOMA
  AREA_MEDICA
  DHO
}

enum TrafficLightStatus {
  VERDE
  AMBAR
  ROJO
}

enum DocumentStatus {
  PENDIENTE
  VERDE
  AMBAR
  ROJO
}

enum ExceptionStatus {
  OPEN
  APPROVED
  REJECTED
}

enum PvcPrintStatus {
  QUEUED_GARITA
  PRINTED
  DELIVERED
}

model ContractorEcm {
  id          String   @id @default(uuid()) @db.Uuid
  ruc         String   @unique @db.VarChar(11)
  companyName String   @map("company_name") @db.VarChar(150)
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  workers     Worker[]

  @@map("contractors_ecm")
}

model BlacklistEntry {
  id        String   @id @default(uuid()) @db.Uuid
  dni       String   @unique @db.VarChar(15)
  fullName  String   @map("full_name") @db.VarChar(150)
  reason    String   @db.Text
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("blacklist_entries")
}

model StayTypeRequirement {
  id               String           @id @default(uuid()) @db.Uuid
  code             String           @unique @db.VarChar(40)
  name             String           @db.VarChar(150)
  stayType         StayType         @map("stay_type")
  applicableJob    JobPosition?     @map("applicable_job") // null = aplica a todos los puestos de esa estadía
  isMandatory      Boolean          @default(true) @map("is_mandatory")
  requiresValidity Boolean          @default(false) @map("requires_validity")
  responsibleArea  ResponsibleArea  @map("responsible_area")
  createdAt        DateTime         @default(now()) @map("created_at")
  workerDocuments  WorkerDocument[]

  @@map("stay_type_requirements")
}

model Worker {
  id                String             @id @default(uuid()) @db.Uuid
  dni               String             @unique @db.VarChar(15)
  fullName          String             @map("full_name") @db.VarChar(150)
  contractorId      String             @map("contractor_id") @db.Uuid
  contractor        ContractorEcm      @relation(fields: [contractorId], references: [id])
  jobPosition       JobPosition        @map("job_position")
  stayType          StayType           @default(PERMANENTE_CIA) @map("stay_type")
  accessZone        AccessZone         @default(SUPERFICIE) @map("access_zone")
  trafficLight      TrafficLightStatus @default(AMBAR) @map("traffic_light")
  statusSummary     String             @map("status_summary") @db.VarChar(255)
  isBlacklisted     Boolean            @default(false) @map("is_blacklisted")
  elearningPassed   Boolean            @default(false) @map("elearning_passed")
  sessionCode       String             @map("session_code") @db.VarChar(20)
  createdAt         DateTime           @default(now()) @map("created_at")
  updatedAt         DateTime           @updatedAt @map("updated_at")
  documents         WorkerDocument[]
  elearningAttempts ElearningAttempt[]
  digitalBadge      DigitalBadgeQr?
  auditLogs         AuditLog[]

  @@map("workers")
}

model WorkerDocument {
  id                 String              @id @default(uuid()) @db.Uuid
  workerId           String              @map("worker_id") @db.Uuid
  worker             Worker              @relation(fields: [workerId], references: [id], onDelete: Cascade)
  requirementId      String              @map("requirement_id") @db.Uuid
  requirement        StayTypeRequirement @relation(fields: [requirementId], references: [id])
  fileName           String?             @map("file_name") @db.VarChar(255)
  fileMimeType       String?             @map("file_mime_type") @db.VarChar(80)
  fileHashSha256     String?             @map("file_hash_sha256") @db.VarChar(64)
  fileData           Bytes?              @map("file_data")
  extractedText      String?             @map("extracted_text") @db.Text
  extractionMethod   String?             @map("extraction_method") @db.VarChar(50)
  ocrConfidence      Float?              @map("ocr_confidence")
  detectedDni        String?             @map("detected_dni") @db.VarChar(15)
  detectedExpiryDate DateTime?           @map("detected_expiry_date") @db.Date
  status             DocumentStatus      @default(PENDIENTE)
  statusReason       String              @default("Pendiente de carga por la ECM") @map("status_reason") @db.VarChar(255)
  updatedAt          DateTime            @updatedAt @map("updated_at")
  exceptionReviews   ExceptionReview[]

  @@unique([workerId, requirementId])
  @@map("worker_documents")
}

model ExceptionReview {
  id               String          @id @default(uuid()) @db.Uuid
  workerDocumentId String          @map("worker_document_id") @db.Uuid
  workerDocument   WorkerDocument  @relation(fields: [workerDocumentId], references: [id], onDelete: Cascade)
  assignedArea     ResponsibleArea @map("assigned_area")
  reviewStatus     ExceptionStatus @default(OPEN) @map("review_status")
  reasonTriggered  String          @map("reason_triggered") @db.VarChar(255)
  reviewerName     String?         @map("reviewer_name") @db.VarChar(120)
  reviewerComment  String?         @map("reviewer_comment") @db.Text
  manualExpiryDate DateTime?       @map("manual_expiry_date") @db.Date
  createdAt        DateTime        @default(now()) @map("created_at")
  resolvedAt       DateTime?       @map("resolved_at")

  @@map("exception_reviews")
}

model QuizQuestion {
  id           String   @id @default(uuid()) @db.Uuid
  category     String   @db.VarChar(60) // SEGURIDAD_GENERAL, MEDIO_AMBIENTE
  questionText String   @map("question_text") @db.Text
  optionsJson  String   @map("options_json") @db.Text // JSON array of strings
  correctIndex Int      @map("correct_index")
  isActive     Boolean  @default(true) @map("is_active")

  @@map("quiz_questions")
}

model ElearningAttempt {
  id               String   @id @default(uuid()) @db.Uuid
  workerId         String   @map("worker_id") @db.Uuid
  worker           Worker   @relation(fields: [workerId], references: [id], onDelete: Cascade)
  materialReviewed Boolean  @default(false) @map("material_reviewed")
  scoreObtained    Int      @map("score_obtained")
  totalQuestions   Int      @map("total_questions")
  passed           Boolean
  certificateCode  String?  @map("certificate_code") @db.VarChar(60)
  attemptedAt      DateTime @default(now()) @map("attempted_at")

  @@map("elearning_attempts")
}

model DigitalBadgeQr {
  id             String         @id @default(uuid()) @db.Uuid
  workerId       String         @unique @map("worker_id") @db.Uuid
  worker         Worker         @relation(fields: [workerId], references: [id], onDelete: Cascade)
  badgeCode      String         @unique @map("badge_code") @db.VarChar(40)
  qrPayloadJson  String         @map("qr_payload_json") @db.Text
  signatureHash  String         @map("signature_hash") @db.VarChar(128)
  pvcPrintStatus PvcPrintStatus @default(QUEUED_GARITA) @map("pvc_print_status")
  issuedAt       DateTime       @default(now()) @map("issued_at")
  validUntil     DateTime       @map("valid_until") @db.Date

  @@map("digital_badges_qr")
}

model AuditLog {
  id        String   @id @default(uuid()) @db.Uuid
  workerId  String?  @map("worker_id") @db.Uuid
  worker    Worker?  @relation(fields: [workerId], references: [id], onDelete: SetNull)
  actorArea String   @map("actor_area") @db.VarChar(60)
  action    String   @db.VarChar(100)
  details   String   @db.Text
  createdAt DateTime @default(now()) @map("created_at")

  @@map("audit_logs")
}
```

---

## 3. Datos Semilla (`seed.ts`) basados en App Bateas v2.1.0 (Entregable 3, Figura 3)

La tabla `stay_type_requirements` se poblará inicialmente con los registros reales observados en la captura de **App Bateas v2.1.0 (`PERMANENTE CIA`)**:

| Código | Descripción en App Bateas | Estadía | Puesto Aplicable | `is_mandatory` (`¿Es obligatorio?`) | `requires_validity` (`¿Requiere vigencia?`) | Área Responsable Excepción |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| `DNI` | DNI | `PERMANENTE_CIA` | `NULL` (Todos) | `true` (Sí) | `false` (No) | `DHO` |
| `SCTR` | CONSTANCIA DE SCTR | `PERMANENTE_CIA` | `NULL` (Todos) | `true` (Sí) | `true` (Sí) | `SSOMA` |
| `EMO_16` | EMO - ANEXO 16-16A | `PERMANENTE_CIA` | `NULL` (Todos) | `true` (Sí) | `true` (Sí) | `AREA_MEDICA` |
| `CV_DOC` | CV DOCUMENTADO | `PERMANENTE_CIA` | `NULL` (Todos) | `true` (Sí) | `false` (No) | `DHO` |
| `DDJJ_DOM` | DDJJ SIMPLE DE DOMICILIO | `PERMANENTE_CIA` | `NULL` (Todos) | `true` (Sí) | `false` (No) | `DHO` |
| `FOTO` | FOTO | `PERMANENTE_CIA` | `NULL` (Todos) | `true` (Sí) | `false` (No) | `DHO` |
| `ISEM_CONST` | CONSTANCIA - ISEM (AUTOMÁTICO) | `PERMANENTE_CIA` | `NULL` (Todos) | `false` (No) | `false` (No) | `SSOMA` |
| `CERT_HAB` | CERTIFICADO DE HABILIDAD VIGENTE | `PERMANENTE_CIA` | `INGENIERO` | `true` (Sí) | `true` (Sí) | `AREA_USUARIA` |
| `LIC_COND` | LICENCIA DE CONDUCIR Y RÉCORD | `PERMANENTE_CIA` | `CONDUCTOR` | `true` (Sí) | `true` (Sí) | `SSOMA` |
| `CARNET_SAN` | CARNÉ DE SANIDAD | `PERMANENTE_CIA` | `PERSONAL_COCINA` | `true` (Sí) | `true` (Sí) | `AREA_MEDICA` |
