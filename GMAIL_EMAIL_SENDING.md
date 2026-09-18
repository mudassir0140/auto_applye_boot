# Gmail Email Sending Feature

## Overview

This feature allows the Job Application AI Agent to send personalized application emails directly through the user's Gmail account using secure OAuth 2.0. Emails are sent from the user's own Gmail address to recruiters, with automatic inclusion of CV and portfolio links.

## Features

✅ **Secure OAuth 2.0** - Uses `gmail.send` scope, never stores passwords
✅ **Personalized Emails** - Generates custom emails per job with company/role details
✅ **User Information Included** - Automatically includes CV URL and portfolio URL
✅ **HTML & Plain Text** - Professional HTML formatting with plain text fallback
✅ **Audit Trail** - Records when emails are sent to recruiters
✅ **Error Handling** - Graceful error messages if Gmail isn't connected
✅ **Production Ready** - Tested with Next.js 14, Google APIs, and Prisma

## How It Works

### 1. OAuth Scope Addition
The authentication now includes `gmail.send` scope in addition to `gmail.readonly`:

```typescript
scope: 'openid email profile gmail.readonly gmail.send'
```

This requires users to grant an additional permission when connecting Gmail:
- "Send emails on your behalf"

### 2. Email Generation
When sending an application email, the system:
1. Retrieves user's profile (name, email, CV URL, portfolio URL)
2. Fetches job details (title, company)
3. Generates personalized HTML email with professional formatting
4. Includes links to CV and portfolio

### 3. Email Sending
The email is sent through Gmail API:
1. Email is encoded in RFC 2822 format
2. Sent via Google's Gmail API using user's access token
3. Marked as from user's email address
4. Stored in user's Gmail "Sent" folder automatically

### 4. Record Keeping
After successful send:
1. Job application record is updated with send timestamp
2. Notification is created for user
3. Email tracking information stored for future reference

## API Endpoint

### POST /api/gmail/send-application

**Authentication**: Requires NextAuth session

**Request Body**:
```json
{
  "jobId": "string - Job ID to apply for",
  "recruiterEmail": "string - Recruiter's email address",
  "recruiterName": "string - Recruiter's name (optional)"
}
```

**Response Success**:
```json
{
  "success": true,
  "messageId": "string - Gmail message ID",
  "message": "Application email sent to {email}"
}
```

**Response Error**:
```json
{
  "error": "string - Error message",
  "details": "string - Additional error details (optional)"
}
```

**Status Codes**:
- `200` - Email sent successfully
- `400` - Missing required fields or Gmail not connected
- `401` - User not authenticated
- `404` - User or job not found
- `500` - Server error during email send

## Email Template

### HTML Email Format

Professional email template includes:
- Personalized greeting (with recruiter name if provided)
- Compelling introductory paragraph
- Statement of interest in the specific position
- Section highlighting user's value proposition
- Professional link section with:
  - Email address
  - CV/Resume link (if available)
  - Portfolio link (if available)
- Professional closing
- User's full name signature

### Plain Text Fallback

Plain text version of the same email for email clients that don't support HTML.

## Implementation Details

### Files Modified

1. **src/lib/auth.ts**
   - Added `gmail.send` to OAuth scopes
   - Updated diagnostic logging to show email sending capability

2. **src/lib/gmail.ts**
   - `sendApplicationEmail()` - Sends raw email via Gmail API
   - `getAccountEmail()` - Retrieves connected Gmail address
   - `generateApplicationEmail()` - Creates personalized email template

### Files Created

1. **src/app/api/gmail/send-application/route.ts**
   - Handles email sending requests
   - Validates job and user
   - Creates notification records

## Security Features

✅ **Server-Side Only** - Gmail send scope never exposed to browser
✅ **OAuth Tokens** - Email sending uses stored access tokens
✅ **Session Validation** - Requires valid NextAuth session
✅ **User Isolation** - Can only send emails for own jobs
✅ **No Password Storage** - Uses OAuth 2.0, never stores credentials
✅ **Rate Limiting Ready** - Can be enhanced with rate limiting middleware
✅ **Audit Logging** - All emails tracked in application records

## Usage Examples

### Basic Email Send

```typescript
// Client-side
const response = await fetch('/api/gmail/send-application', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jobId: 'job-123',
    recruiterEmail: 'recruiter@company.com',
    recruiterName: 'John Hiring Manager'
  })
})

const data = await response.json()
if (data.success) {
  console.log('Email sent successfully')
  console.log('Message ID:', data.messageId)
}
```

### Integration with Job Apply Flow

The email can be sent after creating a job application:

```typescript
// 1. Apply to job
const applyResponse = await fetch('/api/jobs/apply', {
  method: 'POST',
  body: JSON.stringify({ jobId: 'job-123' })
})

// 2. Send application email
if (applyResponse.ok) {
  const emailResponse = await fetch('/api/gmail/send-application', {
    method: 'POST',
    body: JSON.stringify({
      jobId: 'job-123',
      recruiterEmail: 'recruiter@company.com'
    })
  })
}
```

## Environment Requirements

### OAuth Scopes (Google Cloud Console)

The following scopes must be configured:
- `openid` - OpenID Connect
- `email` - User's email address
- `profile` - User's profile information
- `https://www.googleapis.com/auth/gmail.readonly` - Read Gmail
- `https://www.googleapis.com/auth/gmail.send` - Send emails

### Database

Requires existing `jobApplication` table to store email send records.

### Environment Variables

Same as standard OAuth setup:
- `GOOGLE_CLIENT_ID` - From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- `NEXTAUTH_URL` - Your application URL
- `NEXTAUTH_SECRET` - Generated secret for NextAuth

## Testing

### Manual Testing

1. **Setup**: Ensure Gmail is connected in Settings
2. **Send Email**: 
   ```bash
   curl -X POST http://localhost:3000/api/gmail/send-application \
     -H "Content-Type: application/json" \
     -d '{"jobId":"test-job-id","recruiterEmail":"test@example.com"}'
   ```
3. **Verify**: Check Gmail "Sent" folder for the email

### Test Cases

- ✓ Send email with recruiter name
- ✓ Send email without recruiter name
- ✓ Include CV URL in email
- ✓ Include portfolio URL in email
- ✓ Error when Gmail not connected
- ✓ Error when job not found
- ✓ Error when user not authenticated
- ✓ Notification created after send
- ✓ Application record updated

## Error Scenarios

### Gmail Not Connected
```
Error: "Gmail not connected. Please connect Gmail in settings."
Status: 400
```

**Solution**: User must connect Gmail account in Settings page first.

### Invalid Gmail Credentials
```
Error: "Gmail not connected or access token expired"
Status: 400
```

**Solution**: Disconnect and reconnect Gmail in Settings to refresh tokens.

### Job Not Found
```
Error: "Job not found"
Status: 404
```

**Solution**: Verify job ID is correct and belongs to current user.

### Gmail API Error
```
Error: "Failed to send email: {specific error}"
Status: 500
```

**Solution**: Check Google Cloud Console for API limits or enable Gmail API.

## Permissions & Consent Screen

### User Permission Flow

1. User connects Gmail in Settings
2. Google shows OAuth consent screen with scopes:
   - "See your email address"
   - "See your profile information"
   - "Read your Gmail"
   - "Send emails on your behalf" ← New
3. User grants permissions
4. Access token now includes `gmail.send` scope

### First-Time Permission

When first requesting `gmail.send` scope:
1. Old permission scope doesn't include email sending
2. Users must re-connect Gmail
3. Google shows updated consent screen
4. User must grant new permission for email sending

## Production Deployment

### Vercel Deployment

1. Ensure all environment variables set in Vercel
2. Update Google Cloud Console with Vercel URL:
   ```
   Authorized origin: https://yourdomain.vercel.app
   Redirect URI: https://yourdomain.vercel.app/api/auth/callback/google
   ```
3. Users connecting Gmail on production get new permission request
4. Email sending works same as local development

### Database Backup

Before deploying:
1. Backup Prisma database
2. Ensure application records can be accessed
3. Test email sending on staging environment first

## Troubleshooting

### Emails Not Appearing in Gmail

**Possible causes**:
1. Email was sent but Gmail spam filter caught it
2. Network error during send (check error logs)
3. Gmail API rate limiting (rarely happens)

**Solution**:
1. Check Gmail spam folder
2. Review server logs for errors
3. Re-try email send

### "Invalid grant" Error

**Cause**: Refresh token expired or invalid

**Solution**:
1. User disconnects Gmail
2. Clears browser cookies
3. Reconnects Gmail

### Emails Sent But No Record Updated

**Cause**: Email sent successfully but database update failed

**Solution**:
1. Check database connectivity
2. Verify jobApplication record exists
3. Check Prisma error logs

## Future Enhancements

Possible improvements for future versions:

- [ ] Email scheduling (send at optimal times)
- [ ] Email templates customization
- [ ] Draft preview before sending
- [ ] Bulk email sending for multiple jobs
- [ ] Email tracking (open rates, link clicks)
- [ ] Follow-up email sequences
- [ ] Attachment support (cover letter, portfolio PDF)
- [ ] Email sending analytics dashboard

## Compliance & Privacy

✅ **GDPR Compliant** - Only sends to provided email addresses
✅ **No Data Retention** - Emails sent via Gmail API, stored in user's Gmail
✅ **User Control** - Users can revoke email sending permission anytime
✅ **Transparency** - Clear notification when emails are sent
✅ **Privacy** - No sharing of CV or portfolio URLs with third parties

## Support

For issues:
1. Check that Gmail is connected in Settings
2. Verify recruiter email address is correct
3. Ensure job ID matches a real job
4. Review server logs for specific errors
5. Try disconnecting and reconnecting Gmail

## Additional Resources

- [Google Gmail API Documentation](https://developers.google.com/gmail/api)
- [Gmail API Send Message Reference](https://developers.google.com/gmail/api/reference/rest/v1/users.messages/send)
- [RFC 2822 Email Format](https://tools.ietf.org/html/rfc2822)
- [NextAuth.js Documentation](https://next-auth.js.org/)
