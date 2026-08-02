import { useParams } from 'react-router-dom';
import { AgentActivityDetailView } from '@/views/agent-activity/AgentActivityDetailView';

export default function AgentActivityDetailPage() {
  const { threadId } = useParams<{ threadId: string }>();
  return <AgentActivityDetailView threadId={threadId ?? ''} />;
}
