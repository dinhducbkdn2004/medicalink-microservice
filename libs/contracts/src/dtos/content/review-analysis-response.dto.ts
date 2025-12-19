export interface ReviewAnalysisResponseDto {
  id: string;
  doctorId: string;
  dateRange: string;
  includeNonPublic: boolean;

  // Statistical data
  period1Total: number;
  period1Avg: number;
  period2Total: number;
  period2Avg: number;
  totalChange: number;
  avgChange: number;

  // AI Analysis
  summary: string;
  advantages: string;
  disadvantages: string;
  changes: string;
  recommendations: string;

  // Metadata
  createdBy: string;
  createdAt: Date;
}
