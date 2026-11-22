import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { apiRouter } from './api/routes.js';
import { createBateasMcpServer } from './mcp/server.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    service: 'Bateas Zero-Touch Backend & MCP Server',
    stack: 'Node.js + TypeScript + Prisma + Supabase PostgreSQL',
    mcpEndpoints: {
      sse: '/mcp/sse',
      messages: '/mcp/messages',
    },
    timestamp: new Date().toISOString(),
  });
});

// 1. Rutas REST API para el Frontend en React (/api/v1/*)
app.use('/api/v1', apiRouter);

// 2. Transporte Remoto HTTP/SSE para el Servidor MCP (Despliegue Cloud)
const activeSseTransports = new Map<string, SSEServerTransport>();

app.get('/mcp/sse', async (_req, res) => {
  const mcpServer = createBateasMcpServer();
  const transport = new SSEServerTransport('/mcp/messages', res);
  activeSseTransports.set(transport.sessionId, transport);

  res.on('close', () => {
    activeSseTransports.delete(transport.sessionId);
  });

  await mcpServer.connect(transport);
});

app.post('/mcp/messages', async (req, res) => {
  const sessionId = String(req.query.sessionId || '');
  const transport = activeSseTransports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: 'Sesión MCP SSE no encontrada o expirada' });
    return;
  }
  await transport.handlePostMessage(req, res, req.body);
});

app.listen(PORT, () => {
  console.log(`🚀 [Bateas Zero-Touch] API REST corriendo en http://localhost:${PORT}/api/v1`);
  console.log(`🔌 [Bateas Zero-Touch] MCP Server (SSE) disponible en http://localhost:${PORT}/mcp/sse`);
});
