export type StrictRole = 'SSOMA' | 'ECM' | 'GARITA' | 'TRABAJADOR';
export type LegacyRoleLabel = 'ADMIN_ECM' | 'SSOMA_DHO' | 'GARITA' | 'TRABAJADOR';
export type TrafficLight = 'VERDE' | 'AMBAR' | 'ROJO';
export type DocStatus = 'PENDIENTE' | 'VERDE' | 'AMBAR' | 'ROJO';

export interface AuthUser {
  username: string;
  role: LegacyRoleLabel;
  strictRole: StrictRole;
  workerId: string | null;
  workerDni: string | null;
  requiresBiometricLogin?: boolean;
  fullName: string;
  areaLabel: string;
  token: string;
}

export interface TrainingQuestionItem {
  id: string;
  questionText: string;
  options: string[];
  correctIndex: number;
}

export interface TrainingModuleProgressItem {
  progressId: string;
  moduleId: string;
  code: string;
  title: string;
  description: string;
  videoUrl: string | null;
  dayNumber: number;
  modality: 'ELEARNING' | 'PRESENTIAL' | 'VR';
  requiredHours: number;
  jobSpecialty: string | null;
  completedSeconds: number;
  requiredSeconds: number;
  completedHours: number;
  percent: number;
  status: string;
  isUnlocked: boolean;
  examScore: number | null;
  scheduledDate: string | null;
  scheduledShift: string | null;
  attendanceVerifiedBy: string | null;
  practicalScore: number | null;
  observations: string | null;
  completedAt: string | null;
  questions: TrainingQuestionItem[];
}

export interface TrainingRoadmap {
  workerId: string;
  dni: string;
  fullName: string;
  jobPosition: string;
  companyName: string;
  trafficLight: TrafficLight;
  statusSummary: string;
  totalRequiredHours: number;
  totalCompletedHours: number;
  overallPercent: number;
  gates: {
    day1Completed: boolean;
    day2Unlocked: boolean;
    day2Completed: boolean;
    day34Unlocked: boolean;
    day34Completed: boolean;
    vrAllPassed: boolean;
    allTraining32hCompleted: boolean;
  };
  modules: TrainingModuleProgressItem[];
  vrSummary: {
    requiredScenarios: string[];
    passedScenarios: string[];
    vrAllPassed: boolean;
    sessions: any[];
  };
  recentBiometricLogs: any[];
}
