/**
 * Compliance requirements for trial court revenues, expenditures and fund
 * balances, on the same clean page shell as the California Law and FAQ pages.
 *
 * Every statement here traces to a published authority listed at the foot of
 * the page. It is a summary of those requirements, not legal advice.
 */
import { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

export const metadata: Metadata = {
  title: 'Compliance requirements, trial court revenues, expenditures and fund balances',
  description:
    'Requirements drawn from the Judicial Council Governance Policies, the Budget Act, the Manual of State Funds, the Government Code, the California Rules of Court and the FIN Manual.',
}

const AUTHORITIES: Array<{ name: string; note: string; href?: string }> = [
  {
    name: 'Judicial Council Governance Policies',
    note: 'November 2017',
  },
  {
    name: 'Budget Act, FY 2020-21',
    note: 'Appropriations and control sections',
  },
  {
    name: 'Manual of State Funds',
    note: 'State Controller',
  },
  {
    name: 'Government Code',
    note: 'Trial court funding and fiscal management provisions',
    href: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=77206.',
  },
  {
    name: 'California Rules of Court',
    note: 'Rule 10.804, superior court financial policies and procedures',
    href: 'https://courts.ca.gov/cms/rules/index/ten/rule10_804',
  },
  {
    name: 'Trial Court Financial Policies and Procedures Manual (FIN Manual)',
    note: '11th edition, June 2020 reviewed',
    href: 'https://courts.ca.gov/policy-administration/budget-finance/policies-and-procedures-manual',
  },
  {
    name: 'Local internal policies and procedures',
    note: 'Court-level procedures adopted under the manual',
  },
]

const SECTIONS: Array<{ id: string; heading: string; intro: string; points: string[] }> = [
  {
    id: 'revenues',
    heading: 'Revenues',
    intro:
      'Revenue testing asks whether receipts were consistent with the Government Code, properly supported by documentation, and recorded accurately in the accounting records.',
    points: [
      'All moneys collected by the courts, including filing fees, fines, forfeitures and penalties, and all revenues relating to court operations, must be known. The Judicial Council maintains regulations for recordkeeping and accounting to that end (Gov. Code § 77206(a)).',
      'State funding, whether from the Trial Court Trust Fund or the Trial Court Improvement and Modernization Fund, must be recorded in the Trial Court Operations Fund (FIN Manual, fund accounting).',
      'Money held in a fiduciary capacity for another governmental entity, such as bail bond money, permit deposits and fee assessments, must be accounted for in Agency Funds and reported as balance sheet items in the State Annual Comprehensive Financial Report.',
      'Receipts recorded on the Legal/Budgetary basis of accounting, in accordance with fund accounting principles.',
    ],
  },
  {
    id: 'expenditures',
    heading: 'Expenditures',
    intro:
      'Expenditure testing asks whether costs were incurred pursuant to the Government Code, consistent with the purposes of the fund, properly authorized, adequately supported, and recorded accurately.',
    points: [
      'Money from the Trial Court Operations Fund may be used only for trial court operations as defined in Gov. Code § 77003 and for services purchased by the court as set out in Gov. Code § 77212(a)–(c).',
      'The presiding judge, or a written designee, must authorize and direct expenditures from the Trial Court Operations Fund. County approval is not required.',
      'Procurement and contracting follow the Judicial Branch Contracting Manual, adopted under Public Contract Code § 19206.',
      'Transactions must be recorded in the correct fiscal year. Recording prior-year expenditures in the current year, or current-year expenditures in the following year, is a reporting error even where the underlying spending was proper.',
      'Financial transactions must be executed and accounted for in accordance with GAAP, and with GASB standards and the requirements of the Lockyer-Isenberg Trial Court Funding Act of 1997.',
    ],
  },
  {
    id: 'fund-balances',
    heading: 'Fund balances',
    intro:
      'Fund balance testing asks whether balances were reported on the Legal/Budgetary basis of accounting and maintained in accordance with fund accounting principles.',
    points: [
      'Fund balance must be reported using the approved classifications, ordered from the most binding constraint: nonspendable, restricted, committed, assigned, and unassigned (general fund only).',
      'Allocations follow a set priority: nonspendable, restricted, contractual commitments due in the next fiscal year, the minimum calculated operating and emergency balance, other Judicial Council mandates due in the next fiscal year, contractual commitments due in later years, assigned designations, then unassigned.',
      'A fund balance can never be negative.',
      'Each court must maintain a minimum operating and emergency fund balance calculated on the prior year’s ending total unrestricted general fund expenditures, less material one-time expenditures: 5 percent of the first $10 million, 4 percent of the next $40 million, and 3 percent of expenditures above $50 million.',
      'Amounts transferred to the Court Facilities Architectural Revolving Fund are restricted to the items requested, and any unused balance at the end of the project is subject to the fund balance cap in the year the funds were deposited.',
      'Balances must be supported by year-end accruals. Unaccrued reimbursements and missing accruals overstate or understate fund balance even where no cash error occurred.',
    ],
  },
]

export default function CompliancePage() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <SiteHeader />
      <main className="px-6 py-16 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-medium tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-4xl">
            Compliance requirements
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            Requirements applicable to trial court revenues, expenditures and fund
            balances, drawn from the authorities reviewed and set out at the foot of this
            page.
          </p>

          <section className="mt-12">
            <h2 className="text-lg font-medium tracking-tight text-neutral-900 dark:text-neutral-50">
              Authorities reviewed
            </h2>
            <ul className="mt-4 space-y-2">
              {AUTHORITIES.map((authority) => (
                <li
                  key={authority.name}
                  className="text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400"
                >
                  {authority.href ? (
                    <a
                      href={authority.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-neutral-900 underline underline-offset-4 dark:text-neutral-100"
                    >
                      {authority.name}
                    </a>
                  ) : (
                    <span className="text-neutral-900 dark:text-neutral-100">
                      {authority.name}
                    </span>
                  )}
                  <span className="text-neutral-500 dark:text-neutral-500">
                    {' '}
                    — {authority.note}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {SECTIONS.map((section) => (
            <section key={section.id} className="mt-12">
              <h2 className="text-lg font-medium tracking-tight text-neutral-900 dark:text-neutral-50">
                {section.heading}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                {section.intro}
              </p>
              <ul className="mt-4 list-disc space-y-3 pl-5">
                {section.points.map((point) => (
                  <li
                    key={point}
                    className="text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="mt-12 border-t border-neutral-200 pt-6 dark:border-neutral-800">
            <p className="text-[13.5px] leading-relaxed text-neutral-500 dark:text-neutral-500">
              This page summarises published requirements for reference. It is not legal
              advice, and the manuals and statutes control over any summary. The FIN
              Manual reviewed here was the 11th edition of June 2020; the Judicial Council
              has since published a later edition, so confirm the current text before
              relying on a specific provision.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
