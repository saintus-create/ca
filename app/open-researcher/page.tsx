import { redirect } from 'next/navigation'

/** The chat application lives at the home page now; this route just sends visitors there. */
export default function OpenResearcherPage() {
  redirect('/')
}
