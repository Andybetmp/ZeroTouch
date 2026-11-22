import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createBateasMcpServer } from './server.js';

async function main() {
  const server = createBateasMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Error fatal en Bateas Zero-Touch MCP Server (stdio):', err);
  process.exit(1);
});
