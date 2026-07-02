import { useParams } from 'react-router-dom';
import { GoalDetailView } from '@/views/automation/GoalDetailView';

export default function GoalDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <GoalDetailView goalId={id ?? ''} />;
}
