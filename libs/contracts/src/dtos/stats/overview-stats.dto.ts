export interface PatientStatsOverviewDto {
  totalPatients: number;
  currentMonthPatients: number;
  previousMonthPatients: number;
  growthPercent: number;
}

export interface AppointmentStatsOverviewDto {
  totalAppointments: number;
  currentMonthAppointments: number;
  previousMonthAppointments: number;
  growthPercent: number;
}

export interface ReviewOverviewStatsDto {
  totalReviews: number;
  ratingCounts: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface QAStatsOverviewDto {
  totalQuestions: number;
  answeredQuestions: number;
  answerRate: number;
}
