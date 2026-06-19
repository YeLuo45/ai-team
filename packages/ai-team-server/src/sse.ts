// Server-Sent Events (SSE) manager

import { Response } from 'express';

type Client = { id: string; res: Response };

export class SSEManager {
  private clients = new Map<string, Client>();
  private nextId = 1;

  addClient(res: Response): string {
    const id = `c${this.nextId++}`;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    // Send initial keep-alive
    this.send(res, 'connected', { id });
    this.clients.set(id, { id, res });
    return id;
  }

  removeClient(id: string): void {
    this.clients.delete(id);
  }

  /** Broadcast an event to all SSE clients */
  broadcast(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of this.clients.values()) {
      try {
        c.res.write(payload);
      } catch {
        // Client disconnected
        this.clients.delete(c.id);
      }
    }
  }

  /** Number of active clients */
  size(): number {
    return this.clients.size;
  }

  /** Get a specific client config */
  get(id: string): Client | undefined {
    return this.clients.get(id);
  }

  private send(res: Response, event: string, data: unknown): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

export const sseManager = new SSEManager();
