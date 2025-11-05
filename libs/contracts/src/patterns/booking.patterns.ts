export const BOOKING_PATTERNS = {
  // Appointment management
  CREATE_APPOINTMENT: 'booking.appointment.create',
  GET_APPOINTMENT: 'booking.appointment.get',
  UPDATE_APPOINTMENT: 'booking.appointment.update',
  CANCEL_APPOINTMENT: 'booking.appointment.cancel',
  CONFIRM_APPOINTMENT: 'booking.appointment.confirm',
  RESCHEDULE_APPOINTMENT: 'booking.appointment.reschedule',
  LIST_APPOINTMENTS: 'booking.appointment.list',
  LIST_APPOINTMENTS_BY_FILTER: 'booking.appointment.listByFilter',

  // Booking by doctor
  BOOK_BY_DOCTOR: 'booking.by.doctor',

  // Booking by date
  BOOK_BY_DATE: 'booking.by.date',

  // Slot management
  HOLD_SLOT: 'booking.slot.hold',
  RELEASE_SLOT: 'booking.slot.release',
  COMMIT_SLOT: 'booking.slot.commit',
  LIST_SLOTS: 'booking.slot.list',
  LIST_SLOTS_BY_FILTER: 'booking.slot.listByFilter',
  LIST_EVENTS_BY_FILTER: 'booking.event.listByFilter',
  CREATE_EVENT_TEMP: 'booking.event.createTemp',
  CREATE_APPOINTMENT_FROM_EVENT: 'booking.appointment.createFromEvent',
};
