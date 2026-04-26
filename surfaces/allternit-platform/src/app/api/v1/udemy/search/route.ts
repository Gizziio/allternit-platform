export const dynamic = 'force-dynamic';
/**
 * Udemy Search API Proxy
 * 
 * POST /api/v1/udemy/search
 * 
 * Proxies search requests to Udemy's public API to avoid CORS issues.
 * Falls back to mock data if Udemy API is unreachable.
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { getMockCourses } from './mock-courses';

interface SearchRequestBody {
  query: string;
  page?: number;
  pageSize?: number;
  price?: 'free' | 'paid' | 'all';
  level?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as SearchRequestBody;
    const {
      query,
      page = 1,
      pageSize = 50,
      price = 'free',
      level,
    } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Try Udemy's public API first
    try {
      const params = new URLSearchParams({
        search: query,
        page: page.toString(),
        page_size: pageSize.toString(),
        ratings: '4.0,4.5,5.0',
      });

      if (price === 'free') {
        params.set('price', 'price-free');
      } else if (price === 'paid') {
        params.set('price', 'price-paid');
      }

      if (level) {
        params.set('instructional_level', level);
      }

      const udemyResponse = await fetch(
        `https://www.udemy.com/api-2.0/courses/?${params.toString()}`,
        {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(10000), // 10s timeout
        }
      );

      if (udemyResponse.ok) {
        const data = await udemyResponse.json();
        
        return NextResponse.json({
          source: 'udemy',
          count: data.count,
          next: data.next,
          previous: data.previous,
          results: (data.results || []).map((course: any) => ({
            id: course.id,
            title: course.title,
            headline: course.headline,
            url: course.url,
            image_240x135: course.image_240x135,
            rating: course.rating || 0,
            num_reviews: course.num_reviews || 0,
            num_subscribers: course.num_subscribers || 0,
            price: course.price || 'Free',
            is_paid: course.is_paid || false,
            level: course.instructional_level || 'All Levels',
            lang: course.locale || 'en',
            num_lectures: course.num_published_lectures || 0,
            published_title: course.published_title || '',
          })),
        });
      }
    } catch (udemyError) {
      console.log('Udemy API unreachable, falling back to mock data:', (udemyError as Error).message);
    }

    // Fallback to mock data
    const mockCourses = getMockCourses(query, { price, level });

    return NextResponse.json({
      source: 'mock',
      count: mockCourses.length,
      next: null,
      previous: null,
      results: mockCourses,
      note: 'Using mock data. Udemy API is currently unreachable.',
    });

  } catch (error) {
    console.error('Udemy search error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// GET endpoint - supports ?q=query&price=free
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const price = (searchParams.get('price') as 'free' | 'paid' | 'all') || 'free';
  const level = searchParams.get('level') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('page_size') || '50', 10);

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    );
  }

  // Reuse POST logic
  const mockBody = { query, page, pageSize, price, level };
  const mockRequest = new NextRequest(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(mockBody),
  });

  return POST(mockRequest);
}
