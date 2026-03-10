// Posts API Route
// Place this in src/app/api/posts/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth/auth-options'

// Helper function to generate slug
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// GET /api/posts - List posts
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const published = searchParams.get('published')
    const authorId = searchParams.get('authorId')
    const tag = searchParams.get('tag')

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (published !== null) {
      where.published = published === 'true'
    }
    
    if (authorId) {
      where.authorId = authorId
    }
    
    if (tag) {
      where.tags = {
        some: {
          slug: tag,
        },
      }
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          published: true,
          publishedAt: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          tags: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              comments: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.post.count({ where }),
    ])

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching posts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/posts - Create a new post
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()

    // Validate input
    const postSchema = z.object({
      title: z.string().min(3, 'Title must be at least 3 characters'),
      content: z.string().min(10, 'Content must be at least 10 characters'),
      excerpt: z.string().optional(),
      coverImage: z.string().optional(),
      published: z.boolean().default(false),
      tagIds: z.array(z.string()).optional(),
    })

    const result = postSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.errors },
        { status: 400 }
      )
    }

    // Generate slug
    let slug = generateSlug(result.data.title)
    let existingPost = await prisma.post.findUnique({ where: { slug } })
    let counter = 1
    
    while (existingPost) {
      slug = `${generateSlug(result.data.title)}-${counter}`
      existingPost = await prisma.post.findUnique({ where: { slug } })
      counter++
    }

    // Create post
    const post = await prisma.post.create({
      data: {
        ...result.data,
        slug,
        authorId: session.user.id,
        publishedAt: result.data.published ? new Date() : null,
        tags: result.data.tagIds
          ? {
              connect: result.data.tagIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        tags: true,
      },
    })

    return NextResponse.json(post, { status: 201 })
  } catch (error) {
    console.error('Error creating post:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
