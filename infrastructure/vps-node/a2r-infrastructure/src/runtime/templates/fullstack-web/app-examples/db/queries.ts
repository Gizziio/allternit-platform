// Database Query Helpers
// Place this in src/lib/db/queries.ts

import { prisma } from '@/lib/prisma'

/**
 * User Queries
 */

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      bio: true,
      location: true,
      website: true,
      createdAt: true,
    },
  })
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  })
}

export async function updateUser(
  id: string,
  data: {
    name?: string
    bio?: string
    location?: string
    website?: string
    image?: string
  }
) {
  return prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      bio: true,
      location: true,
      website: true,
    },
  })
}

/**
 * Post Queries
 */

export async function getPostBySlug(slug: string) {
  return prisma.post.findUnique({
    where: { slug },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      tags: true,
      comments: {
        where: { parentId: null },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          replies: {
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

export async function getPublishedPosts(options?: {
  limit?: number
  cursor?: string
  authorId?: string
  tagSlug?: string
}) {
  const { limit = 10, cursor, authorId, tagSlug } = options || {}

  return prisma.post.findMany({
    where: {
      published: true,
      ...(authorId && { authorId }),
      ...(tagSlug && {
        tags: {
          some: { slug: tagSlug },
        },
      }),
      ...(cursor && {
        id: { lt: cursor },
      }),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImage: true,
      publishedAt: true,
      author: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      tags: {
        select: {
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
    take: limit,
    orderBy: { publishedAt: 'desc' },
  })
}

export async function getUserPosts(userId: string) {
  return prisma.post.findMany({
    where: { authorId: userId },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      published: true,
      publishedAt: true,
      createdAt: true,
      _count: {
        select: {
          comments: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Comment Queries
 */

export async function createComment(data: {
  content: string
  authorId: string
  postId: string
  parentId?: string
}) {
  return prisma.comment.create({
    data,
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  })
}

export async function getCommentsByPostId(postId: string) {
  return prisma.comment.findMany({
    where: { postId, parentId: null },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      replies: {
        include: {
          author: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Tag Queries
 */

export async function getAllTags() {
  return prisma.tag.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: {
          posts: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  })
}

export async function getOrCreateTag(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  
  return prisma.tag.upsert({
    where: { slug },
    update: {},
    create: {
      name,
      slug,
    },
  })
}

/**
 * Dashboard Stats
 */

export async function getDashboardStats(userId: string) {
  const [totalPosts, publishedPosts, totalComments, recentPosts] = await Promise.all([
    prisma.post.count({ where: { authorId: userId } }),
    prisma.post.count({ where: { authorId: userId, published: true } }),
    prisma.comment.count({
      where: {
        post: { authorId: userId },
      },
    }),
    prisma.post.findMany({
      where: { authorId: userId },
      select: {
        id: true,
        title: true,
        slug: true,
        published: true,
        createdAt: true,
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return {
    totalPosts,
    publishedPosts,
    draftPosts: totalPosts - publishedPosts,
    totalComments,
    recentPosts,
  }
}
