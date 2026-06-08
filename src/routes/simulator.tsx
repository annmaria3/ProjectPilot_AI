import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useProject } from "@/lib/project-store";
import { askPilot, generateRisks } from "@/lib/ai.functions";

export const Route = createFileRoute("/simulator")({
  component: SimulatorPage,
});

function SimulatorPage() {
  const { state } = useProject();

  const askPilotFn = useServerFn(askPilot);
  const riskFn = useServerFn(generateRisks);

  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState("");
  const [risks, setRisks] = useState("");

  const successProbability = useMemo(() => {
    let score = 50;

    if (state?.teamSize >= 4) score += 10;
    if (state?.durationWeeks >= 8) score += 10;
    if (state?.skillLevel >= 6) score += 15;

    return Math.min(score, 95);
  }, [state]);

  const explainForecast = async () => {
    try {
      setAiBusy(true);

      const res = await askPilotFn({
        data: {
          system:
            "You are a senior software architect. Give concise project advice.",
          messages: [
            {
              role: "user",
              content: `
Project: ${state?.name}

Description:
${state?.description}

Team Size:
${state?.teamSize}

Duration:
${state?.durationWeeks}

Skill Level:
${state?.skillLevel}

Success Probability:
${successProbability}%

Explain:
1. Major risks
2. Improvements
3. Recommended next steps
`,
            },
          ],
        },
      });

      if ("error" in res && res.error) {
        alert(res.error);
        return;
      }

      setAiText((res as any).content || "");
    } catch (err) {
      console.error(err);
      alert("AI Error");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">

      <h1 className="text-3xl font-bold mb-6">
        Project Simulator
      </h1>

      <div className="border rounded p-5 mb-6">
        <h2 className="text-xl font-semibold">
          Success Forecast
        </h2>

        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded h-4">
            <div
              className="bg-green-500 h-4 rounded"
              style={{
                width: `${successProbability}%`,
              }}
            />
          </div>

          <p className="mt-3 text-lg font-semibold">
            {successProbability}% Success Probability
          </p>
        </div>
      </div>

      <div className="border rounded p-5 mb-6">

        <h2 className="text-xl font-semibold mb-4">
          Project Parameters
        </h2>

        <p>
          Team Size: {state?.teamSize}
        </p>

        <p>
          Duration: {state?.durationWeeks} weeks
        </p>

        <p>
          Skill Level: {state?.skillLevel}/10
        </p>

      </div>

      <div className="border rounded p-5 mb-6">

        <div className="flex justify-between items-center">

          <h2 className="text-xl font-semibold">
            AI Forecast Analysis
          </h2>

          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={explainForecast}
          >
            {aiBusy ? "Analyzing..." : "Explain Forecast"}
          </button>

        </div>

        {aiText && (
          <div className="border rounded p-4 mt-4 whitespace-pre-wrap">
            {aiText}
          </div>
        )}

      </div>

      <div className="border rounded p-5">

        <div className="flex justify-between items-center">

          <h2 className="text-xl font-semibold">
            Risk Analysis
          </h2>

          <button
            className="bg-red-600 text-white px-4 py-2 rounded"
            onClick={async () => {

              const res = await riskFn({
                data: {
                  projectName: state?.name || "",
                },
              }) as {
                risks?: string;
                error?: string;
              };

              if (res.error) {
                alert(res.error);
                return;
              }

              setRisks(res.risks || "");
            }}
          >
            Analyze Risks
          </button>

        </div>

        {risks && (
          <div className="border rounded p-4 mt-4 whitespace-pre-wrap">
            {risks}
          </div>
        )}

      </div>

    </div>
  );
}