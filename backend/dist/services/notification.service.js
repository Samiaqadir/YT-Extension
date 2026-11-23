class NotificationService {
    clients = [];
    addClient(id, userId, res) {
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
    notifyUser(userId, event, data) {
        const targetClients = this.clients.filter(c => c.userId === userId || userId === 'all');
        for (const client of targetClients) {
            client.res.write(`event: ${event}\n`);
            client.res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    }
    broadcast(event, data) {
        for (const client of this.clients) {
            client.res.write(`event: ${event}\n`);
            client.res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    }
}
export const notificationService = new NotificationService();
