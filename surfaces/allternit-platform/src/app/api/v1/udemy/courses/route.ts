/**
 * Udemy Enrolled Courses API Proxy
 * 
 * POST /api/v1/udemy/courses
 * 
 * Proxies requests to fetch user's enrolled courses from Udemy API.
 * Requires access token in the request body.
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';

interface CoursesRequestBody {
  accessToken: string;
  subDomain?: string;
  page?: number;
  pageSize?: number;
  search?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as CoursesRequestBody;
    const {
      accessToken,
      subDomain = 'www',
      page = 1,
      pageSize = 25,
      search,
    } = body;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 401 }
      );
    }

    const params = new URLSearchParams({
      'ordering': '-last_accessed',
      'p': page.toString(),
      'page_size': pageSize.toString(),
      'fields[course]': 'id,url,title,headline,published_title,num_subscribers,image_240x135,image_480x270',
    });

    if (search) {
      params.set('search', search);
    }

    const response = await fetch(
      `https://${subDomain}.udemy.com/api-2.0/users/me/subscribed-courses?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json, text/plain, */*',
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { 
          error: 'Failed to fetch courses',
          status: response.status,
          message: response.status === 401 ? 'Invalid or expired access token' : undefined,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      count: data.count,
      next: data.next,
      previous: data.previous,
      results: (data.results || []).map((course: any) => ({
        id: course.id,
        title: course.title,
        headline: course.headline,
        url: course.url,
        image_240x135: course.image_240x135,
        published_title: course.published_title,
        num_subscribers: course.num_subscribers,
      })),
    });

  } catch (error) {
    console.error('Enrolled courses fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enrolled courses', details: (error as Error).message },
      { status: 500 }
    );
  }
}
