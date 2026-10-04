// SerpApi: fresh practice material from the live web for a weak topic.
import { config } from './config.js';
import { traced } from './tracing.js';

export const searchOn = () => Boolean(config.serpKey);

export async function findPractice(subject, topic) {
  if (!searchOn()) return [];
  return traced('ghost.serpapi.search', { topic }, async () => {
    const q = `${subject} ${topic} practice questions with answers`;
    const url = `https://serpapi.com/search.json?engine=google&num=8&q=${encodeURIComponent(q)}&api_key=${config.serpKey}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`SerpApi ${r.status}`);
    const data = await r.json();
    return (data.organic_results ?? []).slice(0, 6).map((o) => ({ title: o.title, link: o.link, snippet: o.snippet ?? '' }));
  });
}
