// Minimal DTO for review analysis list (without full HTML content)
export interface ReviewAnalysisMinimalDto {
  id: string;
  doctorId: string;
  dateRange: string;
  includeNonPublic: boolean;
  summary: string; // Only summary, no full content
  createdBy: string;
  createdAt: Date;
}
