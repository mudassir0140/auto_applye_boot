import { redirect } from 'next/navigation'

// Search and apply now live on the Jobs page.
export default function SearchPage() {
  redirect('/dashboard/jobs')
}
