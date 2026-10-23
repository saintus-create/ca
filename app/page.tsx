import { Metadata } from 'next'
import OpenResearcherContent from './open-researcher/open-researcher-content'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'California Law',
  description: 'California statutes, rules and forms, researched and cited',
}

export default function Home() {
  return <OpenResearcherContent voiceEnabled />
}
