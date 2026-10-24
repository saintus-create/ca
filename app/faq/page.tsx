/**
 * The frequently asked questions page: plain headed sections on the same
 * clean page shell as the California Law page. No accordion, no blocks.
 */
import { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

export const metadata: Metadata = {
  title: 'Frequently asked questions, California Legislative Information',
  description: 'Questions about the California Legislative Information research tool.',
}

const FAQS = [
  {
    question: 'What does it actually search?',
    answer:
      'The California codes, the Rules of Court, the Judicial Council forms and case law annotations, and the live web.',
  },
  {
    question: 'Do I need an API key?',
    answer: 'No.',
  },
  {
    question: 'Which model does it use?',
    answer: 'Sarvam by default, with Venice as an alternative.',
  },
  {
    question: 'Can I trust the citations?',
    answer: 'Citations link to the section they came from.',
  },
  {
    question: 'Is my data stored?',
    answer: 'No. Questions are not kept.',
  },
]

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <SiteHeader />
      <main className="px-6 py-16 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-medium tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-4xl">
            Frequently asked questions
          </h1>
          <div className="mt-12 space-y-10">
            {FAQS.map((faq) => (
              <section key={faq.question}>
                <h2 className="text-lg font-medium tracking-tight text-neutral-900 dark:text-neutral-50">
                  {faq.question}
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {faq.answer}
                </p>
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
