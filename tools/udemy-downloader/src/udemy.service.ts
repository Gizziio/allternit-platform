/**
 * Udemy Service - Core API Interface
 * Extracted and modernized from udemy-downloader-gui
 * 
 * Handles authentication, course listing, and content fetching
 */

import axios, { AxiosInstance } from 'axios';

export interface UdemyCourse {
  id: number;
  title: string;
  headline: string;
  description?: string;
  url: string;
  image_240x135: string;
  image_480x270?: string;
  published_title: string;
  num_subscribers?: number;
  num_lectures?: number;
  content_length?: number;
  is_practice_test_course?: boolean;
  has_closed_caption?: boolean;
  created?: string;
}

export interface UdemyCourseContent {
  id: number;
  title: string;
  _class: 'chapter' | 'lecture' | 'quiz' | 'practice';
  asset?: {
    asset_type: string;
    body?: string;
    data?: { body?: string };
    download_urls?: Record<string, Array<{ file: string; label: string }>>;
    streams?: {
      minQuality?: string;
      [key: string]: string | undefined;
    };
    url_set?: Record<string, Array<{ file: string }>>;
    captions?: Array<{
      url: string;
      locale: string;
      label: string;
    }>;
    supplementary_assets?: Array<{
      title: string;
      filename: string;
      download_urls: Array<{ file: string }>;
    }>;
  };
  supplementary_assets?: Array<{
    title: string;
    filename: string;
    download_urls: Array<{ file: string }>;
  }>;
  complete?: boolean;
  time?: string;
}

export interface UdemyCourseContentResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: UdemyCourseContent[];
}

export interface UdemyCoursesResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: UdemyCourse[];
}

export interface UdemyUserContext {
  header: {
    user: {
      email: string;
      display_name: string;
      enableLabsInPersonalPlan?: boolean;
      consumer_subscription_active?: boolean;
    };
    organization?: {
      id: number;
      name: string;
    };
    isLoggedIn: boolean;
  };
}

export interface DownloadOptions {
  videoQuality?: string;
  skipSubtitles?: boolean;
  defaultSubtitle?: string;
  downloadStart?: number;
  downloadEnd?: number;
}

class UdemyService {
  private client: AxiosInstance;
  private subDomain: string;
  private timeout: number;

  constructor(subDomain: string = 'www', timeout: number = 40000) {
    this.subDomain = subDomain;
    this.timeout = timeout;
    this.client = axios.create({
      baseURL: `https://${subDomain}.udemy.com`,
      timeout: this.timeout,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
  }

  setAccessToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  async fetchProfile(accessToken: string, timeout?: number): Promise<UdemyUserContext> {
    const response = await axios.get<UdemyUserContext>(
      `https://${this.subDomain}.udemy.com/api-2.0/contexts/?current_user=true&recommendations=true`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: timeout || this.timeout,
      }
    );
    return response.data;
  }

  async fetchCourses(
    page: number = 1,
    pageSize: number = 25,
    search?: string,
    subscriber: boolean = false
  ): Promise<UdemyCoursesResponse> {
    const params: Record<string, any> = {
      'ordering': '-last_accessed',
      'p': page,
      'page_size': pageSize,
      'fields[user:me]': 'subscriber',
      'fields[course]': 'id,url,title,headline,published_title,num_subscribers,image_240x135,image_480x270',
    };

    if (search) {
      params['search'] = search;
    }

    if (subscriber) {
      params['subscriber'] = true;
    }

    const response = await this.client.get<UdemyCoursesResponse>(
      '/api-2.0/users/me/subscribed-courses',
      { params }
    );
    return response.data;
  }

  async fetchCourseContent(
    courseId: number,
    fields: string = 'all'
  ): Promise<UdemyCourseContentResponse> {
    const params: Record<string, any> = {
      'fields[lecture]': 'title,object_index,created,asset,supplementary_assets,complete,time',
      'fields[quiz]': 'title,object_index,type',
      'fields[practice]': 'title,object_index,type',
      'fields[chapter]': 'title,object_index',
      'fields[asset]': 'title,asset_type,body,data,download_urls,stream_urls,video_thumbnails,captions,url_set,external_url,media_sources,media_license_token,supplementary_assets',
      'fields[subscriber]': 'id',
      'disable_headings': 'true',
      'page_size': 10000,
    };

    if (fields !== 'all') {
      params['fields'] = fields;
    }

    const response = await this.client.get<UdemyCourseContentResponse>(
      `/api-2.0/courses/${courseId}/cached-subscriber-curriculum-items`,
      { params }
    );
    return response.data;
  }

  async fetchCourseDetails(courseId: number): Promise<UdemyCourse> {
    const response = await this.client.get<UdemyCourse>(
      `/api-2.0/courses/${courseId}/`,
      {
        params: {
          'fields[course]': 'id,title,headline,description,url,image_240x135,image_480x270,published_title,num_subscribers,num_lectures,content_length,has_closed_caption,created',
        }
      }
    );
    return response.data;
  }

  async fetchSubtitles(
    courseId: number,
    lectureId: number
  ): Promise<Array<{ url: string; locale: string; label: string }>> {
    try {
      const content = await this.fetchCourseContent(courseId);
      const lecture = content.results.find(
        (item) => item.id === lectureId && item.asset?.captions
      );
      return lecture?.asset?.captions || [];
    } catch (error) {
      console.error('Error fetching subtitles:', error);
      return [];
    }
  }

  async downloadFile(url: string, headers?: Record<string, string>): Promise<ArrayBuffer> {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: headers || {},
      timeout: this.timeout * 3, // Longer timeout for downloads
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return response.data;
  }

  async streamDownload(
    url: string,
    onProgress?: (downloaded: number, total: number) => void
  ): Promise<ReadableStream> {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: this.timeout * 3,
    });

    const total = parseInt(response.headers['content-length'] || '0', 10);
    let downloaded = 0;

    const stream = new ReadableStream({
      start: (controller) => {
        response.data.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          onProgress?.(downloaded, total);
          controller.enqueue(chunk);
        });
        response.data.on('end', () => {
          controller.close();
        });
        response.data.on('error', (error: Error) => {
          controller.error(error);
        });
      },
    });

    return stream;
  }

  getBaseUrl(): string {
    return `https://${this.subDomain}.udemy.com`;
  }

  getCourseUrl(courseId: number): string {
    return `/course/${courseId}`;
  }

  getContentUrl(courseId: number, contentId: number, type: string): string {
    return `/course/${courseId}/learn/lecture/${contentId}`;
  }
}

export default UdemyService;
