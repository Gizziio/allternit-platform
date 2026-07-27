function create() {
  return Math.random().toString(36).slice(2, 10)
}

export const Slug = { create }
