import { NetworkSkill } from './skill-registry.js';

type NetworkLogEntry = {
  url: string;
  method: string;
  headers: Record<string, string>;
};

export class SkillGenerator {
  generateFromLog(name: string, log: NetworkLogEntry[]): NetworkSkill[] {
    const apiCalls = log.filter(entry =>
      entry.url.includes('/api-') ||
      (entry.headers['content-type'] && entry.headers['content-type'].includes('application/json'))
    );

    return apiCalls.map((entry, index) => {
      return {
        id: name + '-skill-' + index,
        name: name + ' ' + entry.method + ' ' + index,
        description: 'Auto-generated skill from network capture of ' + entry.url,
        urlPattern: entry.url,
        method: entry.method,
        requiredHeaders: Object.keys(entry.headers).filter(h => 
          ['authorization', 'cookie', 'x-csrf-token'].includes(h.toLowerCase())
        ),
        responseMapping: {}
      };
    });
  }
}
