import { NativeConnection, Worker } from '@temporalio/worker';
import { fileURLToPath } from 'node:url';
import * as activities from './activities.js';
import { connectionOptions, namespace, TASK_QUEUE } from './connection.js';

const connection = await NativeConnection.connect(connectionOptions);
const worker = await Worker.create({
  connection,
  namespace,
  taskQueue: TASK_QUEUE,
  workflowsPath: fileURLToPath(new URL('./workflows.js', import.meta.url)),
  activities,
});
console.log(`👻 Temporal worker listening on "${TASK_QUEUE}"`);
await worker.run();
