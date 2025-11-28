# PHÂN TÍCH THIẾT KẾ HỆ THỐNG MEDICALINK

## MỤC LỤC

1. [Tác nhân (Actors)](#1-tác-nhân-actors)
2. [Chức năng của hệ thống](#2-chức-năng-của-hệ-thống)
3. [Thiết kế hệ thống](#3-thiết-kế-hệ-thống)

---

## 1. TÁC NHÂN (ACTORS)

Hệ thống MedicaLink phục vụ các nhóm người dùng sau:

### 1.1. Bệnh nhân (Patient)

**Mô tả:** Người dùng cuối cần đặt lịch khám bệnh và tìm kiếm thông tin y tế.

**Chức năng chính:**

- Tìm kiếm bác sĩ theo chuyên khoa, địa điểm
- Xem thông tin chi tiết bác sĩ (profile, chuyên môn, đánh giá)
- Đặt lịch hẹn khám bệnh
- Quản lý thông tin cá nhân (hồ sơ bệnh nhân)
- Xem lịch sử các cuộc hẹn
- Hủy/Đổi lịch hẹn
- Đọc bài viết y tế, đặt câu hỏi cho bác sĩ
- Đánh giá bác sĩ sau khi khám

**Đặc điểm:**

- Không cần đăng nhập để xem thông tin bác sĩ
- Cần cung cấp thông tin cá nhân khi đặt lịch
- Nhận thông báo qua email về trạng thái cuộc hẹn

### 1.2. Bác sĩ (Doctor)

**Mô tả:** Nhân viên y tế có tài khoản trong hệ thống để quản lý lịch làm việc
và cuộc hẹn.

**Chức năng chính:**

- Quản lý thông tin cá nhân và hồ sơ nghề nghiệp
- Thiết lập lịch làm việc (office hours, schedules)
- Xem danh sách cuộc hẹn
- Cập nhật trạng thái cuộc hẹn (confirm, complete, cancel)
- Trả lời câu hỏi từ bệnh nhân
- Viết bài blog y tế

**Đặc điểm:**

- Có tài khoản staff với role DOCTOR
- Được liên kết với Doctor profile trong provider directory
- Có quyền hạn được quản lý qua hệ thống RBAC

### 1.3. Quản trị viên (Admin)

**Mô tả:** Nhân viên quản lý hệ thống, có quyền cao hơn bác sĩ.

**Chức năng chính:**

- Quản lý tài khoản nhân viên (staff accounts)
- Quản lý thông tin bác sĩ, chuyên khoa
- Quản lý địa điểm khám bệnh (work locations)
- Quản lý nội dung (blogs, Q&A)
- Xem báo cáo, thống kê
- Phân quyền cho người dùng

**Đặc điểm:**

- Có tài khoản staff với role ADMIN hoặc SUPER_ADMIN
- Có toàn quyền quản lý hệ thống
- SUPER_ADMIN có thể quản lý permissions

### 1.4. Hệ thống bên ngoài (External Systems)

**Mô tả:** Các service/hệ thống tích hợp với MedicaLink.

**Bao gồm:**

- **Email Service (SMTP):** Gửi email thông báo
- **Cloud Storage (Cloudinary):** Lưu trữ ảnh đại diện, hình ảnh blog
- **Message Queue (RabbitMQ):** Điều phối giao tiếp giữa các microservices

---

## 2. CHỨC NĂNG CỦA HỆ THỐNG

Hệ thống được chia thành 7 microservices, mỗi service đảm nhận một nhóm chức
năng cụ thể:

### 2.1. API Gateway Service

**Vai trò:** Điểm vào duy nhất của hệ thống, nhận request HTTP từ client.

**Chức năng:**

- Route các request đến microservices tương ứng qua RabbitMQ
- Authentication & Authorization (JWT verification, permission check)
- Rate limiting để bảo vệ hệ thống
- Transform lỗi từ RPC về HTTP response
- Load balancing và timeout management
- Logging và monitoring

**Endpoints chính:**

- `/api/auth/*` - Xác thực và quản lý phiên
- `/api/doctors/*` - Thông tin bác sĩ
- `/api/appointments/*` - Đặt lịch và quản lý cuộc hẹn
- `/api/patients/*` - Quản lý bệnh nhân
- `/api/blogs/*`, `/api/questions/*` - Nội dung y tế
- `/api/specialties/*`, `/api/work-locations/*` - Danh mục

### 2.2. Accounts Service

**Vai trò:** Quản lý tài khoản, xác thực và phân quyền.

**Chức năng:**

- **Authentication:**
  - Đăng nhập (login) với email/password
  - Cấp phát JWT access token và refresh token
  - Refresh token để gia hạn phiên
  - Đổi mật khẩu
  - Quên mật khẩu (reset password flow với verification code)

- **Authorization:**
  - Quản lý hệ thống RBAC (Resource-Action Based Access Control)
  - Quản lý permissions (resource + action)
  - Gán permissions cho user hoặc group
  - Hỗ trợ multi-tenant với tenant isolation
  - Context-based permissions với JSON conditions
  - Permission effects (ALLOW/DENY)

- **User Management:**
  - CRUD tài khoản staff (SUPER_ADMIN, ADMIN, DOCTOR)
  - Quản lý profile của staff
  - Auth version management (để invalidate tokens khi cần)
  - Soft delete với deletedAt

**Database Schema:**

- `staff_accounts` - Thông tin tài khoản nhân viên
- `permissions` - Định nghĩa quyền (resource + action)
- `user_permissions` - Gán quyền trực tiếp cho user
- `groups` - Nhóm người dùng
- `user_groups` - Liên kết user với group
- `group_permissions` - Gán quyền cho group
- `auth_versions` - Version để invalidate token

### 2.3. Provider Directory Service

**Vai trò:** Quản lý thông tin bác sĩ, chuyên khoa, địa điểm và lịch làm việc.

**Chức năng:**

- **Doctor Management:**
  - CRUD thông tin bác sĩ (profile, degree, position, experience)
  - Liên kết với staff account qua `staffAccountId`
  - Denormalized data: fullName, isMale từ accounts-service để tối ưu query
  - Quản lý avatar và portrait
  - Thiết lập appointment duration cho từng bác sĩ

- **Specialty Management:**
  - CRUD chuyên khoa (Specialty)
  - Slug-based URL
  - Specialty info sections (nội dung chi tiết về chuyên khoa)
  - Gán bác sĩ vào các chuyên khoa (many-to-many)

- **Work Location Management:**
  - CRUD địa điểm khám bệnh
  - Thông tin địa chỉ, số điện thoại, Google Maps URL
  - Timezone support cho từng địa điểm
  - Gán bác sĩ vào các địa điểm (many-to-many)

- **Schedule Management:**
  - **Office Hours:** Lịch làm việc cố định theo tuần
    - Thiết lập giờ làm việc cho từng ngày (dayOfWeek, startTime, endTime)
    - Global office hours cho tất cả bác sĩ tại location
    - Override office hours cho bác sĩ cụ thể
  - **Schedules:** Lịch làm việc cụ thể (theo ngày)
    - Generate time slots available cho booking
    - Xử lý exceptions và special schedules

**Database Schema:**

- `doctors` - Profile bác sĩ
- `specialties` - Chuyên khoa
- `specialty_info_sections` - Nội dung chi tiết chuyên khoa
- `work_locations` - Địa điểm khám
- `doctor_specialties` - Liên kết bác sĩ - chuyên khoa
- `doctor_work_locations` - Liên kết bác sĩ - địa điểm
- `office_hours` - Lịch làm việc cố định
- `schedules` - Lịch làm việc cụ thể (chưa thấy trong schema, có thể được quản
  lý khác)

### 2.4. Booking Service

**Vai trò:** Quản lý cuộc hẹn và bệnh nhân.

**Chức năng:**

- **Patient Management:**
  - CRUD thông tin bệnh nhân
  - Tìm kiếm bệnh nhân theo tên, số điện thoại
  - Soft delete với deletedAt

- **Appointment Management:**
  - Tạo cuộc hẹn (với event corresponding)
  - Cập nhật thông tin cuộc hẹn (reason, notes, price)
  - Quản lý trạng thái cuộc hẹn (lifecycle):
    - BOOKED → CONFIRMED → COMPLETED
    - BOOKED → CANCELLED_BY_PATIENT
    - BOOKED → CANCELLED_BY_STAFF
    - BOOKED → NO_SHOW
    - BOOKED → RESCHEDULED
  - Temporary hold mechanism cho booking flow
  - Query cuộc hẹn theo doctor, location, specialty, patient
  - Lịch sử cuộc hẹn

- **Event Management:**
  - Tạo scheduling events (APPOINTMENT type)
  - Temporary hold với expiration (isTempHold, expiresAt)
  - Non-blocking events support
  - Metadata storage cho flexibility
  - Conflict detection

**Database Schema:**

- `patients` - Thông tin bệnh nhân
- `appointments` - Cuộc hẹn
- `events` - Scheduling events (time slots)

**Business Logic:**

- Validation: Không cho đặt trùng giờ
- Temporary hold: Giữ slot trong thời gian ngắn khi user đang booking
- Auto-expire temporary holds

### 2.5. Content Service

**Vai trò:** Quản lý nội dung y tế (blog, Q&A, reviews).

**Chức năng:**

- **Blog Management:**
  - CRUD bài viết blog
  - Blog categories và slug-based URL
  - Draft → Published → Archived workflow
  - View count tracking
  - Liên kết với chuyên khoa (many-to-many via array)
  - Thumbnail management
  - Author tracking (staffId)

- **Q&A System:**
  - Bệnh nhân đặt câu hỏi (anonymous hoặc với email)
  - Bác sĩ trả lời câu hỏi
  - Question status: PENDING → ANSWERED → CLOSED
  - Accept answer mechanism
  - View count tracking
  - Liên kết với specialty

- **Review System:**
  - Bệnh nhân đánh giá bác sĩ
  - Rating (1-5 stars)
  - Review title và body
  - Anonymous hoặc có tên
  - Public/private toggle
  - Tracking theo doctorId

- **Asset Management:**
  - Lưu trữ metadata của assets (images, files)
  - Polymorphic association (BLOG, QUESTION, REVIEW, DOCTOR, SPECIALTY)
  - Integration với Cloudinary qua publicId

**Database Schema:**

- `blogs` - Bài viết
- `blog_categories` - Danh mục blog
- `questions` - Câu hỏi
- `answers` - Câu trả lời
- `reviews` - Đánh giá bác sĩ
- `assets` - Tài nguyên đa phương tiện

### 2.6. Notification Service

**Vai trò:** Gửi thông báo qua email, SMS, push notification.

**Chức năng:**

- **Email Delivery:**
  - Queue-based email sending
  - Template-based emails với dynamic context
  - Retry mechanism với retry count
  - Status tracking (QUEUED → SENT/FAILED)
  - Error logging
  - SMTP integration

- **Email Templates:**
  - Quản lý email templates với key
  - Dynamic subject và body
  - Template activation/deactivation
  - Context injection cho personalization

- **Supported Notifications:**
  - Appointment confirmation
  - Appointment reminder
  - Appointment cancellation
  - Password reset code
  - Welcome email
  - (Có thể mở rộng cho SMS, push notification)

**Database Schema:**

- `email_deliveries` - Queue và tracking email
- `email_templates` - Template definitions

**Integration:**

- Lắng nghe events từ RabbitMQ
- Async processing với queue
- Idempotency để tránh gửi trùng

### 2.7. Orchestrator Service

**Vai trò:** Điều phối cross-service operations và composition queries.

**Chức năng:**

- **Command Orchestration (Saga Pattern):**
  - Doctor creation/update/deletion với rollback support
  - Appointment lifecycle orchestration (create, reschedule, cancel)
  - Coordination của multi-service transactions
  - Compensating transactions khi có lỗi

- **Read Composition (CQRS Pattern):**
  - **Doctor Composite:** Kết hợp data từ accounts + provider directory +
    reviews
    - Profile từ provider directory
    - Account info từ accounts service
    - Rating và reviews từ content service
  - **Blog Composite:** Blog + author info + specialty info
  - **Appointment Composite:** Appointment + patient + doctor + location +
    specialty info
  - **Schedule Slots Composite:** Office hours + existing appointments →
    available slots

- **Event Handling:**
  - Lắng nghe domain events từ các services
  - Trigger side effects (ví dụ: send notification khi appointment created)
  - Data synchronization (ví dụ: sync denormalized data)

- **Background Jobs:**
  - Cleanup expired temporary holds
  - Sync denormalized data
  - Health checks

**Key Patterns:**

- **Saga Orchestrator:** Centralized orchestration của distributed transactions
- **API Composition:** Aggregating data từ multiple services
- **Event-Driven Coordination:** React to domain events

---

## 3. THIẾT KẾ HỆ THỐNG

### 3.1. Tổng quan kiến trúc Microservices

#### 3.1.1. Tại sao chọn Microservices?

**Lý do:**

- **Scalability:** Mỗi service có thể scale độc lập dựa trên load
- **Maintainability:** Code được tổ chức theo domain, dễ maintain
- **Technology Flexibility:** Có thể dùng tech stack khác nhau cho mỗi service
- **Fault Isolation:** Lỗi ở một service không làm sập toàn bộ hệ thống
- **Team Autonomy:** Các team có thể phát triển service độc lập

**Trade-offs:**

- Complexity trong distributed system
- Network latency giữa các services
- Data consistency challenges
- Testing phức tạp hơn monolith

#### 3.1.2. Service Decomposition Strategy

Hệ thống được chia theo **Domain-Driven Design (DDD):**

```
┌─────────────────────────────────────────────────────────────┐
│                        API Gateway                          │
│                    (HTTP Entry Point)                       │
│                      Port 3000                              │
└────────────┬────────────────────────────────────────────────┘
             │ RabbitMQ RPC (10s timeout)
             │
      ┌──────┴──────────────────────────────────┐
      │                                          │
┌─────▼─────────┐  ┌────────────┐  ┌───────────▼─────────┐
│   Accounts    │  │  Provider  │  │     Booking         │
│   Service     │  │  Directory │  │     Service         │
│               │  │  Service   │  │                     │
│ - Auth        │  │            │  │ - Appointments      │
│ - Users       │  │ - Doctors  │  │ - Patients          │
│ - Permissions │  │ - Schedule │  │ - Events            │
└───────────────┘  └────────────┘  └─────────────────────┘

┌───────────────┐  ┌────────────┐  ┌─────────────────────┐
│   Content     │  │Notification│  │   Orchestrator      │
│   Service     │  │  Service   │  │    Service          │
│               │  │            │  │                     │
│ - Blogs       │  │ - Emails   │  │ - Saga Pattern      │
│ - Q&A         │  │ - SMS      │  │ - Read Composition  │
│ - Reviews     │  │ - Push     │  │ - Event Handlers    │
└───────────────┘  └────────────┘  └─────────────────────┘
```

**Decomposition Principles:**

- **Single Responsibility:** Mỗi service một bounded context
- **Loose Coupling:** Services giao tiếp qua message broker
- **High Cohesion:** Chức năng liên quan được nhóm trong cùng service
- **Autonomous:** Mỗi service có database riêng (schema separation)

### 3.2. Communication Patterns

#### 3.2.1. Request-Response Pattern (RPC)

**Mô tả:** Client gửi request và chờ response, dùng cho operations cần kết quả
ngay.

**Implementation với RabbitMQ:**

```typescript
// Gateway gửi RPC request
const result = await microserviceService.sendWithTimeout(
  accountsClient,
  'auth.login',
  loginDto,
  10000, // 10s timeout
);
```

**Workflow:**

1. API Gateway nhận HTTP request
2. Gateway gửi message đến queue của service target
3. Service xử lý và reply vào reply queue
4. Gateway nhận response và trả về HTTP response

**Configuration:**

- **Timeout:** 10 giây (configurable)
- **Queue:** Durable queues, TTL 60s cho RPC messages
- **Prefetch:** 1 message mỗi lần để load balancing
- **Error Handling:** RpcException được transform thành HTTP error

**Use Cases:**

- Login, authentication
- CRUD operations
- Queries cần data ngay lập tức

#### 3.2.2. Event-Driven Pattern (Pub/Sub)

**Mô tả:** Service publish events khi có sự kiện quan trọng, services khác
subscribe để react.

**Implementation với RabbitMQ Topic Exchange:**

```typescript
// Publisher (Booking Service)
this.client.emit('appointment.booked', {
  appointmentId: '...',
  patientEmail: '...',
  doctorId: '...',
  // ...
}).subscribe();

// Subscriber (Orchestrator Service)
@EventPattern('appointment.booked')
async handleAppointmentBooked(@Payload() event: AppointmentBookedEvent) {
  // Send notification
  await this.notificationClient.emit('email.send', {...});
}
```

**Configuration:**

- **Exchange Type:** Topic exchange (`medicalink.topic`)
- **Routing Keys:** Dot notation (e.g., `appointment.booked`, `user.created`)
- **TTL:** 300s cho event messages
- **Durability:** Durable queues và messages

**Event Flow Example - Appointment Booking:**

```
1. Booking Service: Tạo appointment → emit 'appointment.booked'
2. Orchestrator Service: Nhận event → dispatch notification
3. Notification Service: Nhận 'email.send' → gửi email confirmation
4. Orchestrator Service: Sync denormalized data nếu cần
```

**Benefits:**

- **Decoupling:** Services không cần biết về nhau
- **Scalability:** Nhiều consumers có thể process events
- **Reliability:** Messages được persist trong queue
- **Async Processing:** Không block main flow

#### 3.2.3. Service Mesh Pattern (Orchestration)

**Mô tả:** Orchestrator Service điều phối multi-service operations.

**Saga Pattern cho Distributed Transactions:**

```
Example: Create Doctor Flow

1. Orchestrator nhận request
2. Call Accounts Service → Create staff account
3. If success, call Provider Directory → Create doctor profile
4. If fail, compensate → Delete staff account (rollback)
5. Return final result
```

**Implementation:**

```typescript
// Orchestrator handles multi-service coordination
async createDoctor(dto: CreateDoctorDto) {
  let accountId: string;

  try {
    // Step 1: Create account
    const account = await this.accountsService.createStaff({...});
    accountId = account.id;

    // Step 2: Create doctor profile
    const doctor = await this.providerService.createDoctor({
      staffAccountId: accountId,
      ...
    });

    return { success: true, doctor };
  } catch (error) {
    // Compensating transaction
    if (accountId) {
      await this.accountsService.deleteStaff(accountId);
    }
    throw error;
  }
}
```

**Orchestrator Responsibilities:**

- Coordinate multi-service transactions
- Handle compensating transactions
- Aggregate data từ multiple services (Read Composition)
- Manage data consistency

#### 3.2.4. API Composition Pattern (CQRS)

**Mô tả:** Combine data từ nhiều services để tạo view cho client.

**Example - Doctor Composite:**

```typescript
async getDoctorComposite(doctorId: string) {
  // Parallel calls để giảm latency
  const [doctor, reviews, account] = await Promise.all([
    this.providerService.getDoctor(doctorId),
    this.contentService.getReviewsByDoctor(doctorId),
    this.accountsService.getStaffById(staffAccountId),
  ]);

  return {
    ...doctor,
    account: { fullName, email },
    rating: calculateRating(reviews),
    reviewCount: reviews.length,
  };
}
```

**Benefits:**

- Client chỉ gọi 1 endpoint thay vì nhiều endpoints
- Giảm network round-trips
- Centralized data aggregation logic

**Challenges:**

- Increased latency nếu 1 service chậm
- Error handling phức tạp (partial failures)
- Caching strategy cần cẩn thận

### 3.3. Data Architecture

#### 3.3.1. Database per Service Pattern

**Design Decision:**

- **Single PostgreSQL database** với **schema separation**
- Mỗi service có schema riêng (không phải database riêng)
- Mỗi service có Prisma client riêng

**Schema Separation:**

```
PostgreSQL Database: appdb
├── Schema: accounts     (Accounts Service)
│   ├── staff_accounts
│   ├── permissions
│   └── ...
├── Schema: provider     (Provider Directory Service)
│   ├── doctors
│   ├── specialties
│   └── ...
├── Schema: booking      (Booking Service)
│   ├── appointments
│   └── patients
├── Schema: content      (Content Service)
│   ├── blogs
│   └── reviews
└── Schema: notification (Notification Service)
    └── email_deliveries
```

**Configuration:**

```env
ACCOUNTS_DATABASE_URL=postgresql://user:pass@host:5432/appdb?schema=accounts
PROVIDER_DATABASE_URL=postgresql://user:pass@host:5432/appdb?schema=provider
BOOKING_DATABASE_URL=postgresql://user:pass@host:5432/appdb?schema=booking
# ...
```

**Why Schema Separation instead of Multiple Databases?**

**Pros:**

- Vẫn maintain service isolation
- Dễ manage hơn (1 DB instance)
- Lower infrastructure cost
- Backup/restore đơn giản hơn
- Connection pooling hiệu quả hơn

**Cons:**

- Khó scale horizontally (sharding)
- Một DB instance down → tất cả services bị ảnh hưởng
- Resource contention có thể xảy ra

**Connection Pooling:**

```typescript
// Prisma Configuration
datasource db {
  provider = "postgresql"
  url      = env("SERVICE_DATABASE_URL")
}

// Connection pool: 5 connections per service, 20s timeout
```

#### 3.3.2. Denormalized Data Strategy

**Problem:** Services không được query trực tiếp database của service khác.

**Solution:** Denormalize critical data để tránh cross-service joins.

**Example - Doctor Profile:**

```prisma
// Provider Directory Service
model Doctor {
  id              String   @id
  staffAccountId  String   @unique

  // Denormalized from Accounts Service
  fullName        String   @default("")
  isMale          Boolean? @default(true)

  // Service-specific data
  degree          String?
  introduction    String?
  // ...
}
```

**Sync Mechanism:**

```typescript
// When staff account updated in Accounts Service
@EventPattern('staff.updated')
async handleStaffUpdated(event: StaffUpdatedEvent) {
  await this.doctorRepository.update({
    where: { staffAccountId: event.staffId },
    data: {
      fullName: event.fullName,
      isMale: event.isMale,
    },
  });
}
```

**Trade-offs:**

- **Pros:** Faster queries, no cross-service calls
- **Cons:** Data duplication, eventual consistency, sync overhead

#### 3.3.3. Data Consistency Strategies

**1. Strong Consistency (Saga Pattern)**

- Dùng cho critical operations (create doctor, create appointment)
- Compensating transactions để rollback
- Orchestrator quản lý transaction flow

**2. Eventual Consistency (Event-Driven)**

- Dùng cho denormalized data sync
- Acceptable delay (seconds)
- Idempotent event handlers để handle duplicates

**3. Read-Your-Writes Consistency**

- Client có thể read data ngay sau khi write
- Achieved through direct database access (không qua services khác)

**Example - Appointment Creation:**

```typescript
// Strong consistency với Saga
async createAppointment(dto: CreateAppointmentDto) {
  // 1. Create temporary hold (event)
  const event = await this.createTempHoldEvent(dto);

  try {
    // 2. Validate patient exists or create
    const patient = await this.getOrCreatePatient(dto.patient);

    // 3. Create appointment
    const appointment = await this.appointmentRepo.create({
      patientId: patient.id,
      eventId: event.id,
      // ...
    });

    // 4. Update event to permanent
    await this.eventRepo.update({
      where: { id: event.id },
      data: { isTempHold: false },
    });

    // 5. Emit event for notification (eventual consistency)
    this.client.emit('appointment.booked', appointment);

    return appointment;
  } catch (error) {
    // Rollback: delete temp hold event
    await this.eventRepo.delete({ where: { id: event.id } });
    throw error;
  }
}
```

### 3.4. Các Service Chính

#### 3.4.1. API Gateway Service

**Kiến trúc xử lý request:**

```mermaid
flowchart TD
    A[Client Request] --> B[CORS Middleware]
    B --> C[Morgan Logging]
    C --> D[JWT Authentication Guard]
    D --> E[Permission Guard]
    E --> F[Rate Limiting]
    F --> G[Controller]
    G --> H[RabbitMQ RPC]
    H --> I[Microservices]
    I --> J[Response]
    J --> K[Error Interceptor]
    K --> L[Serializer Interceptor]
    L --> M[Client Response]

    D <-.-> N[(Redis Cache)]
    E <-.-> N
    F <-.-> N
```

**Các thành phần chính:**

| Thành phần                   | Chức năng                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| **JWT Authentication Guard** | Xác thực token JWT, kiểm tra auth version để hỗ trợ đăng xuất tất cả phiên            |
| **Permission Guard**         | Kiểm tra quyền truy cập dựa trên resource và action, sử dụng Redis cache (TTL 5 phút) |
| **Rate Limiting**            | Giới hạn số request (mặc định 100 req/phút, endpoint nhạy cảm 5-10 req/phút)          |
| **Error Interceptor**        | Chuyển đổi RpcException từ microservices thành HttpException phù hợp                  |

#### 3.4.2. Orchestrator Service

**Vai trò chính:**

```mermaid
flowchart LR
    subgraph Orchestrator
        A[Command Orchestration]
        B[Read Composition]
        C[Event Coordination]
    end

    A --> D[Saga Pattern]
    B --> E[CQRS Pattern]
    C --> F[Event Handlers]
```

**1. Command Orchestration (Saga Pattern)**

Điều phối các giao dịch phân tán với khả năng rollback. Ví dụ luồng tạo bác sĩ:

```mermaid
sequenceDiagram
    participant O as Orchestrator
    participant A as Accounts Service
    participant P as Provider Service

    O->>A: Tạo tài khoản staff
    A-->>O: Trả về accountId
    O->>P: Tạo profile bác sĩ
    P-->>O: Trả về doctorId
    O->>A: Liên kết doctorId vào account

    Note over O,P: Nếu bước nào thất bại
    O->>A: Rollback: Xóa account
    O->>P: Rollback: Xóa doctor profile
```

**2. Read Composition (CQRS Pattern)**

Tổng hợp dữ liệu từ nhiều service để trả về cho client. Các composite chính:

- **Doctor Composite:** Profile bác sĩ + thông tin tài khoản + đánh giá
- **Blog Composite:** Bài viết + thông tin tác giả + chuyên khoa
- **Appointment Composite:** Cuộc hẹn + bệnh nhân + bác sĩ + địa điểm

**3. Event Coordination**

Lắng nghe các domain event và kích hoạt side effect:

- Gửi thông báo khi có cuộc hẹn mới
- Đồng bộ dữ liệu denormalized khi thông tin staff thay đổi

#### 3.4.3. Notification Service

**Kiến trúc xử lý email:**

```mermaid
flowchart LR
    A[Event Queue] --> B[Event Handler]
    B --> C[Email Queue]
    C --> D[Email Processor]
    D --> E[(Database)]
    D --> F[SMTP Server]

    E --> G{Thành công?}
    G -->|Có| H[Cập nhật SENT]
    G -->|Không| I{Retry < 3?}
    I -->|Có| J[Exponential Backoff]
    J --> D
    I -->|Không| K[Đánh dấu FAILED]
```

**Đặc điểm chính:**

- **Xử lý hàng đợi:** Mỗi email được tạo bản ghi với trạng thái QUEUED trước khi
  xử lý
- **Template Engine:** Sử dụng Handlebars để render nội dung động
- **Cơ chế retry:** Thử lại tối đa 3 lần với exponential backoff (2s, 4s, 8s)
- **Theo dõi trạng thái:** QUEUED → SENT hoặc FAILED với thông tin lỗi

#### 3.4.4. Các Service Khác

**Accounts Service** - Quản lý tài khoản, xác thực và phân quyền cho toàn hệ
thống.

- **Authentication:** Đăng nhập, cấp phát JWT token, refresh token, đổi/quên mật
  khẩu
- **Authorization:** Hệ thống RBAC với resource-action, hỗ trợ multi-tenant và
  context-based conditions
- **User Management:** CRUD tài khoản staff (SUPER_ADMIN, ADMIN, DOCTOR), quản
  lý profile, soft delete

**Provider Directory Service** - Quản lý thông tin bác sĩ, chuyên khoa, địa điểm
và lịch làm việc.

- **Doctor Management:** CRUD profile bác sĩ, liên kết với staff account,
  denormalized data (fullName, isMale)
- **Specialty Management:** CRUD chuyên khoa với slug URL, specialty info
  sections, gán bác sĩ vào chuyên khoa
- **Work Location Management:** CRUD địa điểm khám, thông tin địa chỉ, timezone,
  Google Maps URL
- **Schedule Management:** Office hours theo tuần (global/override), tạo time
  slots khả dụng cho booking

**Booking Service** - Quản lý cuộc hẹn và thông tin bệnh nhân.

- **Patient Management:** CRUD thông tin bệnh nhân, tìm kiếm theo tên/số điện
  thoại, soft delete
- **Appointment Management:** Tạo/cập nhật cuộc hẹn, quản lý vòng đời trạng thái
  (BOOKED → CONFIRMED → COMPLETED)
- **Event Management:** Tạo scheduling events, temporary hold với expiration,
  conflict detection

**Content Service** - Quản lý nội dung y tế bao gồm blog, hỏi đáp và đánh giá.

- **Blog Management:** CRUD bài viết, danh mục, trạng thái (DRAFT → PUBLISHED →
  ARCHIVED), view count
- **Q&A System:** Bệnh nhân đặt câu hỏi, bác sĩ trả lời, trạng thái (PENDING →
  ANSWERED → CLOSED)
- **Review System:** Đánh giá bác sĩ với rating 1-5 sao, anonymous/public toggle
- **Asset Management:** Lưu trữ metadata assets (ảnh, file), polymorphic
  association với Cloudinary

### 3.5. Bảo mật và Xác thực

#### 3.5.1. Luồng xác thực

**Luồng đăng nhập:**

```mermaid
sequenceDiagram
    participant C as Client
    participant G as API Gateway
    participant A as Accounts Service

    C->>G: POST /api/auth/login {email, password}
    G->>A: RPC auth.login
    A->>A: Xác thực mật khẩu (bcrypt)
    A->>A: Tạo JWT tokens
    A-->>G: Access Token (15 phút) + Refresh Token (7 ngày)
    G-->>C: 200 OK {accessToken, refreshToken}
```

**Cấu trúc JWT Token:**

| Trường  | Mô tả                                     |
| ------- | ----------------------------------------- |
| userId  | ID tài khoản staff                        |
| email   | Email đăng nhập                           |
| role    | Vai trò: SUPER_ADMIN, ADMIN, DOCTOR       |
| version | Phiên bản xác thực (để vô hiệu hóa token) |
| iat     | Thời điểm phát hành                       |
| exp     | Thời điểm hết hạn                         |

**Cơ chế Auth Version:**

Khi người dùng đổi mật khẩu hoặc admin thu hồi quyền truy cập, hệ thống tăng
version trong bảng auth_versions. Mọi token cũ sẽ bị từ chối vì version không
khớp.

#### 3.5.2. Hệ thống phân quyền (RBAC)

**Mô hình phân quyền:**

```mermaid
flowchart TD
    U[User] --> UP[User Permission]
    U --> UG[User Group]
    UG --> G[Group]
    G --> GP[Group Permission]
    UP --> P[Permission]
    GP --> P
    P --> R[Resource + Action]
```

**Các thành phần:**

- **Resource:** Tài nguyên (appointments, doctors, blogs...)
- **Action:** Hành động (read, write, delete, publish...)
- **Effect:** ALLOW hoặc DENY (DENY ưu tiên hơn)
- **Conditions:** Điều kiện ngữ cảnh dạng JSON (tùy chọn)

**Thuật toán kiểm tra quyền:**

1. Lấy quyền trực tiếp của user
2. Lấy quyền từ các group mà user tham gia
3. Nếu có DENY → từ chối ngay
4. Nếu có ALLOW (và thỏa conditions) → cho phép
5. Ngược lại → từ chối

**Caching:** Kết quả kiểm tra quyền được cache trong Redis với TTL 5 phút, tự
động xóa khi quyền thay đổi.

#### 3.5.3. Các biện pháp bảo mật

| Biện pháp            | Mô tả                                                   |
| -------------------- | ------------------------------------------------------- |
| **Mã hóa mật khẩu**  | Sử dụng bcrypt với salt rounds = 10                     |
| **Xác thực đầu vào** | ValidationPipe với whitelist, forbidNonWhitelisted      |
| **Giới hạn tốc độ**  | Rate limiting với Redis storage cho môi trường phân tán |
| **CORS**             | Cấu hình origin cho phép, credentials, methods          |
| **Secure Headers**   | Sử dụng Helmet để thiết lập các header bảo mật          |

### 3.6. Đảm bảo tính nhất quán dữ liệu

#### 3.6.1. Các mức độ nhất quán

**1. Strong Consistency (Saga Pattern)**

Dùng cho các giao dịch nghiệp vụ quan trọng yêu cầu "tất cả hoặc không gì cả".

```mermaid
flowchart TD
    A[Bắt đầu] --> B[Tạo Event tạm giữ]
    B --> C{Kiểm tra xung đột?}
    C -->|Có| R1[Rollback: Xóa Event]
    C -->|Không| D[Tạo/Lấy Patient]
    D --> E[Tạo Appointment]
    E --> F[Chuyển Event thành cố định]
    F --> G[Phát sự kiện appointment.booked]
    G --> H[Hoàn thành]

    E -->|Lỗi| R2[Rollback: Xóa Appointment, Event]
    R1 --> X[Thất bại]
    R2 --> X
```

**2. Eventual Consistency (Event-Driven)**

Dùng cho các cập nhật không quan trọng như đồng bộ dữ liệu denormalized.

Khi thông tin staff được cập nhật → Phát sự kiện staff.updated → Orchestrator
cập nhật Doctor profile → Có thể retry nếu thất bại

**Đảm bảo eventual consistency:**

- **At-least-once delivery:** RabbitMQ durable queues
- **Idempotent handlers:** Xử lý trùng lặp event
- **Retry mechanism:** Exponential backoff
- **Dead letter queue:** Xử lý thủ công các message thất bại

**3. Causal Consistency**

Dùng khi các thao tác phụ thuộc vào nhau phải được xử lý theo thứ tự. Ví dụ:
Vòng đời trạng thái cuộc hẹn được quản lý bằng state machine:

```mermaid
stateDiagram-v2
    [*] --> BOOKED
    BOOKED --> CONFIRMED
    BOOKED --> CANCELLED_BY_PATIENT
    BOOKED --> CANCELLED_BY_STAFF
    CONFIRMED --> COMPLETED
    CONFIRMED --> NO_SHOW
    CONFIRMED --> CANCELLED_BY_STAFF
    RESCHEDULED --> CONFIRMED
    RESCHEDULED --> CANCELLED_BY_PATIENT
```

#### 3.6.2. Các pattern quản lý giao dịch phân tán

**Saga Pattern (được sử dụng):**

| Loại                    | Mô tả                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| **Orchestration-based** | Orchestrator điều khiển toàn bộ luồng giao dịch và compensating transactions   |
| **Choreography-based**  | Các service phản ứng với event và phát event mới, không có điều phối trung tâm |

**Two-Phase Commit:** Không sử dụng do quá phức tạp và overhead cao.

#### 3.6.3. Giải quyết xung đột

| Phương pháp            | Mô tả                                                                 | Sử dụng khi                                     |
| ---------------------- | --------------------------------------------------------------------- | ----------------------------------------------- |
| **Optimistic Locking** | Kiểm tra version trước khi cập nhật, thất bại nếu version đã thay đổi | Cần đảm bảo không ghi đè dữ liệu của người khác |
| **Last-Write-Wins**    | Cập nhật cuối cùng thắng, không kiểm tra version                      | Đơn giản, chấp nhận được việc ghi đè            |

#### 3.6.4. Đảm bảo Idempotency

**Vấn đề:** Event có thể được gửi nhiều lần (at-least-once delivery).

**Giải pháp:**

| Giải pháp               | Mô tả                                                                  |
| ----------------------- | ---------------------------------------------------------------------- |
| **Idempotency Key**     | Client gửi kèm key duy nhất, server cache kết quả 24 giờ               |
| **Natural Idempotency** | Thiết kế thao tác tự nhiên idempotent (gọi nhiều lần cho cùng kết quả) |
| **Deduplication Table** | Lưu eventId đã xử lý, bỏ qua nếu đã tồn tại                            |

---

## 4. KẾT LUẬN

### 4.1. Ưu điểm của thiết kế

1. **Scalability:** Mỗi service có thể scale độc lập
2. **Maintainability:** Clear separation of concerns
3. **Resilience:** Fault isolation giữa các services
4. **Flexibility:** Dễ thay đổi/nâng cấp từng service
5. **Team Autonomy:** Các team có thể làm việc độc lập

### 4.2. Thách thức & Trade-offs

1. **Complexity:** Distributed system phức tạp hơn monolith
2. **Network Latency:** Cross-service calls có overhead
3. **Data Consistency:** Eventual consistency có thể gây confusion
4. **Testing:** E2E testing phức tạp
5. **Debugging:** Distributed tracing cần thiết

### 4.3. Hướng phát triển

1. **Monitoring & Observability:**
   - Distributed tracing (Jaeger, Zipkin)
   - Metrics collection (Prometheus)
   - Centralized logging (ELK stack)

2. **Resilience:**
   - Circuit breaker pattern
   - Retry with exponential backoff
   - Bulkhead pattern

3. **Performance:**
   - Caching strategies (Redis)
   - Database indexing optimization
   - Query optimization

4. **DevOps:**
   - CI/CD pipeline
   - Container orchestration (Kubernetes)
   - Auto-scaling policies

---

**Người viết:** Claude Code với Serena MCP **Ngày:** 2025-11-27 **Dự án:**
MedicaLink Microservices System
