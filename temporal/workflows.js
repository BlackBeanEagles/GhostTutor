// Durable nightly study coach. Survives server restarts, retries flaky Gemma calls,
// and remembers where it was: if the worker dies at 9:58pm, the 10pm nudge still happens.
import { proxyActivities, sleep, continueAsNew } from '@temporalio/workflow';

const { studiedToday, leaveNudge, msUntilHour } = proxyActivities({
  startToCloseTimeout: '2 minutes',
  retry: { initialInterval: '10 seconds', backoffCoefficient: 2, maximumAttempts: 6 },
});

export async function studyCoach({ hour = 21, nights = 14 } = {}) {
  for (let night = 0; night < nights; night++) {
    await sleep(await msUntilHour(hour));
    if (await studiedToday()) continue;

    await leaveNudge('gentle');          // 1st: a kind reminder
    await sleep('90 minutes');
    if (await studiedToday()) continue;

    await leaveNudge('escalate');        // 2nd: the persona turns up the heat
  }
  // Keep event history small: carry on as a fresh run with the same settings.
  await continueAsNew({ hour, nights });
}
