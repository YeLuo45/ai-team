// V112: ApprovalPanel flow — render queue + decide actions

import { useApprovalDecide, useApprovalQueue } from '../lib/data-layer/resources.js';

interface Approval {
  id: string;
  decision?: string;
}

export default function ApprovalPanel() {
  const { data, refetch } = useApprovalQueue();
  const { decide } = useApprovalDecide();
  const list = ((data ?? []) as unknown as Approval[]);

  async function onApprove(id: string) {
    try {
      await decide(id, 'approved');
      await refetch();
    } catch {
      /* rollback handled by useResourceMutation */
    }
  }

  return (
    <div data-testid="approval-panel">
      {list.map((a) => (
        <div key={a.id} data-testid={`approval-${a.id}`}>
          <span>{a.id}</span>
          <button data-testid={`approval-${a.id}-approve`} onClick={() => onApprove(a.id)}>
            Approve
          </button>
        </div>
      ))}
    </div>
  );
}