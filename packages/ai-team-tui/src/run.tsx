// TUI entry — bootstraps Ink and renders App

import { render } from 'ink';
import { App, ApiClient } from './index.js';

export async function run(): Promise<void> {
  const baseUrl = process.env.AI_TEAM_API_URL ?? 'http://localhost:3000';
  const api = new ApiClient(baseUrl);
  const { waitUntilExit } = render(<App api={api} />);
  await waitUntilExit();
}
