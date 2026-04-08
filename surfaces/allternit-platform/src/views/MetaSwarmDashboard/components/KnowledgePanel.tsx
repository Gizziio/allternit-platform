/**
 * Knowledge Panel
 * 
 * Displays and searches the knowledge base:
 * - Pattern browser with filtering
 * - Solution search
 * - Effectiveness charts
 * - Cross-mode learning visualization
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookOpen,
  MagnifyingGlass,
  TrendUp,
  Star,
  Cpu,
  Funnel,
  Sparkle,
} from '@phosphor-icons/react';
import type { Pattern } from '../types';
import { metaSwarmClient } from '../api';

interface KnowledgePanelProps {
  className?: string;
}

interface PatternCardProps {
  pattern: Pattern;
}

function PatternCard({ pattern }: PatternCardProps) {
  const typeColors: Record<string, string> = {
    architecture: 'bg-purple-100 text-purple-800',
    collaboration: 'bg-blue-100 text-blue-800',
    fix: 'bg-green-100 text-green-800',
    prevention: 'bg-yellow-100 text-yellow-800',
    root_cause: 'bg-red-100 text-red-800',
    process: 'bg-gray-100 text-gray-800',
  };

  const effectiveness = pattern.effectiveness.success_rate * 100;

  return (
    <div className="p-4 rounded-lg border hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-medium">{pattern.name}</h4>
          <p className="text-xs text-muted-foreground">{pattern.domain}</p>
        </div>
        <Badge className={typeColors[pattern.pattern_type] || 'bg-gray-100'}>
          {pattern.pattern_type}
        </Badge>
      </div>
      
      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
        {pattern.description}
      </p>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-yellow-500" />
            <span className={effectiveness >= 80 ? 'text-green-600' : effectiveness >= 50 ? 'text-yellow-600' : 'text-red-600'}>
              {effectiveness.toFixed(0)}% success
            </span>
          </div>
          <div className="text-muted-foreground">
            {pattern.effectiveness.usage_count} uses
          </div>
        </div>
        <div className="text-muted-foreground">
          ${pattern.effectiveness.average_cost.estimated_usd.toFixed(2)} avg
        </div>
      </div>
    </div>
  );
}

export function KnowledgePanel({ className }: KnowledgePanelProps) {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [filteredPatterns, setFilteredPatterns] = useState<Pattern[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    metaSwarmClient
      .getPatterns()
      .then((data) => {
        setPatterns(data);
        setFilteredPatterns(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch patterns:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let filtered = patterns;

    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.domain.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter((p) => p.pattern_type === selectedType);
    }

    setFilteredPatterns(filtered);
  }, [searchQuery, selectedType, patterns]);

  const handleSearch = async () => {
    if (!searchQuery) return;
    
    setLoading(true);
    try {
      const results = await metaSwarmClient.queryPatterns(searchQuery);
      setFilteredPatterns(results);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const totalPatterns = patterns.length;
  const avgSuccessRate =
    patterns.length > 0
      ? patterns.reduce((sum, p) => sum + p.effectiveness.success_rate, 0) / patterns.length
      : 0;
  const totalUsage = patterns.reduce(
    (sum, p) => sum + p.effectiveness.usage_count,
    0
  );
  const topDomains = patterns
    .reduce((acc, p) => {
      acc[p.domain] = (acc[p.domain] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const patternTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'architecture', label: 'Architecture' },
    { value: 'collaboration', label: 'Collaboration' },
    { value: 'fix', label: 'Fix' },
    { value: 'prevention', label: 'Prevention' },
    { value: 'root_cause', label: 'Root Cause' },
    { value: 'process', label: 'Process' },
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={20} />
            Knowledge Base
          </div>
          <Badge variant="secondary">{totalPatterns} patterns</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patterns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-40">
              <Funnel className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {patternTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSearch} disabled={loading}>
            Search
          </Button>
        </div>

        <Tabs defaultValue="patterns" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="patterns" className="space-y-2">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading patterns...
              </div>
            ) : filteredPatterns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No patterns found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredPatterns.map((pattern) => (
                  <PatternCard key={pattern.id.id} pattern={pattern} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendUp size={16} />
                  Avg Success Rate
                </div>
                <div className="text-2xl font-bold">
                  {(avgSuccessRate * 100).toFixed(1)}%
                </div>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Cpu size={16} />
                  Total Usage
                </div>
                <div className="text-2xl font-bold">{totalUsage}</div>
              </div>
            </div>

            {/* Top Domains */}
            <div className="space-y-2">
              <h4 className="font-medium">Top Domains</h4>
              {Object.entries(topDomains)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([domain, count]) => (
                  <div
                    key={domain}
                    className="flex items-center justify-between p-2 rounded bg-muted"
                  >
                    <span>{domain}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
            </div>

            {/* Pattern Type Distribution */}
            <div className="space-y-2">
              <h4 className="font-medium">Pattern Types</h4>
              {Object.entries(
                patterns.reduce((acc, p) => {
                  acc[p.pattern_type] = (acc[p.pattern_type] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              )
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div
                    key={type}
                    className="flex items-center justify-between p-2 rounded bg-muted"
                  >
                    <span className="capitalize">{type.replace('_', ' ')}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
