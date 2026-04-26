import fs from 'fs/promises';

const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';

async function canvasApi(method: string, pathStr: string, body?: any) {
  const url = `${BASE_URL}${pathStr}`;
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${CANVAS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);
  const resp = await fetch(url, options);
  if (!resp.ok && resp.status !== 204) {
    const text = await resp.text();
    throw new Error(`Canvas API ${method} ${pathStr} failed: ${resp.status} ${text}`);
  }
  if (resp.status === 204) return null;
  return await resp.json();
}

async function getMyCourses(): Promise<{ id: number; course_code: string }[]> {
  const courses: any[] = [];
  let page = 1;
  while (true) {
    const resp = await fetch(`${BASE_URL}/courses?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${CANVAS_TOKEN}` }
    });
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) break;
    courses.push(...data);
    page++;
    if (page > 5) break;
  }
  return courses
    .filter(c => c.course_code?.startsWith('ALABS-'))
    .map(c => ({ id: c.id, course_code: c.course_code }));
}

async function getModules(courseId: number): Promise<{ id: number; name: string }[]> {
  const data = await canvasApi('GET', `/courses/${courseId}/modules?per_page=100`) as any[];
  return data.map(m => ({ id: m.id, name: m.name }));
}

async function addExternalUrl(courseId: number, moduleId: number, title: string, url: string, position: number) {
  return await canvasApi('POST', `/courses/${courseId}/modules/${moduleId}/items`, {
    module_item: {
      title,
      type: 'ExternalUrl',
      external_url: url,
      position,
      published: true,
      new_tabs: true,
    }
  });
}

async function addTextHeader(courseId: number, moduleId: number, title: string, position: number) {
  return await canvasApi('POST', `/courses/${courseId}/modules/${moduleId}/items`, {
    module_item: {
      title,
      type: 'SubHeader',
      position,
      published: true,
    }
  });
}

const RESOURCES: Record<string, { moduleName: string; items: { title: string; url?: string }[] }[]> = {
  'ALABS-OPS-RAG': [
    {
      moduleName: 'RAG Architecture',
      items: [
        { title: '📚 LLMWare Documentation', url: 'https://llmware-ai.github.io/llmware/' },
        { title: '📚 Chroma Vector Database Docs', url: 'https://docs.trychroma.com/' },
        { title: '📚 Sentence-Transformers Docs', url: 'https://www.sbert.net/' },
      ]
    },
    {
      moduleName: 'Local LLM Inference',
      items: [
        { title: '📚 Ollama Documentation', url: 'https://github.com/ollama/ollama/blob/main/README.md' },
        { title: '📚 LM Studio Guides', url: 'https://lmstudio.ai/docs' },
        { title: '📚 llama.cpp Wiki', url: 'https://github.com/ggerganov/llama.cpp/wiki' },
      ]
    },
    {
      moduleName: 'Semantic Search Implementation',
      items: [
        { title: '📚 FAISS Documentation', url: 'https://github.com/facebookresearch/faiss/wiki' },
        { title: '📚 OpenAI Embeddings Guide', url: 'https://platform.openai.com/docs/guides/embeddings' },
        { title: '📚 Vector Search Best Practices', url: 'https://www.pinecone.io/learn/vector-search/' },
      ]
    },
  ],
  'ALABS-OPS-VISION': [
    {
      moduleName: 'OpenCV + Python Foundations',
      items: [
        { title: '📚 OpenCV Official Docs', url: 'https://docs.opencv.org/4.x/d6/d00/tutorial_py_root.html' },
        { title: '📚 PyImageSearch Tutorials', url: 'https://pyimagesearch.com/free-opencv-crash-course/' },
        { title: '📚 OpenCV Python Examples', url: 'https://github.com/opencv/opencv/tree/master/samples/python' },
      ]
    },
    {
      moduleName: 'Feature Detection & Tracking',
      items: [
        { title: '📚 OpenCV Feature Detection', url: 'https://docs.opencv.org/4.x/db/d27/tutorial_py_table_of_contents_feature2d.html' },
        { title: '📚 Optical Flow Tutorial', url: 'https://docs.opencv.org/4.x/d7/d8b/tutorial_py_lucas_kanade.html' },
        { title: '📚 Object Tracking Guide', url: 'https://pyimagesearch.com/2018/07/30/opencv-object-tracking/' },
      ]
    },
    {
      moduleName: 'Face & Object Detection with Deep Learning',
      items: [
        { title: '📚 OpenCV DNN Module', url: 'https://docs.opencv.org/4.x/d2/d58/tutorial_table_of_content_dnn.html' },
        { title: '📚 YOLO Documentation', url: 'https://docs.ultralytics.com/' },
        { title: '📚 MediaPipe Solutions', url: 'https://developers.google.com/mediapipe/solutions/vision' },
        { title: '📚 Anthropic Computer Use SDK', url: 'https://docs.anthropic.com/en/docs/build-with-claude/computer-use' },
      ]
    },
  ],
  'ALABS-AGENTS-AGENTS': [
    {
      moduleName: 'Agent Architecture Patterns',
      items: [
        { title: '📚 Anthropic Building Effective Agents', url: 'https://www.anthropic.com/engineering/building-effective-agents' },
        { title: '📚 ReAct Paper (Reasoning + Acting)', url: 'https://arxiv.org/abs/2210.03629' },
        { title: '📚 OpenAI Function Calling Guide', url: 'https://platform.openai.com/docs/guides/function-calling' },
      ]
    },
    {
      moduleName: 'Tool-Using Agents',
      items: [
        { title: '📚 Model Context Protocol (MCP) Spec', url: 'https://modelcontextprotocol.io/' },
        { title: '📚 Anthropic MCP Docs', url: 'https://docs.anthropic.com/en/docs/build-with-claude/mcp' },
        { title: '📚 OpenAI Tools API', url: 'https://platform.openai.com/docs/guides/function-calling' },
      ]
    },
    {
      moduleName: 'Code-Generation Agents',
      items: [
        { title: '📚 GitHub Copilot Agent Mode', url: 'https://github.blog/news-insights/product-news/github-copilot-the-agent-awakens/' },
        { title: '📚 Cursor Composer Docs', url: 'https://docs.cursor.com/composer' },
        { title: '📚 SWE-bench Evaluation', url: 'https://www.swebench.com/' },
      ]
    },
    {
      moduleName: 'Multi-Agent Orchestration',
      items: [
        { title: '📚 LangGraph Multi-Agent', url: 'https://langchain-ai.github.io/langgraph/concepts/multi_agent/' },
        { title: '📚 CrewAI Documentation', url: 'https://docs.crewai.com/' },
        { title: '📚 AutoGen Framework', url: 'https://microsoft.github.io/autogen/' },
      ]
    },
  ],
};

async function addResourcesToCourse(courseId: number, courseCode: string) {
  console.log(`\n--- Adding resources to ${courseCode} (ID: ${courseId}) ---`);
  
  const modules = await getModules(courseId);
  const courseResources = RESOURCES[courseCode];
  if (!courseResources) {
    console.log(`  No external resources defined for ${courseCode}`);
    return;
  }
  
  for (const res of courseResources) {
    const mod = modules.find(m => m.name === res.moduleName);
    if (!mod) {
      console.log(`  ⚠️ Module not found: ${res.moduleName}`);
      continue;
    }
    
    const items = await canvasApi('GET', `/courses/${courseId}/modules/${mod.id}/items?per_page=100`) as any[];
    const maxPosition = items.length > 0 ? Math.max(...items.map(i => i.position || 0)) : 0;
    let position = maxPosition + 1;
    
    // Check if resources already added
    const hasResources = items.some(i => i.title?.includes('📚'));
    if (hasResources) {
      console.log(`  ⏭️ Skipping ${res.moduleName} (resources already added)`);
      continue;
    }
    
    await addTextHeader(courseId, mod.id, 'External Resources', position++);
    
    for (const item of res.items) {
      if (item.url) {
        await addExternalUrl(courseId, mod.id, item.title, item.url, position++);
      } else {
        await addTextHeader(courseId, mod.id, item.title, position++);
      }
    }
    console.log(`  ✅ Added ${res.items.length} resources to ${res.moduleName}`);
  }
}

async function main() {
  const courses = await getMyCourses();
  console.log('Found A://Labs courses:');
  for (const c of courses) {
    console.log(`  ${c.course_code}: ${c.id}`);
  }
  
  for (const c of courses) {
    await addResourcesToCourse(c.id, c.course_code);
  }
  
  console.log('\n✅ External resources added!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
