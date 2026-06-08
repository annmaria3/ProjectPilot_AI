import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

const RoadmapSchema = z.object({projectName: z.string(),});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  system: z.string().optional(),
});

const ArchitectureSchema = z.object({
  projectName: z.string(),
});

const RiskSchema = z.object({
  projectName: z.string(),
});

const MODEL = "gemini-2.5-flash-lite";
const AI_URL = "https://ai.gateway.p.dev/v1/chat/completions";

console.log("Using model:", MODEL);

type AiRequest = string | { model?: string; messages: { role: string; content: string }[] };

async function callAi(prompt: AiRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  console.log("API KEY EXISTS:", !!apiKey);
  

  if (!apiKey) {
    return { error: "Gemini API key not found." };
  }

  try {
    // Normalize to text prompt
    const textPrompt = typeof prompt === "string"
      ? prompt
      : prompt.messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");

    const model = typeof prompt === "object" && prompt.model ? prompt.model : MODEL;
    let response;

    for (let i = 0; i < 3; i++) {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: textPrompt }],
              },
            ],
          }),
        }
      );

      if (response.status !== 503) break;

      const retryData = await response.json();
      if (
        retryData.error?.message?.includes("quota") ||
        retryData.error?.message?.includes("rate")
      ) {
        return {
          error:
            "Gemini free tier limit reached. Please wait 1 minute and try again.",
        };
      }

      console.log(`Retry ${i + 1}/3 after 503...`);
      await new Promise((r) => setTimeout(r, 3000));
    }


    const data = await response!.json();

    console.log(JSON.stringify(data, null, 2));
    console.log("Gemini Response:", data);

if (data.error?.code === 503) {
  return {
    error:
      "Gemini servers are busy. Please click again in a few seconds.",
  };
}

if (data.error?.message?.includes("Quota")) {
  return {
    error:
      "Gemini free tier limit reached. Please wait 1 minute and try again.",
  };
}

if (data.error) {
  return {
    error: data.error.message || "Gemini error",
  };
}

const text =
  data?.candidates?.[0]?.content?.parts?.[0]?.text;

if (!text) {
  return {
    error: "Empty response from Gemini",
  };
}

return {
  content: text,
};
  } catch (err) {
    console.error(err);
    return { error: "Gemini request failed." };
  }
}

export const generateRisks = createServerFn({
  method: "POST",
})
  .inputValidator((input: unknown) =>
    RiskSchema.parse(input)
  )
  .handler(async ({ data }) => {

    const prompt = `
Project:
${data.projectName}

Generate:

Technical Risks
Project Risks
Deployment Risks

For each risk provide mitigation.

Keep concise.

Format:

TECHNICAL RISKS
- risk
Mitigation:
- mitigation

PROJECT RISKS
...

DEPLOYMENT RISKS
...
`;
    const res = await callAi(prompt);
    console.log("ROADMAP RESPONSE:", res);

    if ("error" in res) {
      return {
        error: res.error,
      };
    }

    return {
      risks: res.content,
    };
  });
  
export const generateRoadmap =
  createServerFn({ method: "POST" })
    .inputValidator((input: unknown) =>
      RoadmapSchema.parse(input)
    )
    .handler(async ({ data }) => {

      const prompt = `
Project:
${data.projectName}

Create a development roadmap.

Format:

Week 1:
...

Week 2:
...

Week 3:
...

Week 4:
...

Maximum 4 weeks.
`;

      const res =
        await callAi(prompt);

      if ("error" in res) {
        return {
          error: res.error,
        };
      }

      return {
        roadmap: res.content,
      };
    });

export const askPilot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const messages = data.system
      ? [{ role: "system" as const, content: data.system }, ...data.messages]
      : data.messages;
    //const system = data.system ?? "";
    //const userPrompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");

    const res = await callAi({ model: MODEL, messages });
    if ("error" in res) return { error: res.error };
    return {
  content: res.content ?? "",
};
  });

  export const generateArchitecture = createServerFn({
  method: "POST",
})
  .inputValidator((input: unknown) =>
    ArchitectureSchema.parse(input)
  )
  .handler(async ({ data }) => {

    const prompt = `
Project:
${data.projectName}

Generate software architecture.

Format exactly:

Frontend
↓
API Layer
↓
Business Logic
↓
Database

Then explain each layer briefly.

Keep under 150 words.
`;

    const res = await callAi(prompt);

    if ("error" in res) {
      return {
        error: res.error,
      };
    }

    return {
      architecture: res.content,
    };
  });

const BrainstormSchema = z.object({
  idea: z.string().min(5).max(2000),
  teamSize: z.number().int().min(1).max(50),
  durationWeeks: z.number().int().min(1).max(104),
  skillLevel: z.number().int().min(1).max(10),
  skills: z.string().max(500).default(""),
});


export interface BrainstormResult {
  name: string;
  description: string;
  modules: { slug: string; name: string; dependsOn: string[]; branchKeywords: string[] }[];
  recommendedStack: string[];
  successFactors: string[];
  risks: string[];
}

export const brainstormProject = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => BrainstormSchema.parse(input))
  .handler(async ({ data }): Promise<{ result?: BrainstormResult; error?: string }> => {
    const system = `You are ProjectPilot, an expert product strategist. Return ONLY valid JSON, no markdown fences, no prose. Schema:
{
  "name": "short snappy project name (2-3 words)",
  "description": "1-2 sentence refined product description",
  "modules": [
    {"slug":"kebab-id","name":"Module Name","dependsOn":["other-slug"],"branchKeywords":["keyword1","keyword2"]}
  ],
  "recommendedStack": ["Tech 1","Tech 2", ...],
  "successFactors": ["one short factor", ...],
  "risks": ["one short risk", ...]
}
Rules: 5-8 modules. Order from foundations to polish. dependsOn references valid slugs from the list. branchKeywords are lowercase tokens that would appear in branch names / commit messages for that module (e.g. "auth","login" for an auth module). Match technology choices to skills provided and to a ${data.durationWeeks}-week, ${data.teamSize}-person team at skill level ${data.skillLevel}/10.`;
    const userPrompt = `Idea: ${data.idea}\nTeam skills: ${data.skills || "(unspecified)"}`;
    const res = await callAi({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
    });
    if ("error" in res) return { error: res.error };
    
    const raw = res.content ?? "";

    console.log("RAW AI RESPONSE:");
    console.log(raw);

    try {
      let clean = raw
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const firstBrace = clean.indexOf("{");
      const lastBrace = clean.lastIndexOf("}");

      if (firstBrace !== -1 && lastBrace !== -1) {
        clean = clean.substring(firstBrace, lastBrace + 1);
      }

      const parsed = JSON.parse(clean) as BrainstormResult;
      return { result: parsed };
    } catch (err) {
      console.error("JSON PARSE ERROR:", raw);
      return { error: "Couldn't parse AI response. Try again." };
    }
  });

  const TaskSchema = z.object({
  moduleName: z.string(),
});

export const generateTasks = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TaskSchema.parse(input))
  .handler(async ({ data }) => {
    const prompt = `
You are a senior software architect.

Project module:
${data.moduleName}

Generate exactly 5 practical development tasks.

Requirements:
- Tasks must be specific to this module.
- Tasks should be implementation tasks.
- Keep each task under 12 words.
- No explanations.
- No markdown.

Return JSON only:

{
  "tasks":[
    "Task 1",
    "Task 2",
    "Task 3",
    "Task 4",
    "Task 5"
  ]
}
`;

    const res = await callAi(prompt);

    if ("error" in res) {
      return { error: res.error };
    }

    try {
      let clean = (res.content || "")
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(clean);

      return {
        tasks: parsed.tasks || [],
      };
    } catch {
      return {
        error: "Failed to parse tasks",
      };
    }
  });

  const MentorSchema = z.object({
  question: z.string(),
  projectName: z.string(),
});

export const askPilotMentor = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => MentorSchema.parse(input))
  .handler(async ({ data }) => {

    const prompt = `
You are a senior software architect.

Project:
${data.projectName}

Question:
${data.question}

Give practical implementation advice.

Format response exactly like:

START HERE:
- item 1
- item 2

IMPLEMENTATION:
- item 1
- item 2

COMMON MISTAKES:
- item 1
- item 2

Keep under 200 words.
`;

    const res = await callAi(prompt);

    if ("error" in res) {
      return { error: res.error };
    }

    return {
      answer: res.content,
    };
  });