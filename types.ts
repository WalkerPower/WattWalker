
export type UtilityProvider = 'PSEG' | 'ACE' | 'JCPL';

export type UserRole = 'basic' | 'pro' | 'premium';

export interface EnergyData {
  month: string;
  usage: number;
}

export interface GraphMetadata {
  yAxisMin: number;
  yAxisMax: number;
  yAxisLabels?: number[]; // Specific ticks extracted from the image
}

export interface AnalysisResponse {
  customerName?: string;
  fullAddress?: string; // Extracted address from bill
  billCost?: number;
  billUsage?: number;
  /** JCP&L: "Last 12 Months Use (KWH)" under This Year — last 12 bar totals must sum to this */
  last12MonthsBillKwh?: number;
  data: EnergyData[];
  metadata: GraphMetadata;
}

export interface CalculatedEnergyData extends EnergyData {
  adjustedDailyUsage: number; 
  daysInMonth: number;
  monthlyTotal: number;
  estimatedCost: number; 
}

export interface CalculationSummary {
  last12MonthsTotal: number;
  last12MonthsAverage: number;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface AnalysisResult {
  data: EnergyData[];
  rawJson: string;
}

export interface SavedRecord {
  id: string;
  timestamp: number;
  provider: UtilityProvider;
  customerName: string;
  fullAddress?: string;
  email?: string;
  phoneNumber?: string;
  billCost: number;
  billUsage: number;
  pricePerKwh: number;
  summary: CalculationSummary;
  data: CalculatedEnergyData[];
  /** Premium lead notes (persisted with record) */
  notes?: string;
}