// Start (or restart) the nightly coach. Usage: npm run schedule -- 21   (hour, 24h clock)
import { Client, Connection } from '@temporalio/client';
import { connectionOptions, namespace, TASK_QUEUE } from './connection.js';

const hour = Number(process.argv[2] ?? 21);
const client = new Client({ connection: await Connection.connect(connectionOptions), namespace });
const workflowId = 'ghost-tutor-study-coach';

try { await client.workflow.getHandle(workflowId).terminate('rescheduled'); } catch { /* none running */ }
await client.workflow.start('studyCoach', { taskQueue: TASK_QUEUE, workflowId, args: [{ hour, nights: 14 }] });
console.log(`Study coach started: nudges at ${hour}:00 for the next 14 nights (workflow ${workflowId}).`);
