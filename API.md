# API Documentation

Job Application AI Agent RESTful API endpoints.

## Authentication

All endpoints (except `/api/auth/*`) require a valid NextAuth session. Include the session cookie in requests.

## Endpoints

### Authentication

#### `POST /api/auth/signin`
Sign in with Google OAuth.

**Parameters:**
- `provider`: "google"
- `redirect`: false

**Response:**
```json
{
  "url": "https://accounts.google.com/o/oauth2/auth?...",
  "ok": true
}
```

#### `POST /api/auth/signout`
Sign out and destroy session.

**Response:**
```json
{
  "url": "/"
}
```

#### `GET /api/auth/session`
Get current session information.

**Response:**
```json
{
  "user": {
    "email": "user@example.com",
    "name": "User Name",
    "image": null
  },
  "expires": "2026-10-18T..."
}
```

### Jobs

#### `POST /api/jobs/search`
Search for jobs based on keywords and location.

**Request Body:**
```json
{
  "keywords": ["React", "Next.js", "TypeScript"],
  "location": "Remote"
}
```

**Response:**
```json
{
  "success": true,
  "count": 12,
  "jobs": [
    {
      "id": "job-123",
      "title": "Senior React Developer",
      "company": "Tech Corp",
      "location": "San Francisco, CA",
      "description": "...",
      "url": "https://...",
      "source": "linkedin",
      "salary": "$150k-$200k",
      "jobType": "full-time",
      "seniority": "senior",
      "matchScore": 85,
      "applied": false,
      "foundAt": "2026-09-18T..."
    }
  ]
}
```

**Status Codes:**
- 200: Success
- 400: Missing keywords
- 401: Unauthorized
- 500: Search failed

#### `POST /api/jobs/apply`
Apply to a specific job.

**Request Body:**
```json
{
  "jobId": "job-123"
}
```

**Response:**
```json
{
  "success": true,
  "application": {
    "id": "app-456",
    "jobId": "job-123",
    "status": "applied",
    "appliedAt": "2026-09-18T...",
    "applicationUrl": "https://..."
  },
  "requiresManualApproval": false
}
```

**Status Codes:**
- 200: Applied successfully
- 400: Job not found or already applied
- 401: Unauthorized
- 500: Application failed

### Gmail Integration

#### `POST /api/gmail/sync`
Sync job-related emails from Gmail.

**Response:**
```json
{
  "success": true,
  "emailsSync": 5,
  "emails": [
    {
      "id": "email-789",
      "gmailMessageId": "msg-abc",
      "from": "hr@company.com",
      "subject": "Interview Scheduled",
      "emailType": "interview",
      "receivedAt": "2026-09-18T...",
      "isRead": false
    }
  ],
  "notifications": [
    {
      "id": "notif-123",
      "type": "interview",
      "title": "Interview: Senior React Developer at Tech Corp",
      "message": "From: hr@company.com"
    }
  ]
}
```

**Status Codes:**
- 200: Sync successful
- 400: Gmail not connected
- 401: Unauthorized
- 500: Sync failed

#### `GET /api/gmail/status`
Check Gmail connection status.

**Response:**
```json
{
  "connected": true,
  "email": "user@gmail.com",
  "lastSync": "2026-09-18T12:00:00Z"
}
```

#### `DELETE /api/gmail/status`
Disconnect Gmail account.

**Response:**
```json
{
  "success": true,
  "message": "Gmail disconnected"
}
```

**Status Codes:**
- 200: Disconnected successfully
- 401: Unauthorized
- 500: Disconnect failed

### Dashboard

#### `GET /api/dashboard/stats`
Get dashboard statistics and recent activity.

**Response:**
```json
{
  "stats": {
    "totalJobs": 45,
    "appliedJobs": 12,
    "interviews": 3,
    "assessments": 2,
    "rejections": 4,
    "offers": 1,
    "savedJobs": 8,
    "unreadNotifications": 2,
    "gmailConnected": true
  },
  "recentApplications": [
    {
      "id": "app-456",
      "status": "interview",
      "appliedAt": "2026-09-15T...",
      "job": {
        "id": "job-123",
        "title": "Senior React Developer",
        "company": "Tech Corp",
        "url": "https://..."
      }
    }
  ],
  "recentEmails": [
    {
      "id": "email-789",
      "from": "hr@company.com",
      "subject": "Interview Scheduled",
      "emailType": "interview",
      "receivedAt": "2026-09-18T..."
    }
  ],
  "user": {
    "email": "user@example.com",
    "name": "User Name",
    "cvUrl": "https://...",
    "portfolioUrl": "https://..."
  }
}
```

### User Profile

#### `GET /api/user/profile`
Get user profile information.

**Response:**
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "name": "User Name",
  "image": null,
  "cvUrl": "https://...",
  "portfolioUrl": "https://...",
  "connectedProviders": ["google"]
}
```

#### `PUT /api/user/profile`
Update user profile.

**Request Body:**
```json
{
  "name": "Updated Name",
  "cvUrl": "https://new-cv-url.com",
  "portfolioUrl": "https://portfolio.com"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "Updated Name",
    "cvUrl": "https://new-cv-url.com",
    "portfolioUrl": "https://portfolio.com"
  }
}
```

**Status Codes:**
- 200: Profile updated
- 401: Unauthorized
- 500: Update failed

## Error Responses

### Standard Error Format
```json
{
  "error": "Error message describing what went wrong"
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (missing/invalid parameters) |
| 401 | Unauthorized (not signed in) |
| 404 | Resource not found |
| 500 | Server error |

## Rate Limiting

- No rate limiting in development
- Production deployment should implement rate limiting
- Recommended: 100 requests per minute per user

## Request Headers

```
Content-Type: application/json
Cookie: __Secure-next-auth.session-token=...
```

## Response Headers

```
Content-Type: application/json
Set-Cookie: __Secure-next-auth.session-token=...
```

## Pagination

Pagination will be added in a future version.

## Data Types

### Job
```typescript
{
  id: string
  userId: string
  title: string
  company: string
  location?: string
  description?: string
  url: string
  source: string
  salary?: string
  jobType?: string
  seniority?: string
  skills?: string[]
  matchScore?: number
  applied: boolean
  foundAt: Date
  appliedAt?: Date
  createdAt: Date
  updatedAt: Date
}
```

### JobApplication
```typescript
{
  id: string
  jobId: string
  userId: string
  status: 'applied' | 'interview' | 'assessment' | 'rejected' | 'offer'
  appliedAt: Date
  applicationUrl?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}
```

### JobEmail
```typescript
{
  id: string
  userId: string
  jobId: string
  applicationId?: string
  gmailMessageId: string
  from: string
  subject: string
  body?: string
  emailType: 'confirmation' | 'interview' | 'assessment' | 'rejection' | 'offer' | 'other'
  isRead: boolean
  receivedAt: Date
  createdAt: Date
  updatedAt: Date
}
```

## Usage Examples

### Search for Jobs
```bash
curl -X POST http://localhost:3000/api/jobs/search \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["React", "Next.js"], "location": "Remote"}'
```

### Apply to a Job
```bash
curl -X POST http://localhost:3000/api/jobs/apply \
  -H "Content-Type: application/json" \
  -d '{"jobId": "job-123"}'
```

### Sync Gmail
```bash
curl -X POST http://localhost:3000/api/gmail/sync \
  -H "Content-Type: application/json"
```

### Get Dashboard Stats
```bash
curl http://localhost:3000/api/dashboard/stats
```

## WebSocket (Planned)

Real-time notifications via WebSocket will be added in version 2.0.

## GraphQL (Planned)

GraphQL API option will be added in version 2.0 for advanced queries.

## Webhooks (Planned)

Webhook support for external integrations planned for version 2.0.
