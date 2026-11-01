import { NextRequest, NextResponse } from 'next/server';
import { searchCorpus } from '@/lib/corpus-search';
import { DATASET_PATTERN, LIMITS, integer, requiredString } from '@/lib/validate';

// Direct search over the local California corpus.
// GET /api/corpus-search?q=retroactive&dataset=PEN&limit=5
export async function GET(req: NextRequest) {
  const qResult = requiredString(req.nextUrl.searchParams.get('q') ?? '', 'q', {
    max: LIMITS.corpusQuery,
  });
  if (!qResult.ok) return NextResponse.json({ error: qResult.error }, { status: 400 });

  const datasetParam = req.nextUrl.searchParams.get('dataset');
  const dataset = datasetParam && DATASET_PATTERN.test(datasetParam.trim())
    ? datasetParam.trim()
    : undefined;
  if (datasetParam && !dataset) {
    return NextResponse.json({ error: 'dataset must be a code such as CIV or PEN.' }, { status: 400 });
  }

  const limitResult = integer(req.nextUrl.searchParams.get('limit'), 'limit', {
    min: 1,
    max: 25,
    fallback: 5,
  });
  if (!limitResult.ok) return NextResponse.json({ error: limitResult.error }, { status: 400 });

  const q = qResult.value;
  const limit = limitResult.value;
  try {
    const hits = await searchCorpus(q, dataset, limit);
    return NextResponse.json({ query: q, dataset: dataset || null, count: hits.length, hits });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'corpus search failed' },
      { status: 500 }
    );
  }
}
