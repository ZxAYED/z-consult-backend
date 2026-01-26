# Appointment Queue Management Backend

<p align="left">
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-6.19-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Swagger-OpenAPI-22C55E?style=flat-square&logo=swagger&logoColor=white" alt="Swagger" />
  <img src="https://img.shields.io/badge/JWT-Auth-0F172A?style=flat-square&logo=jsonwebtokens&logoColor=white" alt="JWT" />
</p>

A production-ready NestJS + Prisma backend for appointment scheduling, queue assignment, and admin analytics.

## Highlights
- Smart staff eligibility checks (capacity + conflicts) with deterministic sorting.
- Queue auto-assignment with transaction-safe updates to avoid race conditions.
- JWT access + refresh tokens with httpOnly refresh cookies.
- Admin dashboard summary metrics and recent activity snapshots.
- Consistent response envelope and normalized error handling.
- Swagger docs at `/docs`.

## Use Cases
- Clinics and hospitals
- Salons and service centers
- Support desks and intake queues
- Any workflow that needs fair staff load balancing

## Quickstart
1) Start Postgres
```bash
docker compose -f docker-compose.yml up -d
```

2) Install dependencies
```bash
npm install
```

3) Run migrations
```bash
npx prisma migrate dev
```

4) Start the API
```bash
npm run start:dev
```

5) Open docs
```text
http://localhost:3000/docs
```

## Environment Variables
<table>
  <thead>
    <tr bgcolor="#D1FAE5">
      <th align="left">Variable</th>
      <th align="left">Required</th>
      <th align="left">Default</th>
      <th align="left">Purpose</th>
    </tr>
  </thead>
  <tbody>
    <tr bgcolor="#FFFFFF">
      <td><code>DATABASE_URL</code></td>
      <td>Yes</td>
      <td>-</td>
      <td>PostgreSQL connection string</td>
    </tr>
    <tr bgcolor="#ECFDF3">
      <td><code>JWT_SECRET</code></td>
      <td>Yes</td>
      <td>-</td>
      <td>Base JWT secret for module config</td>
    </tr>
    <tr bgcolor="#FFFFFF">
      <td><code>JWT_ACCESS_SECRET</code></td>
      <td>No</td>
      <td>access-secret</td>
      <td>Access token signing secret</td>
    </tr>
    <tr bgcolor="#ECFDF3">
      <td><code>JWT_REFRESH_SECRET</code></td>
      <td>No</td>
      <td>refresh-secret</td>
      <td>Refresh token signing secret</td>
    </tr>
    <tr bgcolor="#FFFFFF">
      <td><code>JWT_EXPIRES_IN</code></td>
      <td>No</td>
      <td>15m</td>
      <td>Default JWT expiry used by Nest JWT module</td>
    </tr>
    <tr bgcolor="#ECFDF3">
      <td><code>PORT</code></td>
      <td>No</td>
      <td>3000</td>
      <td>API port</td>
    </tr>
    <tr bgcolor="#FFFFFF">
      <td><code>TZ_OFFSET_MINUTES</code></td>
      <td>No</td>
      <td>360</td>
      <td>Local business day offset for queue and appointments</td>
    </tr>
    <tr bgcolor="#ECFDF3">
      <td><code>SUPABASE_URL</code></td>
      <td>No</td>
      <td>-</td>
      <td>Supabase storage (only needed if using storage helpers)</td>
    </tr>
    <tr bgcolor="#FFFFFF">
      <td><code>SUPABASE_ANON_KEY</code></td>
      <td>No</td>
      <td>-</td>
      <td>Supabase storage key (only needed if using storage helpers)</td>
    </tr>
    <tr bgcolor="#ECFDF3">
      <td><code>NODE_ENV</code></td>
      <td>No</td>
      <td>-</td>
      <td>Set to <code>production</code> to enable secure refresh cookies</td>
    </tr>
  </tbody>
</table>

## Dashboard Routes (Green Badges)
<table>
  <thead>
    <tr bgcolor="#D1FAE5">
      <th align="left">Route</th>
      <th align="left">Method</th>
      <th align="left">Auth</th>
      <th align="left">Role</th>
      <th align="left">Notes</th>
    </tr>
  </thead>
  <tbody>
    <tr bgcolor="#FFFFFF">
      <td><code>/dashboard/summary</code></td>
      <td><img src="https://img.shields.io/badge/Method-GET-2E7D32?style=flat-square" alt="GET" /></td>
      <td><img src="https://img.shields.io/badge/Auth-Bearer-2E7D32?style=flat-square" alt="Bearer" /></td>
      <td><img src="https://img.shields.io/badge/Role-ADMIN-1B5E20?style=flat-square" alt="ADMIN" /></td>
      <td>Optional query: <code>?date=YYYY-MM-DD</code></td>
    </tr>
  </tbody>
</table>

## API Routes (Zig-Zag Table Background)
<table>
  <thead>
    <tr bgcolor="#D1FAE5">
      <th align="left">Area</th>
      <th align="left">Method</th>
      <th align="left">Path</th>
      <th align="left">Auth</th>
      <th align="left">Role</th>
      <th align="left">Notes</th>
    </tr>
  </thead>
  <tbody>
    <tr bgcolor="#FFFFFF">
      <td>App</td>
      <td><img src="https://img.shields.io/badge/GET-2563EB?style=flat-square" alt="GET" /></td>
      <td><code>/</code></td>
      <td>Public</td>
      <td>-</td>
      <td>Health/greeting</td>
    </tr>
    <tr bgcolor="#ECFDF3">
      <td>App</td>
      <td><img src="https://img.shields.io/badge/GET-2563EB?style=flat-square" alt="GET" /></td>
      <td><code>/me</code></td>
      <td>Bearer</td>
      <td>-</td>
      <td>Current user</td>
    </tr>
    <tr bgcolor="#FFFFFF">
      <td>App</td>
      <td><img src="https://img.shields.io/badge/GET-2563EB?style=flat-square" alt="GET" /></td>
      <td><code>/admin</code></td>
      <td>Bearer</td>
      <td>ADMIN</td>
      <td>Admin-only sanity check</td>
    </tr>
    <tr bgcolor="#ECFDF3">
      <td>Auth</td>
      <td><img src="https://img.shields.io/badge/POST-16A34A?style=flat-square" alt="POST" /></td>
      <td><code>/auth/register</code></td>
      <td>Public</td>
      <td>-</td>
      <td>Creates an ADMIN user by default</td>
    </tr>
    <tr bgcolor="#FFFFFF">
      <td>Auth</td>
      <td><img src="https://img.shields.io/badge/POST-16A34A?style=flat-square" alt="POST" /></td>
      <td><code>/auth/login</code></td>
      <td>Public</td>
      <td>-</td>
      <td>Sets refresh cookie</td>
    </tr>
    <tr bgcolor="#ECFDF3">
      <td>Auth</td>
      <td><img src="https://img.shields.io/badge/POST-16A34A?style=flat-square" alt="POST" /></td>
      <td><code>/auth/refresh</code></td>
      <td>Public</td>
      <td>-</td>
      <td>Refresh access token</td>
    </tr>
    <tr bgcolor="#FFFFFF">
      <td>Auth</td>
      <td><img src="https://img.shields.io/badge/GET-2563EB?style=flat-square" alt="GET" /></td>
      <td><code>/auth/me</code></td>
      <td>Bearer</td>
      <td>-</td>
      <td>User profile</td>
    </tr>
    <tr bgcolor="#ECFDF3">
      <td>Appointments</td>
      <td><img src="https://img.shields.io/badge/GET-2563EB?style=flat-square" alt="GET" /></td>
      <td><code>/appointments/eligible-staff</code></td>
      <td>Bearer</td>
      <td>ADMIN</td>
      <td>Capacity and conflict-aware staff list</td>
    </tr>
    <tr bgcolor="#FFFFFF">
      <td>Appointments</td>
      <td><img src="https://img.shields.io/badge/POST-16A34A?style=flat-square" alt="POST" /></td>
      <td><code>/appointments</code></td>
      <td>Bearer</td>
      <td>ADMIN</td>
      <td>Create appointment (auto-assign if possible)</td>
    </tr>
    <tr bgcolor="#ECFDF3">
      <td>Appointments</td>
      <td><img src="https://img.shields.io/badge/GET-2563EB?style=flat-square" alt="GET" /></td>
      <td><code>/appointments</code></td>
      <td>Bearer</td>
      <td>ADMIN</td>
      <td>List with pagination and filters</td>
    </tr>
    <tr bgcolor="#FFFFFF">
      <td>Appointments</td>
      <td><img src="https://img.shields.io/badge/GET-2563EB?style=flat-square" alt="GET" /></td>
      <td><code>/appointments/:id</code></td>
      <td>Bearer</td>
      <td>ADMIN</td>
      <td>Details</td>
    </tr>
    <tr bgcolor="#ECFDF3">
      <td>Appointments</td>
      <td><img src="https://img.shields.io/badge/PATCH-0EA5E9?style=flat-square" alt="PATCH" /></td>
      <td><code>/appointments/:id</code></td>
      <td>Bearer</td>
      <td>ADMIN</td>
      <td>Update appointment or reassign staff</td>
    </tr>
    <tr bgcolor="#FFFFFF">
      <td>Appointments</td>
      <td><img src="https://img.shields.io/badge/POST-16A34A?style=flat-square" alt="POST" /></td>
      <td><code>/appointments/:id/cancel</code></td>
      <td>Bearer</td>
      <td>ADMIN</td>
      <td>Cancel (updates queue if needed)</td>
    </tr>
    <tr bgcolor="#ECFDF3">
      <td>Services</td>
      <td><img src="https://img.shields.io/badge/POST-16A34A?style=flat-square" alt="POST" /></td>
      <td><code>/services</code></td>
      <td>Bearer</td>
      <td>ADMIN</td>
      <td>Create service</td>
    </tr>
    <tr bgcolor="#FFFFFF">
      <td>Services</td>
      <td><img src="https://img.shields.io/badge/GET-2563EB?style=flat-square" alt="GET" /></td>
      <td><code>/services</code></td>
      <td>Bearer</td>
      <td>-</td>
      <td>List services with pagination</td>
    </tr>
    <tr bgcolor="#ECFDF3">
      <td>Services</td>
      <td><img src="https://img.shields.io/badge/GET-2563EB?style=flat-square" alt="GET" /></td>
      <td><code>/services/:id</code></td>
      <td>Bearer</td>
      <td>-</td>
      <td>Service details</td>
    </tr>
    <tr bgcolor="#FFFFFF">
      <td>Services</td>
      <td><img src="https://img.shields.io/badge/PATCH-0EA5E9?style=flat-square" alt="PATCH" /></td>
      <td><code>/services/:id</code></td>
      <td>Bearer</td>
      <td>ADMIN</td>
      <td>Update service</td>
    </tr>
    <tr bgcolor="#ECFDF3">
      <td>Services</td>
      <td><img src="https://img.shields.io/badge/DELETE-DC2626?style=flat-square" alt="DELETE" /></td>
      <td><code>/services/:id</code></td>
      <td>Bearer</td>
      <td>ADMIN</td>
      <td>Delete service</td>
    </tr>
    <tr bgcolor="#FFFFFF">
      <td>Staff</td>
      <td><img src="https://img.shields.io/badge/POST-16A34A?style=flat-square" alt="POST" /></td>
      <td><code>/staff</code></td>
      <td>Bearer</td>
      <td>ADMIN</td>
      <td>Create staff</td>
    </tr>
    <tr bgcolor="#ECFDF3">
      <td>Staff</td>
      <td><img src="https://img.shields.io/badge/GET-2563EB?style=flat-square" alt="GET" /></td>
      <td><code>/staff</code></td>
      <td>Bearer</td>
      <td>ADMIN</td>
      <td>List staff with pagination</td>
    </tr>
    <tr bgcolor="#FFFFFF">
      <td>Staff</td>
      <td><img src="https://img.shields.io/badge/GET-2563EB?style=flat-square" alt="GET" /></td>
      <td><code>/staff/:id</code></td>
      <td>Bearer</td>
      <td>ADMIN</td>
      <td>Staff details</td>
    </tr>
    <tr bgcolor="#ECFDF3">
      <td>Staff</td>
      <td><img src="https://img.shields.io/badge/PATCH-0EA5E9?style=flat-square" alt="PATCH" /></td>
      <td><code>/staff/:id</code></td>
      <td>Bearer</td>
      <td>ADMIN</td>
      <td>Update staff</td>
    </tr>
    <tr bgcolor="#FFFFFF">
      <td>Staff</td>
      <td><img src="https://img.shields.io/badge/DELETE-DC2626?style=flat-square" alt="DELETE" /></td>
      <td><code>/staff/:id</code></td>
      <td>Bearer</td>
      <td>ADMIN</td>
      <td>Delete staff</td>
    </tr>
    <tr bgcolor="#ECFDF3">
      <td>Queue</td>
      <td><img src="https://img.shields.io/badge/GET-2563EB?style=flat-square" alt="GET" /></td>
      <td><code>/queue</code></td>
      <td>Bearer</td>
      <td>ADMIN</td>
      <td>Active queue ordered by time</td>
    </tr>
    <tr bgcolor="#FFFFFF">
      <td>Queue</td>
      <td><img src="https://img.shields.io/badge/POST-16A34A?style=flat-square" alt="POST" /></td>
      <td><code>/queue/assign</code></td>
      <td>Bearer</td>
      <td>ADMIN</td>
      <td>Assign next eligible appointment</td>
    </tr>
  </tbody>
</table>

## Response Envelope
```json
{
  "success": true,
  "message": "Appointments fetched successfully",
  "data": {
    "data": [],
    "meta": {
      "currentPage": 1,
      "perPage": 10,
      "totalItems": 0,
      "totalPages": 0,
      "pageItemCount": 0,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

## Project Structure
- `src/auth` - signup, login, refresh, profile
- `src/appointments` - scheduling, validation, and queue sync
- `src/queue` - active queue and assignment logic
- `src/dashboard` - summary metrics and staff load
- `src/staff` - staff management and availability
- `src/services` - service catalog and durations
- `src/common` - guards, filters, interceptors
- `prisma` - schema and migrations

## Docker
- `docker-compose.yml` for local Postgres
- `Dockerfile` for multi-stage production builds
- `compose.yaml` runs the app container (includes Redis service for future use)

## Testing and Quality
```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

## If You Are Reviewing This For A Role
- Business rules are encoded in the service layer with explicit validation.
- Queue assignment is safe under concurrency using transaction checks.
- API responses and errors are normalized for frontend reliability.
- The codebase is modular, testable, and ready for extension.

---

If you want a guided walkthrough or a live demo, I can provide one quickly.
