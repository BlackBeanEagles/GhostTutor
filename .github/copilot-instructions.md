# Ghost Tutor: notes for Copilot reviews

- Every partner integration is optional and must degrade gracefully when its env var is unset. A missing key should never crash the server or break the quiz loop.
- Questions must stay grounded in the student's notes. Flag any prompt change that lets the model invent facts.
- Never send the correct answer to the client before the student answers (`/api/quiz/next` strips `answer` and `explanation`).
- Temporal workflow code (`temporal/workflows.js`) must stay deterministic: no `Date.now()`, `fetch` or randomness there. Put that in activities.
- Keep the UI calm: respect `prefers-reduced-motion`, keep contrast readable in both night and dawn themes.
