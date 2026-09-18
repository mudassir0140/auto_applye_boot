export interface ParsedJobEmail {
  type: 'interview' | 'assessment' | 'rejection' | 'offer' | 'confirmation' | 'other'
  company?: string
  position?: string
  details?: string
  actionRequired?: boolean
  actionUrl?: string
}

export function parseJobEmail(subject: string, body: string): ParsedJobEmail {
  const combinedText = `${subject} ${body}`.toLowerCase()

  // Interview detection
  if (
    combinedText.includes('interview') ||
    combinedText.includes('interview scheduled') ||
    combinedText.includes('schedule an interview') ||
    combinedText.includes('next step') ||
    combinedText.includes('phone call') ||
    combinedText.includes('video call')
  ) {
    return {
      type: 'interview',
      actionRequired: true,
      details: extractInterviewDetails(subject, body),
    }
  }

  // Assessment detection
  if (
    combinedText.includes('assessment') ||
    combinedText.includes('coding test') ||
    combinedText.includes('coding challenge') ||
    combinedText.includes('take the test') ||
    combinedText.includes('complete your assessment')
  ) {
    return {
      type: 'assessment',
      actionRequired: true,
      details: extractAssessmentDetails(subject, body),
    }
  }

  // Rejection detection
  if (
    combinedText.includes('unfortunately') ||
    combinedText.includes('rejected') ||
    combinedText.includes('not moving forward') ||
    combinedText.includes('we decided') ||
    combinedText.includes('better fit') ||
    combinedText.includes('regret to inform')
  ) {
    return {
      type: 'rejection',
      actionRequired: false,
      details: subject,
    }
  }

  // Offer detection
  if (
    combinedText.includes('offer') ||
    combinedText.includes('congratul') ||
    combinedText.includes('we are pleased') ||
    combinedText.includes('we would like to offer')
  ) {
    return {
      type: 'offer',
      actionRequired: true,
      details: extractOfferDetails(subject, body),
    }
  }

  // Application confirmation
  if (
    combinedText.includes('received your application') ||
    combinedText.includes('thank you for applying') ||
    combinedText.includes('application received') ||
    combinedText.includes('application confirmed')
  ) {
    return {
      type: 'confirmation',
      actionRequired: false,
      details: subject,
    }
  }

  return {
    type: 'other',
    actionRequired: false,
    details: subject,
  }
}

function extractInterviewDetails(subject: string, body: string): string {
  const lines = body.split('\n')
  let details = subject

  for (const line of lines) {
    if (
      line.includes('time') ||
      line.includes('date') ||
      line.includes('zoom') ||
      line.includes('link')
    ) {
      details += ` - ${line.trim()}`
    }
  }

  return details
}

function extractAssessmentDetails(subject: string, body: string): string {
  const lines = body.split('\n')
  let details = subject

  for (const line of lines) {
    if (
      line.includes('deadline') ||
      line.includes('due') ||
      line.includes('link') ||
      line.includes('password')
    ) {
      details += ` - ${line.trim()}`
    }
  }

  return details
}

function extractOfferDetails(subject: string, body: string): string {
  const lines = body.split('\n')
  let details = subject

  for (const line of lines) {
    if (
      line.includes('salary') ||
      line.includes('start') ||
      line.includes('position') ||
      line.includes('team')
    ) {
      details += ` - ${line.trim()}`
    }
  }

  return details
}

export function extractURLsFromEmail(body: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  return (body.match(urlRegex) || []).slice(0, 5)
}

export function isJobRelatedEmail(subject: string, body: string, senderEmail: string): boolean {
  const lowercaseText = `${subject} ${body} ${senderEmail}`.toLowerCase()

  const jobKeywords = [
    'job',
    'position',
    'role',
    'apply',
    'application',
    'candidate',
    'interview',
    'assessment',
    'recruiting',
    'hiring',
    'recruiter',
    'hr',
    'human resources',
    'offer',
    'hire',
  ]

  let matchCount = 0
  for (const keyword of jobKeywords) {
    if (lowercaseText.includes(keyword)) {
      matchCount++
    }
  }

  return matchCount >= 1
}
