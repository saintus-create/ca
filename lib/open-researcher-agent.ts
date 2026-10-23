import FirecrawlApp from '@mendable/firecrawl-js';
import { executeCorpusSearch } from './corpus-search';
import { createChat, type LlmMessage } from './llm';

// Lazy initialization for Vercel deployment
let firecrawl: FirecrawlApp | null = null;

function getFirecrawlClient(): FirecrawlApp {
  if (!firecrawl) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      // FIRECRAWL_API_KEY is not set in environment variables
      throw new Error('FIRECRAWL_API_KEY environment variable is not set');
    }
    // Initializing Firecrawl client
    firecrawl = new FirecrawlApp({ apiKey });
  }
  return firecrawl;
}

// The model, provider, and thinking configuration all live in lib/llm.ts:
// Sarvam AI (sarvam-105b) is the default, Anthropic is the fallback.
const RESEARCH_MAX_TOKENS =
  Number.parseInt(process.env.LLM_MAX_TOKENS || '', 10) || 8192;

// How many model turns (each may include tool calls) one research run may take.
// The upstream template recursed with no bound, so a model that kept calling
// tools could run until the platform killed the function.
const MAX_RESEARCH_STEPS = Number.parseInt(process.env.LLM_MAX_STEPS || '', 10) || 12;

// Type definitions
interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface FirecrawlSearchResult {
  success?: boolean;
  data?: Array<{
    url?: string;
    title?: string;
    description?: string;
    markdown?: string;
    links?: string[];
    screenshot?: string;
    metadata?: {
      title?: string;
      description?: string;
    };
  }>;
  error?: string;
}

interface FirecrawlScrapeResult {
  success?: boolean;
  data?: {
    url?: string;
    markdown?: string;
    links?: string[];
    screenshot?: string;
    metadata?: {
      title?: string;
      description?: string;
    };
  };
  markdown?: string;
  links?: string[];
  screenshot?: string;
  metadata?: {
    title?: string;
    description?: string;
  };
  error?: string;
  statusCode?: number;
  message?: string;
}

// Define our research tools
const tools: ToolDefinition[] = [
  {
    name: "web_search",
    description: "Search the web and optionally scrape content from results. Supports Google search operators (site:, intitle:, etc.). Set scrape_content=true to extract full content. For listing/counting items, the search results preview is often sufficient.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query"
        },
        limit: {
          type: "number",
          description: "Number of results to return",
          default: 5
        },
        scrape_content: {
          type: "boolean",
          description: "Whether to scrape the content of search results",
          default: false
        },
        tbs: {
          type: "string",
          description: "Time-based search filter (e.g., 'qdr:w' for past week)",
          enum: ["qdr:h", "qdr:d", "qdr:w", "qdr:m", "qdr:y"]
        }
      },
      required: ["query"]
    }
  },
  {
    name: "deep_scrape",
    description: "Scrape a single URL and optionally follow its links for deeper analysis. Best for detailed research or when you need content from multiple linked pages. For simple queries, a single page scrape is usually sufficient.",
    input_schema: {
      type: "object",
      properties: {
        source_url: {
          type: "string",
          description: "The source URL to extract links from"
        },
        link_filter: {
          type: "string",
          description: "Regex pattern to filter which links to scrape (e.g., '/blog/', '/docs/')"
        },
        max_depth: {
          type: "number",
          description: "Maximum depth of links to follow (1 = direct links only)",
          default: 1
        },
        max_links: {
          type: "number",
          description: "Maximum number of links to scrape per level",
          default: 5
        },
        formats: {
          type: "array",
          items: { type: "string" },
          description: "Output formats for scraped content",
          default: ["markdown"]
        }
      },
      required: ["source_url"]
    }
  },
  {
    name: "analyze_content",
    description: "Analyze scraped content to extract specific information, patterns, or insights. Use this to process content you've already fetched rather than fetching more.",
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Content to analyze"
        },
        analysis_type: {
          type: "string",
          enum: ["sentiment", "key_facts", "trends", "summary", "credibility"],
          description: "Type of analysis to perform"
        },
        context: {
          type: "string",
          description: "Additional context for the analysis"
        }
      },
      required: ["content", "analysis_type"]
    }
  },
  {
    name: "search_california_law",
    description: "Search the local California Legislative Information corpus: the full text of the California codes, including Penal, Civil, Family, Evidence, Health and Safety, and Government, plus the California Rules of Court, judicial forms, legislation, and case law annotations held on this site. Use this for any question about California law, and use it alongside web_search. For the actual statutory text, this corpus is the primary source. Optionally pass a dataset code such as PEN, CIV, FAM, EVID, CCP, GOV, HSC, WIC, BPC, or VEH to search one code.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query: keywords, a phrase, or a citation such as a section number"
        },
        dataset: {
          type: "string",
          description: "Optional dataset code to restrict the search (e.g. PEN, CIV, FAM, EVID, CCP, GOV, HSC)"
        },
        limit: {
          type: "number",
          description: "Number of corpus records to return",
          default: 5
        }
      },
      required: ["query"]
    }
  }
];

// Execute Firecrawl search with two-step approach
async function executeWebSearch(query: string, limit: number = 5, scrapeContent: boolean = false, tbs?: string): Promise<{ content: string; screenshots: Array<{ url: string; screenshot?: string }> }> {
  // Performing firecrawl search
  
  const screenshots: Array<{ url: string; screenshot?: string }> = [];
  
  try {
    // Step 1: First search without scraping to get metadata
    const searchOptions: { limit: number; scrapeOptions: { formats: string[] }; tbs?: string } = {
      limit,
      scrapeOptions: {
        formats: [] // Empty formats array means no scraping
      }
    };

    if (tbs) {
      searchOptions.tbs = tbs;
    }

    const metadataResults = await getFirecrawlClient().search(query, searchOptions) as FirecrawlSearchResult;
    
    if (!metadataResults.data || metadataResults.data.length === 0) {
      return { content: "No search results found.", screenshots: [] };
    }

    let output = `Found ${metadataResults.data.length} results:\n\n`;
    
    // Display all results with metadata
    for (const [index, result] of metadataResults.data.entries()) {
      output += `[${index + 1}] ${result.title}\n`;
      output += `URL: ${result.url}\n`;
      output += `Description: ${result.description}\n`;
      output += '\n';
    }

    // Step 2: If scraping is requested, decide which URLs to scrape based on metadata
    if (scrapeContent) {
      // Dynamic filtering logic based on query intent and search results
      
      // Analyze query for intent signals
      const querySignals = {
        wantsRecent: /latest|recent|newest|new|today|yesterday|this week|this month/i.test(query),
        wantsBlog: /blog|post|article|news|update|announce/i.test(query),
        wantsDocs: /documentation|docs|api|reference|guide|tutorial|how to/i.test(query),
        hasTimeFilter: !!tbs,
        hasSiteFilter: /site:/i.test(query)
      };
      
      const urlsToScrape = metadataResults.data
        .filter((result, index) => {
          const text = `${result.title} ${result.description} ${result.url}`.toLowerCase();
          
          // Always include top results when no specific filters
          if (!querySignals.wantsRecent && !querySignals.wantsBlog && !querySignals.wantsDocs) {
            return index < Math.min(limit, 5);
          }
          
          // For time-sensitive queries, include all results (they're already filtered by search)
          if (querySignals.wantsRecent || querySignals.hasTimeFilter) {
            return true;
          }
          
          // For content-type specific queries, use smart matching
          if (querySignals.wantsBlog || querySignals.wantsDocs) {
            // Check URL patterns
            try {
              const url = new URL(result.url!);
              const pathLower = url.pathname.toLowerCase();
              
              if (querySignals.wantsBlog && (pathLower.includes('blog') || pathLower.includes('post') || 
                  pathLower.includes('article') || pathLower.includes('news'))) {
                return true;
              }
              
              if (querySignals.wantsDocs && (pathLower.includes('doc') || pathLower.includes('api') || 
                  pathLower.includes('guide') || pathLower.includes('reference'))) {
                return true;
              }
            } catch {}
            
            // Also check title/description for relevant terms
            if (querySignals.wantsBlog && /blog|post|article|published|wrote/i.test(text)) {
              return true;
            }
            
            if (querySignals.wantsDocs && /documentation|api|guide|tutorial|reference/i.test(text)) {
              return true;
            }
          }
          
          // Default: include top results
          return index < 3;
        })
        .map(result => result.url);

      // Scraping URLs

      if (urlsToScrape.length > 0) {
        // Now search again with scraping enabled
        const scrapeOptions: { limit: number; scrapeOptions: { formats: string[] }; tbs?: string } = {
          limit,
          scrapeOptions: {
            formats: ["markdown"]
          }
        };

        if (tbs) {
          scrapeOptions.tbs = tbs;
        }

        const scrapedResults = await getFirecrawlClient().search(query, scrapeOptions) as FirecrawlSearchResult;
        
        // Add scraped content to output
        output += `\nScraped content:\n\n`;
        
        // Process scraped results
        const scrapedWithMetadata = [];
        
        for (const [index, result] of (scrapedResults.data || []).entries()) {
          // Only include scraped content for our selected URLs
          if (result.url && urlsToScrape.includes(result.url) && result.markdown) {
            // Store screenshot if available
            if (result.screenshot) {
              screenshots.push({ url: result.url, screenshot: result.screenshot });
            }
            
            // Try to extract date from content if query suggests time-sensitivity
            let dateFound = null;
            if (querySignals.wantsRecent || querySignals.wantsBlog) {
              // Look for common date patterns in the content
              const datePatterns = [
                /(\w+ \d{1,2}, \d{4})/g,  // "June 12, 2025"
                /(\d{4}-\d{2}-\d{2})/g,    // "2025-06-12"
                /(\d{1,2}\/\d{1,2}\/\d{4})/g,  // "6/12/2025"
                /(\d{1,2} \w+ \d{4})/g    // "12 June 2025"
              ];
              
              // Check multiple locations for dates
              const searchText = [
                result.markdown.substring(0, 1000), // Check beginning
                result.metadata?.description || '',
                result.metadata?.title || ''
              ].join(' ');
              
              for (const pattern of datePatterns) {
                const matches = searchText.match(pattern);
                if (matches && matches.length > 0) {
                  // Try to parse and validate the date
                  try {
                    const testDate = new Date(matches[0]);
                    if (!isNaN(testDate.getTime()) && testDate.getFullYear() >= 2020) {
                      dateFound = matches[0];
                      break;
                    }
                  } catch {}
                }
              }
            }
            
            scrapedWithMetadata.push({
              ...result,
              index: index + 1,
              dateFound,
              relevanceScore: index // Lower index = higher relevance from search
            });
          }
        }
        
        // Sort results based on query intent
        if (scrapedWithMetadata.length > 0) {
          scrapedWithMetadata.sort((a, b) => {
            // For time-sensitive queries, prioritize by date
            if (querySignals.wantsRecent && (a.dateFound || b.dateFound)) {
              if (!a.dateFound && !b.dateFound) return a.relevanceScore - b.relevanceScore;
              if (!a.dateFound) return 1;
              if (!b.dateFound) return -1;
              
              try {
                const dateA = new Date(a.dateFound);
                const dateB = new Date(b.dateFound);
                return dateB.getTime() - dateA.getTime(); // Newest first
              } catch {
                return a.relevanceScore - b.relevanceScore;
              }
            }
            
            // Otherwise, maintain search relevance order
            return a.relevanceScore - b.relevanceScore;
          });
        }
        
        // Display the results
        for (const result of scrapedWithMetadata) {
          output += `[${result.index}] ${result.title} (scraped)\n`;
          output += `URL: ${result.url}\n`;
          if (result.dateFound) {
            output += `Date: ${result.dateFound}\n`;
          }
          
          // Include first 500 chars of scraped content
          const preview = result.markdown ? result.markdown.substring(0, 500).replace(/\n+/g, ' ') : '';
          output += `Content preview: ${preview}...\n`;
          
          if (result.links && result.links.length > 0) {
            output += `Links found: ${result.links.length} (first 3: ${result.links.slice(0, 3).join(', ')})\n`;
          }
          
          output += '\n';
        }
      }
    }
    
    return { content: output, screenshots };
  } catch (error) {
    // Search error occurred
    return { 
      content: `Error performing search: ${error instanceof Error ? error.message : 'Unknown error'}`,
      screenshots: []
    };
  }
}

// Analyze content with various methods
async function analyzeContent(content: string, analysisType: string, context?: string): Promise<string> {
  // Performing analysis
  
  switch (analysisType) {
    case 'sentiment':
      // Simple sentiment analysis based on keywords
      const positiveWords = ['success', 'growth', 'improve', 'innovation', 'breakthrough', 'leading', 'advanced'];
      const negativeWords = ['challenge', 'risk', 'concern', 'threat', 'decline', 'issue', 'problem'];
      
      const contentLower = content.toLowerCase();
      const positiveMatches = positiveWords.filter(word => contentLower.includes(word));
      const negativeMatches = negativeWords.filter(word => contentLower.includes(word));
      
      const sentiment = positiveMatches.length > negativeMatches.length ? 'Positive' : 
                       negativeMatches.length > positiveMatches.length ? 'Negative' : 'Neutral';
      
      return `Sentiment Analysis:\n` +
             `Overall: ${sentiment}\n` +
             `Positive indicators: ${positiveMatches.join(', ') || 'none'}\n` +
             `Negative indicators: ${negativeMatches.join(', ') || 'none'}\n` +
             `Context considered: ${context || 'general analysis'}`;

    case 'key_facts':
      // Extract sentences with numbers, percentages, or key terms
      const sentences = content.split(/[.!?]/).filter(s => s.trim());
      const keyFacts = sentences
        .filter(s => /\d+%|\$\d+|\d+ (million|billion)|first|largest|leading/i.test(s))
        .slice(0, 5)
        .map(s => s.trim());
      
      return `Key Facts Extracted:\n${keyFacts.map((fact, i) => `${i + 1}. ${fact}`).join('\n')}`;

    case 'trends':
      // Identify trend indicators
      const trendPatterns = {
        'Growth': /increas|grow|rise|expand|surge/i,
        'Decline': /decreas|fall|drop|declin|reduc/i,
        'Innovation': /new|innovat|breakthrough|cutting-edge|advanced/i,
        'Adoption': /adopt|implement|deploy|integrat|using/i,
      };
      
      const identifiedTrends: string[] = [];
      for (const [trend, pattern] of Object.entries(trendPatterns)) {
        if (pattern.test(content)) {
          identifiedTrends.push(trend);
        }
      }
      
      return `Trend Analysis:\n` +
             `Identified trends: ${identifiedTrends.join(', ') || 'No clear trends'}\n` +
             `Market direction: ${identifiedTrends.includes('Growth') ? 'Positive' : 'Mixed'}\n` +
             `Innovation signals: ${identifiedTrends.includes('Innovation') ? 'Strong' : 'Limited'}`;

    case 'summary':
      // Extract most important sentences
      const allSentences = content.split(/[.!?]/).filter(s => s.trim().length > 20);
      const importantSentences = allSentences
        .filter(s => /announc|launch|report|study|research|found|develop/i.test(s))
        .slice(0, 3);
      
      return `Executive Summary:\n${importantSentences.join('. ')}.`;

    case 'credibility':
      // Assess source credibility indicators
      const credibilityFactors = {
        'Has citations': /according to|study|research|report|survey/i.test(content),
        'Includes data': /\d+%|\$\d+|statistics|data/i.test(content),
        'Official source': /\.gov|\.edu|official|announce/i.test(content),
        'Recent info': /2024|2025|recent|latest|new/i.test(content),
      };
      
      const credibilityScore = Object.values(credibilityFactors).filter(v => v).length;
      
      return `Credibility Assessment:\n` +
             Object.entries(credibilityFactors).map(([factor, present]) => 
               `${factor}: ${present ? 'yes' : 'no'}`
             ).join('\n') +
             `\nCredibility score: ${credibilityScore}/4`;

    default:
      return `Analysis type "${analysisType}" completed.`;
  }
}

// Deep scrape functionality
async function executeDeepScrape(
  sourceUrl: string, 
  linkFilter?: string, 
  maxDepth: number = 1, 
  maxLinks: number = 5,
  formats: string[] = ["markdown"]
): Promise<{ content: string; screenshots: Array<{ url: string; screenshot?: string }> }> {
  // Performing firecrawl scrape
  
  const screenshots: Array<{ url: string; screenshot?: string }> = [];
  
  try {
    // First, scrape the source page to get links and screenshot
    
    let sourceResult;
    try {
      sourceResult = await getFirecrawlClient().scrapeUrl(sourceUrl, {
        formats: ['markdown', 'links', 'screenshot@fullPage']
      });
    } catch (scrapeError) {
      // Scrape failed
      return { 
        content: `Failed to scrape URL: ${scrapeError instanceof Error ? scrapeError.message : 'Unknown error'}`,
        screenshots: []
      };
    }

    // Firecrawl v1 returns data at the top level of the response
    const data = (sourceResult as FirecrawlScrapeResult).data || (sourceResult as FirecrawlScrapeResult);
    
    if (!data.markdown) {
      // No content found
      return { 
        content: `Failed to scrape source URL: No content found\n\nTip: Try using web_search with scrape_content=true for better results.`,
        screenshots: []
      };
    }
    
    // Store screenshot if available
    if (data.screenshot) {
      screenshots.push({ url: sourceUrl, screenshot: data.screenshot });
    }

    let output = `Source page scraped successfully\n`;
    output += `Title: ${data.metadata?.title || 'Unknown'}\n\n`;
    
    // Add the main page content
    if (data.markdown) {
      const contentPreview = data.markdown.length > 3000 ? 
        data.markdown.substring(0, 3000) + '...\n[Content truncated]' : 
        data.markdown;
      output += `Page content:\n${contentPreview}\n\n`;
    }
    
    // Only follow links if explicitly requested with a filter
    if (!linkFilter) {
      output += `\nFound ${data.links?.length || 0} links on this page.\n`;
      output += `To follow specific links, use the link_filter parameter (e.g., link_filter: "/blog/[^/]+$" for blog posts).\n`;
      return { content: output, screenshots };
    }

    // Extract and filter links
    const allLinks: string[] = data.links || [];
    let filteredLinks = allLinks;
    
    const filterRegex = new RegExp(linkFilter, 'i');
    filteredLinks = allLinks.filter((link: string) => filterRegex.test(link));
    output += `Filtered to ${filteredLinks.length} links matching pattern "${linkFilter}"\n\n`;

    // Limit the number of links to scrape
    const linksToScrape = filteredLinks.slice(0, maxLinks);
    
    if (linksToScrape.length === 0) {
      output += "No links to scrape after filtering.\n";
      return { content: output, screenshots };
    }

    output += `Following ${linksToScrape.length} links:\n`;
    
    // Scrape each link in parallel
    const scrapePromises = linksToScrape.map(async (link: string) => {
      try {
        const result = await getFirecrawlClient().scrapeUrl(link, { 
          formats: [...formats, 'screenshot@fullPage'] as ("markdown" | "html" | "content" | "rawHtml" | "links" | "screenshot" | "screenshot@fullPage" | "extract" | "json" | "changeTracking")[]
        });
        
        // Handle both response formats
        const resultData = (result as FirecrawlScrapeResult).data || (result as FirecrawlScrapeResult);
        if ((result as FirecrawlScrapeResult).success && resultData.markdown) {
          // Store screenshot if available
          if (resultData.screenshot) {
            screenshots.push({ url: link, screenshot: resultData.screenshot });
          }
          
          return {
            url: link,
            title: resultData.metadata?.title || 'Unknown',
            description: resultData.metadata?.description || '',
            content: resultData.markdown?.substring(0, 500) || '',
            links: resultData.links?.length || 0,
            hasScreenshot: !!resultData.screenshot
          };
        }
        return null;
      } catch {
        // Failed to scrape link
        return null;
      }
    });

    const results = await Promise.all(scrapePromises);
    const successfulScrapes = results.filter(r => r !== null);
    
    output += `\nSuccessfully scraped ${successfulScrapes.length} pages:\n\n`;
    
    for (const [index, result] of successfulScrapes.entries()) {
      if (result) {
        output += `[${index + 1}] ${result.title}\n`;
        output += `URL: ${result.url}\n`;
        output += `Description: ${result.description}\n`;
        output += `Content preview: ${result.content}...\n`;
        if (result.hasScreenshot) {
          output += `Screenshot captured.\n`;
        }
        if (maxDepth > 1 && result.links > 0) {
          output += `Sub-links available: ${result.links} (depth ${maxDepth - 1} remaining)\n`;
        }
        output += '\n';
      }
    }
    
    return { content: output, screenshots };
  } catch (error) {
    // Deep scrape error occurred
    return { 
      content: `Error performing deep scrape: ${error instanceof Error ? error.message : 'Unknown error'}`,
      screenshots: []
    };
  }
}

// The web tools need a Firecrawl key; the corpus tool does not. Rather than
// failing a whole research run because one source is unconfigured, offer only
// the tools that can actually execute.
export function availableTools(): ToolDefinition[] {
  return process.env.FIRECRAWL_API_KEY
    ? tools
    : tools.filter((tool) => tool.name === 'search_california_law');
}

function systemPromptFor(toolset: ToolDefinition[]): string {
  const hasWeb = toolset.some((tool) => tool.name === 'web_search');
  return hasWeb
    ? SYSTEM_PROMPT
    : `${SYSTEM_PROMPT}\n\nNote: web search and scraping are not configured in this deployment. Do not attempt to use them. Answer from the California corpus alone with search_california_law, and if a question genuinely needs live web data, say so plainly instead of guessing.`;
}

// Execute tool based on name
export async function executeTool(toolName: string, input: Record<string, unknown>): Promise<{ content: string; screenshots?: Array<{ url: string; screenshot?: string }> }> {
  switch (toolName) {
    case 'web_search':
      if (!process.env.FIRECRAWL_API_KEY) {
        return { content: 'Web search is not configured in this deployment. Use search_california_law against the California corpus instead.' };
      }
      return await executeWebSearch(
        input.query as string, 
        (input.limit as number) || 5, 
        (input.scrape_content as boolean) || false,
        input.tbs as string | undefined
      );
    case 'deep_scrape':
      if (!process.env.FIRECRAWL_API_KEY) {
        return { content: 'Web scraping is not configured in this deployment. Use search_california_law against the California corpus instead.' };
      }
      return await executeDeepScrape(
        input.source_url as string,
        input.link_filter as string | undefined,
        (input.max_depth as number) || 1,
        (input.max_links as number) || 5,
        (input.formats as string[]) || ['markdown']
      );
    case 'analyze_content':
      return { content: await analyzeContent(input.content as string, input.analysis_type as string, input.context as string | undefined) };
    case 'search_california_law':
      return await executeCorpusSearch(
        input.query as string,
        input.dataset as string | undefined,
        (input.limit as number) || 5
      );
    default:
      return { content: `Unknown tool: ${toolName}` };
  }
}

// ---------------------------------------------------------------------------
// Research loop
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a California legal research assistant. You have one tool, search_california_law, which searches a local corpus holding the full text of the California codes (Penal, Civil, Family, Evidence, Health & Safety, Government and every other code), the California Rules of Court, Judicial Council forms, legislation, and case law annotations.

How to work:
- Search the corpus before answering any question about California law. Prefer the statutory text over your own recollection.
- Search more than once when it helps: begin with the question in plain language, then refine using the statutory phrasing or the likely code and section.
- Cite the section you relied on for every substantive claim, in the form "CIV § 1950.5", and quote the operative language where it matters.
- If the corpus does not answer the question, say so plainly rather than guessing.

Say that this is not legal advice when a question turns on someone's specific circumstances. Answer directly: lead with the answer, then the authority behind it.

Writing style: use plain, modern typography. Do not use bold or italic markdown. Do not use all caps for emphasis. Do not use em dashes; write plain sentences instead. Keep parentheses rare. Do not use bullet points; when you need to enumerate, use numbered items or write the items as separate sentences. Never mention internal tool or function names and never use underscore names; refer to your sources in plain words, for example the California Legislative Information corpus or the web. Use a short heading only when it genuinely helps the reader, and quote statutory text exactly as the corpus gives it.`;

type ResearchEvent = { type: string; [key: string]: unknown };

function displayToolName(name: string): string {
  if (name === 'web_search') return 'firecrawl_search';
  if (name === 'deep_scrape') return 'firecrawl_scrape';
  return name;
}

async function runResearch(
  query: string,
  onEvent: (event: ResearchEvent) => void,
  scopeDataset?: string
): Promise<string> {
  onEvent({ type: 'start', query });

  const messages: LlmMessage[] = [{ role: 'user', content: query }];
  let finalResponse = '';
  let thinkingCount = 0;
  let toolCallCount = 0;

  for (let step = 0; step < MAX_RESEARCH_STEPS; step++) {
    const toolset = availableTools();
    const system = scopeDataset
      ? `${systemPromptFor(toolset)}\n\nScope: the user has restricted this conversation to the ${scopeDataset} dataset. Every corpus search is limited to it. If the question falls outside that dataset, say so plainly instead of guessing.`
      : systemPromptFor(toolset);
    const result = await createChat({
      system,
      messages,
      tools: toolset,
      maxTokens: RESEARCH_MAX_TOKENS,
    });

    // Keep the assistant turn (including any thinking blocks and their
    // signatures) so tool results can be sent back in the same conversation.
    messages.push({ role: 'assistant', content: result.blocks });

    for (const block of result.blocks) {
      if (block.type === 'thinking') {
        const thinkingContent = block.thinking ?? '';
        if (thinkingContent) {
          thinkingCount++;
          onEvent({ type: 'thinking', number: thinkingCount, content: thinkingContent });
        }
      } else if (block.type === 'text') {
        const textContent = block.text ?? '';
        if (textContent) {
          finalResponse = textContent;
          onEvent({ type: 'response', content: textContent });
        }
      }
    }

    const toolCalls = result.blocks.filter((block) => block.type === 'tool_use');
    if (toolCalls.length === 0) break;

    for (const call of toolCalls) {
      toolCallCount++;
      const input: Record<string, unknown> = { ...(call.input ?? {}) };
      // A user-selected scope wins over the model's choice of dataset.
      if (scopeDataset && call.name === 'search_california_law') {
        input.dataset = scopeDataset;
      }
      onEvent({
        type: 'tool_call',
        number: toolCallCount,
        tool: displayToolName(call.name ?? ''),
        parameters: input,
      });

      const startedAt = Date.now();
      const toolResult = await executeTool(call.name ?? '', input);
      onEvent({
        type: 'tool_result',
        tool: call.name ?? '',
        duration: Date.now() - startedAt,
        result: toolResult.content,
        screenshots: toolResult.screenshots,
      });

      messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: call.id ?? '',
            content: toolResult.content,
          },
        ],
      });
    }
  }

  onEvent({ type: 'summary', thinkingBlocks: thinkingCount, toolCalls: toolCallCount });
  return finalResponse;
}

export async function performResearchWithStreaming(
  query: string,
  onEvent: (event: ResearchEvent) => void,
  scopeDataset?: string
): Promise<string> {
  return runResearch(query, onEvent, scopeDataset);
}

export async function performResearch(query: string): Promise<string> {
  return runResearch(query, () => {});
}
