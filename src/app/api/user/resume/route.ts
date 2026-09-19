import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, unauthorized, parseJsonList } from '@/lib/session'
import { parseResumeText, parseResumeFromUrl } from '@/lib/resume-parser'
import type { ResumeProfile } from '@/lib/resume-parser'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BYTES = 4 * 1024 * 1024

function isPublicHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const h = u.hostname.toLowerCase()
    return !(
      h === 'localhost' ||
      h.endsWith('.local') ||
      h.endsWith('.internal') ||
      /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) ||
      h === '::1' ||
      h.startsWith('[')
    )
  } catch {
    return false
  }
}

async function extractText(fileName: string, contentType: string, data: Buffer): Promise<string> {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pdf') || contentType === 'application/pdf') {
    const pdf = (await import('pdf-parse/lib/pdf-parse.js')).default
    return (await pdf(data)).text
  }
  if (lower.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    return (await mammoth.extractRawText({ buffer: data })).value
  }
  if (lower.endsWith('.txt') || lower.endsWith('.md') || contentType.startsWith('text/')) {
    return data.toString('utf-8')
  }
  throw new Error('Unsupported file type. Upload a PDF, DOCX or TXT file.')
}

const merge = (...lists: string[][]) => Array.from(new Set(lists.flat().map((s) => s.trim()).filter(Boolean)))

async function saveProfile(userId: string, parsed: ResumeProfile, extra: Record<string, unknown>, existingKeywords: string[]) {
  const suggestedKeywords = existingKeywords.length ? existingKeywords : merge(parsed.preferredRoles.slice(0, 3), parsed.skills.slice(0, 3))
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...extra,
      skills: JSON.stringify(parsed.skills),
      experience: JSON.stringify(parsed.experience),
      education: JSON.stringify(parsed.education),
      projects: JSON.stringify(parsed.projects),
      preferredRoles: JSON.stringify(parsed.preferredRoles),
      jobKeywords: JSON.stringify(suggestedKeywords),
      profileParsedAt: new Date(),
      // A freshly parsed profile has to be re-confirmed by the user.
      preferencesConfirmedAt: null,
    },
  })
}

// POST multipart/form-data { file }  → store CV, extract text, parse skills.
// POST JSON { portfolioUrl }         → parse the portfolio page.
// Result is only a proposal: the user confirms skills/preferences via PUT /api/user/profile.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()

    if ((req.headers.get('content-type') || '').includes('application/json')) {
      const { portfolioUrl } = await req.json().catch(() => ({}))
      if (typeof portfolioUrl !== 'string' || !isPublicHttpUrl(portfolioUrl)) {
        return NextResponse.json({ error: 'Enter a valid public http(s) portfolio URL.' }, { status: 400 })
      }
      const parsed = await parseResumeFromUrl(portfolioUrl)
      if (!parsed.skills.length) {
        return NextResponse.json({ error: 'Could not read any skills from that page.' }, { status: 422 })
      }
      const skills = merge(parseJsonList(user.skills), parsed.skills)
      await saveProfile(user.id, { ...parsed, skills }, { portfolioUrl }, parseJsonList(user.jobKeywords))
      return NextResponse.json({ success: true, skills, preferredRoles: parsed.preferredRoles })
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 })
    if (file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File must be between 1 byte and 4 MB.' }, { status: 400 })
    }

    const data = Buffer.from(await file.arrayBuffer())
    let text: string
    try {
      text = await extractText(file.name, file.type, data)
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not read file.' }, { status: 422 })
    }
    if (text.trim().length < 50) {
      return NextResponse.json({ error: 'No readable text found in that file (scanned image PDFs are not supported).' }, { status: 422 })
    }

    const parsed = await parseResumeText(text)
    const contentType = file.type || 'application/octet-stream'

    // One CV per user: replace the previous upload.
    await prisma.resumeFile.deleteMany({ where: { userId: user.id } })
    await prisma.resumeFile.create({ data: { userId: user.id, fileName: file.name, contentType, size: data.length, data } })
    await saveProfile(user.id, parsed, { resumeText: text.slice(0, 50000) }, parseJsonList(user.jobKeywords))

    return NextResponse.json({
      success: true,
      fileName: file.name,
      skills: parsed.skills,
      preferredRoles: parsed.preferredRoles,
      experienceCount: parsed.experience.length,
    })
  } catch (error) {
    console.error('Resume upload error:', error)
    return NextResponse.json({ error: 'Failed to process resume' }, { status: 500 })
  }
}
