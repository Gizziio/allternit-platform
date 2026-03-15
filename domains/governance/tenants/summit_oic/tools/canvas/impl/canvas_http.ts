/**
 * Canvas API Implementation for A2R Summit Tenant
 * Uses the Brain Runtime context for secret retrieval.
 */
export async function canvasRequest(path: string, method: string, body: any, context: any) {
  const config = JSON.parse(await context.fs.read('tenants/summit_oic/tenant.json'));
  const token = await context.secrets.get("canvas_api_token_ref");
  
  const response = await fetch(`${config.canvas.base_url}/api/v1${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    throw new Error(`Canvas API Error: ${response.status} ${await response.text()}`);
  }
  return await response.json();
}

export const tools = {
  create_module: async (args: any, context: any) => {
    return await canvasRequest(`/courses/${args.course_id}/modules`, 'POST', { 
      module: { name: args.name, published: args.published } 
    }, context);
  },
  create_page: async (args: any, context: any) => {
    return await canvasRequest(`/courses/${args.course_id}/pages`, 'POST', { 
      wiki_page: { title: args.title, body: args.body, published: args.published } 
    }, context);
  },
  add_module_item: async (args: any, context: any) => {
    return await canvasRequest(`/courses/${args.course_id}/modules/${args.module_id}/items`, 'POST', {
      module_item: { 
        title: args.title, 
        type: args.type, 
        content_id: args.content_id,
        external_url: args.external_url,
        new_tab: args.new_tab,
        indent: args.indent
      }
    }, context);
  },
  create_assignment: async (args: any, context: any) => {
    return await canvasRequest(`/courses/${args.course_id}/assignments`, 'POST', {
      assignment: {
        name: args.name,
        description: args.description,
        points_possible: args.points_possible,
        grading_type: args.grading_type,
        submission_types: args.submission_types,
        published: args.published,
        due_at: args.due_at
      }
    }, context);
  },
  publish_module: async (args: any, context: any) => {
    return await canvasRequest(`/courses/${args.course_id}/modules/${args.module_id}`, 'PUT', {
      module: { published: args.published }
    }, context);
  },
  list_courses: async (args: any, context: any) => {
    return await canvasRequest(`/courses`, 'GET', args, context);
  },
  list_modules: async (args: any, context: any) => {
    return await canvasRequest(`/courses/${args.course_id}/modules`, 'GET', args, context);
  },
  upload_file: async (args: any, context: any) => {
    // Simplified Canvas file upload (Step 1: Get upload URL)
    const uploadRef = await canvasRequest(`/courses/${args.course_id}/files`, 'POST', {
      name: args.name,
      parent_folder_path: args.parent_folder_path
    }, context);
    // Step 2 & 3 would follow in a full implementation
    return uploadRef;
  }
};
