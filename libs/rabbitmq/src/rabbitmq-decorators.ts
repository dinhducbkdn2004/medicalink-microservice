import { SetMetadata } from '@nestjs/common';
import { EVENT_TYPES, ROUTING_KEYS } from './rabbitmq-patterns';

// Metadata keys
export const RABBITMQ_EVENT_METADATA = 'rabbitmq:event';
export const RABBITMQ_PATTERN_METADATA = 'rabbitmq:pattern';
export const RABBITMQ_QUEUE_METADATA = 'rabbitmq:queue';

export function RabbitMQEvent(eventType: string) {
  return SetMetadata(RABBITMQ_EVENT_METADATA, eventType);
}

/**
 * Mark a method as a RabbitMQ pattern handler
 */
export function RabbitMQPattern(pattern: string) {
  return SetMetadata(RABBITMQ_PATTERN_METADATA, pattern);
}

/**
 * Mark a class as using a specific queue
 */
export function RabbitMQQueue(queueName: string) {
  return SetMetadata(RABBITMQ_QUEUE_METADATA, queueName);
}

/**
 * Mark a method as a User event handler
 */
export const UserEvent = (eventType: keyof typeof EVENT_TYPES) =>
  RabbitMQEvent(EVENT_TYPES[eventType]);

/**
 * Mark a method as an Appointment event handler
 */
export const AppointmentEvent = (eventType: keyof typeof EVENT_TYPES) =>
  RabbitMQEvent(EVENT_TYPES[eventType]);

/**
 * Mark a method as a Content event handler
 */
export const ContentEvent = (eventType: keyof typeof EVENT_TYPES) =>
  RabbitMQEvent(EVENT_TYPES[eventType]);

/**
 * Mark a method as a Notification event handler
 */
export const NotificationEvent = (eventType: keyof typeof EVENT_TYPES) =>
  RabbitMQEvent(EVENT_TYPES[eventType]);

/**
 * Mark a method as using a specific routing key
 */
export const RoutingKey = (key: keyof typeof ROUTING_KEYS) =>
  SetMetadata('rabbitmq:routing-key', ROUTING_KEYS[key]);

/**
 * Mark a method as needing retry logic
 */
export function RabbitMQRetry(maxRetries: number = 3, delay: number = 1000) {
  return SetMetadata('rabbitmq:retry', { maxRetries, delay });
}

/**
 * Mark a method as having a timeout
 */
export function RabbitMQTimeout(timeoutMs: number = 10000) {
  return SetMetadata('rabbitmq:timeout', timeoutMs);
}

/**
 * Mark a method as needing acknowledgment
 */
export function RabbitMQAck() {
  return SetMetadata('rabbitmq:ack', true);
}

/**
 * Mark a method as a dead letter handler
 */
export function RabbitMQDeadLetter() {
  return SetMetadata('rabbitmq:dead-letter', true);
}

/**
 * Mark a method as needing priority
 */
export function RabbitMQPriority(priority: number) {
  return SetMetadata('rabbitmq:priority', priority);
}

/**
 * Mark a method as needing correlation ID
 */
export function RabbitMQCorrelationId() {
  return SetMetadata('rabbitmq:correlation-id', true);
}
