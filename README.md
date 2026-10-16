# California Legislative Information

A focused interface for California statutory law, legislation, court rules, judicial forms, and case research materials.

## Run locally

- Node.js 18+
- `npm install`
- `npm run dev`

## Data sources

The interface links to authoritative California Legislature and Judicial Branch sources:

- [California Codes](https://leginfo.legislature.ca.gov/faces/codes.xhtml)
- [Bills and Measures](https://leginfo.legislature.ca.gov/faces/billSearchClient.xhtml)
- [California Rules of Court](https://www.courts.ca.gov/cms/rules/index.cfm)
- [Judicial Council Forms](https://selfhelp.courts.ca.gov/find-forms/all-by-category)
- [California Appellate Opinions](https://www.courts.ca.gov/opinions.htm)

The corpus proxy currently reads the existing California corpus from the separate CALEGINFO repository as a migration bridge. It does not modify that repository. Moving every compressed dataset into this repository and verifying its integrity remains part of the transposition.

## Scope

This application is a legal-information interface, not a substitute for official publications or legal advice. Verify current text, effective dates, and legislative status with the official source.
