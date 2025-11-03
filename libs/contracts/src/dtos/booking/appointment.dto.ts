export interface AppointmentDto {
  id: string;
  patientId: string;
  doctorId: string;
  locationId: string;
  serviceDate: Date;
  timeStart: string;
  timeEnd: string;
  status:
    | 'BOOKED'
    | 'CONFIRMED'
    | 'RESCHEDULED'
    | 'CANCELLED_BY_PATIENT'
    | 'CANCELLED_BY_STAFF'
    | 'NO_SHOW'
    | 'COMPLETED';
  reason?: string;
  notes?: string;
  priceAmount?: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}
