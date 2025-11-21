# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MedicaLink is a microservices-based medical appointment booking system built with NestJS, using a monorepo structure. The system consists of 7 services communicating via RabbitMQ with a single PostgreSQL database using schema separation.

## Architecture

### Service Architecture
- **API Gateway** (`apps/api-gateway`): HTTP entry point (port 3000), routes REST requests to microservices via RabbitMQ
- **Accounts Service** (`apps/accounts-service`): Authentication, JWT tokens, staff accounts, permissions (RBAC)
- **Provider Directory Service** (`apps/provider-directory-service`): Doctor profiles, specialties, work locations, schedules
- **Booking Service** (`apps/booking-service`): Appointments, patients, scheduling events
- **Content Service** (`apps/content-service`): Blogs, Q&A, reviews
- **Notification Service** (`apps/notification-service`): Email/SMS/push notifications via queues
- **Orchestrator Service** (`apps/orchestrator-service`): Saga orchestration, read composition, cross-service coordination

**Critical**: All services except API Gateway run as RabbitMQ consumers only (no HTTP server). Services NEVER call each other directly - all inter-service communication routes through Orchestrator Service.

### Communication Patterns
- **Client → Gateway**: HTTP/REST on port 3000 with `/api` prefix
- **Gateway → Services**: RPC over RabbitMQ with 10-second timeout (via `MicroserviceService.sendWithTimeout()`)
- **Service ↔ Service**: Event-driven async via RabbitMQ topic exchange (`medicalink.topic`), coordinated through Orchestrator
- **Message Broker**: RabbitMQ with durable queues, 60s TTL for RPC, 300s for events, prefetch=1
- **Caching**: Redis for permissions, doctor schedules, rate limiting

### Database Architecture
Single PostgreSQL database with schema separation per service (not separate databases). Each service has its own Prisma schema and generated client in `./prisma/generated/client`. Connection pooling: 5 connections per service, 20s timeout.

### Shared Libraries (`libs/`)
- `@app/contracts`: DTOs, guards, decorators, message patterns, validators
- `@app/rabbitmq`: RabbitMQ config, queue names, routing keys
- `@app/redis`: Cache operations, pub/sub, job queues
- `@app/domain-errors`: Standardized error types (DomainError, NotFoundError, UnauthorizedError, etc.)
- `@app/error-adapters`: Error transformation between HTTP/RPC contexts, Prisma error mapping
- `@app/repositories`: Base repository pattern with Prisma
- `@app/commons`: Utility functions (dates, slugify, text formatting)

## Common Development Commands

### Starting Services
```bash
pnpm run dev                     # Start all services concurrently
pnpm run start:gateway           # Start API Gateway only
pnpm run start:accounts          # Start Accounts Service only
pnpm run start:provider          # Start Provider Directory Service only
pnpm run start:booking           # Start Booking Service only
pnpm run start:content           # Start Content Service only
pnpm run start:notification      # Start Notification Service only
pnpm run start:orchestrator      # Start Orchestrator Service only
```

### Building
```bash
pnpm run build                   # Build all services
pnpm run build:gateway           # Build individual service
pnpm run build:accounts
pnpm run typecheck               # Type check without emitting
```

### Database Operations
```bash
# Generate Prisma clients for all services
pnpm run prisma:generate

# Generate for specific service
pnpm run prisma:generate:accounts
pnpm run prisma:generate:provider
pnpm run prisma:generate:booking
pnpm run prisma:generate:content
pnpm run prisma:generate:notification

# Push schema changes to database
pnpm run prisma:push

# Run seed scripts
pnpm script -- --service=accounts-service --filename=create-super-admin
pnpm script -- --service=accounts-service --filename=permission-seeds
pnpm script -- --service=accounts-service --filename=clear-permissions
```

### Code Quality
```bash
pnpm run format                  # Format with Prettier
pnpm run format:check            # Check formatting without writing
pnpm run lint                    # ESLint with auto-fix
pnpm test                        # Run unit tests
pnpm test:watch                  # Test watch mode
pnpm test:cov                    # Coverage report
pnpm test:e2e                    # End-to-end tests
```

### Infrastructure
```bash
# Start local development infrastructure (Docker Compose)
docker-compose -f development/docker-compose.yml up -d postgres redis rabbitmq
docker-compose -f development/docker-compose.yml down
docker-compose -f development/docker-compose.yml logs -f
```

## Development Workflow

### Adding New Features

1. **Create DTOs** in `libs/contracts/src/dtos/[domain]/` with validation decorators
2. **Define message patterns** in `libs/contracts/src/patterns/[domain].patterns.ts`
3. **Implement service logic** in appropriate microservice
4. **Add controller method** in service with `@MessagePattern()` decorator
5. **Expose via Gateway** by adding controller method with HTTP decorators
6. **Update Prisma schema** if database changes needed, then run `prisma:generate` and `prisma:push`

### Working with Prisma

When modifying Prisma schemas:
1. Edit `apps/[service]/prisma/schema.prisma`
2. Run `pnpm run prisma:generate:[service]` to regenerate client
3. Run `pnpm run prisma:push` to apply changes to database
4. Rebuild the service: `pnpm run build:[service]`

Prisma clients are generated to `apps/[service]/prisma/generated/client`.

### Error Handling Pattern

Services throw `DomainError` subclasses (from `@app/domain-errors`):
- `NotFoundError` (404)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `ConflictError` (409)
- `ValidationError` (400)
- `RateLimitError` (429)

The `RpcDomainErrorFilter` catches these and converts to RPC exceptions. Gateway's `MicroserviceErrorInterceptor` transforms to HTTP responses.

### Permission System

Uses resource-action model (e.g., `appointments:read`, `doctors:write`). Apply with decorators:
```typescript
@RequirePermission('appointments', 'read')
@RequireDoctorPermission('doctors', 'write')
@Public() // For public endpoints
```

Permissions are cached in Redis and checked via `PermissionGuard`. Roles: SUPER_ADMIN, ADMIN, DOCTOR.

## Important Conventions

### Message Patterns
- RPC patterns: `auth.login`, `appointments.create`, `doctors.list`
- Event patterns: `user.created`, `appointment.booked`, `appointment.cancelled`
- Define in `libs/contracts/src/patterns/` files
- Events use routing keys with dot notation for topic exchange

### API Endpoints
- Gateway prefix: `/api`
- Health check: `/health` and `/api/health`
- Auth: `/api/auth/login`, `/api/auth/refresh`, `/api/auth/profile`
- Resources follow REST conventions: `/api/doctors`, `/api/appointments`, `/api/specialties`

### Code Organization
- Controllers define HTTP/RPC endpoints
- Services contain business logic
- Repositories handle data access (extend `BaseRepository`)
- DTOs for validation (use `class-validator` decorators)
- Guards for authentication and authorization

### Validation
- Use `class-validator` decorators in DTOs
- Gateway uses `SafeValidationPipe` with auto-trim and strict validation
- Services use standard `ValidationPipe`
- Custom validators in `libs/contracts/src/validators/`

### Environment Variables
Required variables (see `.env.example`):
- Database URLs per service: `ACCOUNTS_DATABASE_URL`, `PROVIDER_DATABASE_URL`, etc.
- `RABBITMQ_URL`: RabbitMQ connection string
- `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT`: Redis connection
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`: JWT signing secrets
- `API_GATEWAY_PORT`: Gateway port (default 3000)
- `SERVICE_NAME`: For Redis key prefixing
- SMTP configuration for email notifications

## Testing Strategy

### Running Tests
```bash
# Run all tests
pnpm test

# Run tests for specific service
cd apps/accounts-service && pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:cov
```

### Test File Location
- Unit tests: `*.spec.ts` alongside source files
- E2E tests: `apps/[service]/test/` directory
- Test utilities: `libs/contracts/src/testing/`

## Deployment

See `.cursor/DEPLOYMENT.md` for complete GCP deployment instructions using Docker Compose.

Key deployment commands (via `deployment/deploy.sh`):
```bash
./deployment/deploy.sh start all      # Start all services
./deployment/deploy.sh stop all       # Stop all services
./deployment/deploy.sh restart all    # Restart all services
./deployment/deploy.sh logs all       # View logs
./deployment/deploy.sh update all     # Update all services
./deployment/deploy.sh status all     # Check status
```

## Common Patterns

### Adding a New Microservice Controller Method

1. Define DTO in `libs/contracts/src/dtos/[domain]/`
2. Add message pattern to `libs/contracts/src/patterns/[domain].patterns.ts`
3. Implement in service controller:
```typescript
@MessagePattern(DOMAIN_PATTERNS.ACTION_NAME)
async actionName(@Payload() dto: ActionDto) {
  return this.service.actionName(dto);
}
```
4. Add Gateway endpoint:
```typescript
@Post('path')
async actionName(@Body() dto: ActionDto) {
  return this.microserviceService.sendWithTimeout(
    this.serviceClient,
    DOMAIN_PATTERNS.ACTION_NAME,
    dto,
  );
}
```

### Adding Event-Driven Communication

1. Define event pattern in `libs/contracts/src/patterns/[domain].patterns.ts`
2. Publisher emits event:
```typescript
this.client.emit(EVENT_PATTERN, eventPayload).subscribe();
```
3. Subscriber handles event:
```typescript
@EventPattern(EVENT_PATTERN)
async handleEvent(@Payload() event: EventDto) {
  // Handle event
}
```

### Working with Redis Cache

```typescript
// Inject RedisService
constructor(private readonly redisService: RedisService) {}

// Cache operations
await this.redisService.set('key', value, ttl);
await this.redisService.get('key');
await this.redisService.del('key');
await this.redisService.setJson('key', object, ttl);
await this.redisService.getJson('key');
```

## Recent Features

- Password reset flow with email verification codes
- Appointment email notifications
- Enhanced validation pipeline with SafeValidationPipe
- Permission-based access control with Redis caching

## Troubleshooting

### Services Won't Start
- Ensure infrastructure is running: `docker-compose -f development/docker-compose.yml up -d`
- Check RabbitMQ is accessible: verify `RABBITMQ_URL` in `.env`
- Check PostgreSQL is accessible: verify database URLs in `.env`
- Regenerate Prisma clients: `pnpm run prisma:generate`

### Database Connection Errors
- Verify database URLs are correct
- Check PostgreSQL is running: `docker ps | grep postgres`
- Test connection: `docker exec medicalink-postgres psql -U postgres -d appdb -c "SELECT 1"`

### RabbitMQ Connection Errors
- Check RabbitMQ is running: `docker ps | grep rabbitmq`
- Access management UI: `http://localhost:15672` (admin/admin123)
- Verify RABBITMQ_URL format: `amqp://user:pass@host:5672`

### Prisma Client Not Found
- Run `pnpm run prisma:generate` or service-specific command
- Rebuild the service: `pnpm run build:[service]`
- Check generated client exists at `apps/[service]/prisma/generated/client`

## API Documentation

See `.cursor/PASSWORD_RESET_API.md` for password reset endpoint documentation.

For other API endpoints, refer to controller files in `apps/api-gateway/src/controllers/`.
