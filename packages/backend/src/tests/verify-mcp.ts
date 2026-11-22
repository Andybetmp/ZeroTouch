import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function verifyMcpServer() {
  console.log('🔌 Iniciando prueba de integración del Servidor MCP contra Supabase PostgreSQL...');

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/mcp/stdio.ts'],
  });

  const client = new Client(
    { name: 'bateas-sdd-verifier', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log('  ✅ 1. Cliente MCP conectado por stdio al Servidor MCP (bateas-zerotouch-mcp).');

  // 1. Verificar Tools registradas
  const toolsList = await client.listTools();
  const toolNames = toolsList.tools.map((t) => t.name);
  console.log(`  ✅ 2. Tools MCP descubiertas (${toolNames.length}): ${toolNames.join(', ')}`);
  assert.ok(toolNames.includes('verify_garita_qr'), 'Debe incluir la Tool verify_garita_qr de la Spec 04');
  assert.equal(toolNames.length, 8, 'El servidor MCP debe exponer las 8 Tools operativas');

  // 2. Verificar Resources registrados
  const resourcesList = await client.listResources();
  const resourceUris = resourcesList.resources.map((r) => r.uri);
  console.log(`  ✅ 3. Resources MCP descubiertos (${resourceUris.length}): ${resourceUris.join(', ')}`);
  assert.equal(resourceUris.length, 3, 'El servidor MCP debe exponer los 3 Resources de la Spec 04');

  // 3. Leer Resource de KPIs en Supabase
  const metricsResource = await client.readResource({ uri: 'bateas://metrics/summary' });
  const metricsData = JSON.parse((metricsResource.contents[0] as any).text);
  console.log('  ✅ 4. Lectura de Resource bateas://metrics/summary desde Supabase:', metricsData);
  assert.ok(metricsData.totalWorkers >= 3, 'Debe haber al menos 3 expedientes sembrados en Supabase');

  // 4. Invocar Tool get_worker_traffic_light para el caso Zero-Touch (DNI 72458910)
  const workerToolRes = await client.callTool({
    name: 'get_worker_traffic_light',
    arguments: { dni: '72458910' },
  });
  const workerPayload = JSON.parse(((workerToolRes.content as any)[0] as any).text);
  assert.equal(workerPayload.trafficLight, 'VERDE', 'El trabajador 72458910 debe estar en Semáforo VERDE');
  assert.ok(workerPayload.digitalBadge?.badgeCode, 'Debe tener Carné Digital QR emitido');
  console.log(
    `  ✅ 5. Tool get_worker_traffic_light verificada: ${workerPayload.fullName} -> Semáforo ${workerPayload.trafficLight} (QR: ${workerPayload.digitalBadge.badgeCode})`
  );

  // 5. Invocar Tool list_exception_tray
  const trayRes = await client.callTool({
    name: 'list_exception_tray',
    arguments: { status: 'OPEN' },
  });
  const trayTickets = JSON.parse(((trayRes.content as any)[0] as any).text);
  console.log(`  ✅ 6. Tool list_exception_tray verificada: ${trayTickets.length} ticket(s) abierto(s) en Bandeja de Excepciones.`);

  // 6. Invocar Tool verify_garita_qr (Fase 4 - Spec 04)
  const verifyRes = await client.callTool({
    name: 'verify_garita_qr',
    arguments: { badgeCodeOrDni: '72458910' },
  });
  const verifyPayload = JSON.parse(((verifyRes.content as any)[0] as any).text);
  assert.equal(verifyPayload.accessGranted, true, 'El trabajador 72458910 debe tener acceso autorizado en Garita');
  assert.equal(verifyPayload.signatureValid, true, 'La firma criptográfica HMAC-SHA256 debe ser válida');
  console.log(`  ✅ 7. Tool verify_garita_qr verificada: ${verifyPayload.reason}`);

  await client.close();
  console.log('🎉 Verificación E2E del Servidor MCP + Supabase PostgreSQL completada con éxito.');
}

verifyMcpServer().catch((err) => {
  console.error('❌ Error en prueba de integración MCP:', err);
  process.exit(1);
});
