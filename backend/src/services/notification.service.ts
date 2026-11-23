import { Response } from 'express';

interface SSEClient {
  id: string;
  userId: string;
  res: Response;
}

class NotificationService {
  private clients: SSEClient[] = [];

  public addClient(id: string, userId: string, res: Response) {
    this.clients.push({ id, userId, res });
    console.log(`[SSE] Client connected: ${userId} (${id}). Total clients: ${this.clients.length}`);

    // Heartbeat every 25 seconds to keep connection alive
    const interval = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 25000);

    res.on('close', () => {
      clearInterval(interval);
      this.clients = this.clients.filter(c => c.id !== id);
      console.log(`[SSE] Client disconnected: ${userId} (${id}). Remaining: ${this.clients.length}`);
    });
  }

  public notifyUser(userId: string, event: string, data: any) {
    const targetClients = this.clients.filter(c => c.userId === userId || userId === 'all');
    for (const client of targetClients) {
      client.res.write(`event: ${event}\n`);
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }

  public broadcast(event: string, data: any) {
    for (const client of this.clients) {
      client.res.write(`event: ${event}\n`);
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }
}

export const notificationService = new NotificationService();
