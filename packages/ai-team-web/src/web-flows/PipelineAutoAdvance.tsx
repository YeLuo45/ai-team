// V112: PipelineAutoAdvance flow — finalize interview + advance pipeline

import { useInterviewFinalize, usePipelineAdvance } from '../lib/data-layer/resources.js';

export default function PipelineAutoAdvance({
  interviewId,
  pipelineId,
}: {
  interviewId: string;
  pipelineId: string;
}) {
  const { finalize } = useInterviewFinalize();
  const { advance } = usePipelineAdvance();

  async function run() {
    try {
      await finalize(interviewId);
      await advance(pipelineId, 'evaluation');
    } catch {
      /* error path covered in unit tests */
    }
  }

  return (
    <button data-testid="run-flow" onClick={run}>
      Finalize + Advance
    </button>
  );
}