/**
 * Runs the eval cases against whichever provider is configured.
 *
 *   npm run evals
 *
 * Prints a pass/fail table and exits non-zero if anything failed, so it can
 * sit in front of a model change rather than beside it.
 *
 * The automatic checks here are the structural ones, because those are the
 * ones a machine can judge: right number of days, every day populated, labels
 * present, mentions what it should. The expectations in cases.ts that need
 * taste ("a quieter tone", "a child could enjoy it") are printed alongside for
 * a human to read. Pretending a script can score those would be worse than
 * admitting it cannot.
 */

import { EVAL_CASES } from "../lib/ai/evals/cases";
import { streamItinerary, checkItinerary } from "../lib/ai/itinerary";
import { isAiConfigured } from "../lib/ai/provider";

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let text = "";
  for await (const chunk of stream) text += chunk;
  return text;
}

async function main() {
  if (!isAiConfigured()) {
    console.error("No AI provider configured. Set GEMINI_API_KEY or DEEPSEEK_API_KEY.");
    process.exit(1);
  }

  let failures = 0;

  for (const testCase of EVAL_CASES) {
    process.stdout.write(`${testCase.id.padEnd(22)} `);

    try {
      const started = Date.now();
      const stream = await streamItinerary({
        destination: testCase.destination,
        days: testCase.days,
        language: "English",
      });
      const text = await collect(stream.chunks);
      const elapsed = Date.now() - started;

      const check = checkItinerary(text, testCase.days);
      const problems = [...check.problems];

      for (const word of testCase.mustMention ?? []) {
        if (!text.toLowerCase().includes(word.toLowerCase())) {
          problems.push(`never mentions "${word}"`);
        }
      }

      if (problems.length === 0) {
        console.log(`PASS  ${stream.model}  ${elapsed}ms  ${check.dayCount} days`);
      } else {
        failures++;
        console.log(`FAIL  ${stream.model}  ${problems.join("; ")}`);
      }

      for (const expectation of testCase.expectations) {
        console.log(`         judge by eye: ${expectation}`);
      }
    } catch (error) {
      failures++;
      console.log(`ERROR ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(
    `\n${EVAL_CASES.length - failures}/${EVAL_CASES.length} passed the structural checks.`,
  );
  process.exit(failures > 0 ? 1 : 0);
}

main();
