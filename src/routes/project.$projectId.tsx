import { createFileRoute } from "@tanstack/react-router";
import { useProject } from "@/lib/project-store";
import { supabase } from "@/integration/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { generateTasks, askPilotMentor, generateRoadmap,} from "@/lib/ai.functions";

export const Route = createFileRoute("/project/$projectId")({
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const { state,tasks,refreshProject } = useProject();
  const generateTaskFn = useServerFn(generateTasks);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);
  const askPilotFn = useServerFn(askPilotMentor);
  const [roadmap, setRoadmap] =useState("");
  const roadmapFn =useServerFn(generateRoadmap);

  
  

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">
        {state?.name}
      </h1>

      <p className="mt-2 text-muted-foreground">
        {state?.description}
      </p>

      <div className="mt-6">
        <h2 className="font-semibold">
          Modules
        </h2>

        <ul className="mt-3 space-y-2">
          {state?.modules?.map((m) => (
  <li
    key={m.id}
    className="border rounded p-3"
  >
    <div className="flex justify-between items-center">

      <span>{m.name}</span>

      <button
  className="bg-blue-500 text-white px-3 py-1 rounded"
  onClick={async () => {

    const existing = await supabase
      .from("tasks" as any)
      .select("id")
      .eq("module_id", m.id);

    if ((existing.data?.length ?? 0) > 0) {
      alert("Tasks already generated");
      return;
    }

    const res = await generateTaskFn({
      data: {
        moduleName: m.name,
      },
    }) as {
      tasks?: string[];
      error?: string;
    };

    if (res.error) {
      alert(res.error);
      return;
    }

    const rows = (res.tasks || []).map((t) => ({
      module_id: m.id,
      title: t,
      completed: false,
    }));

    await supabase
      .from("tasks" as any)
      .insert(rows);

    await refreshProject();

    alert("Tasks Generated");
  }}
>
  Generate Tasks
</button>

    </div>
  </li>
))}
        </ul>
      </div>

      <div className="mt-8">
  <h2 className="font-semibold text-xl">
    Tasks
  </h2>

  <ul className="mt-3 space-y-2">
    {tasks?.map((task) => (
      <li
        key={task.id}
        className="border rounded p-3"
      >
        <div className="flex justify-between">

          <span>
            {task.title}
          </span>

          <input
            type="checkbox"
            checked={task.completed}
            onChange={async () => {

              await supabase
                .from("tasks" as any)
                .update({
                  completed: !task.completed,
                })
                .eq("id", task.id);

              await refreshProject();
            }}
          />

        </div>
      </li>

    ))}

  </ul>

</div>

      <div className="mt-6 text-sm text-muted-foreground">
        Project ID: {projectId}
      </div>

      <div className="mt-10">

        <h2 className="text-xl font-semibold">
          AI Mentor
        </h2>

        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full border rounded p-3 mt-3"
          rows={4}
          placeholder="Ask Pilot..."
        />

        <button
  className="bg-green-600 text-white px-4 py-2 rounded mt-3"
  onClick={async () => {
  try {
    setLoadingAi(true);

    const res = await askPilotFn({
      data: {
        question,
        projectName: state?.name || "",
      },
    }) as {
      answer?: string;
      error?: string;
    };

    if (res.error) {
      alert(res.error);
      return;
    }

    setAnswer(res.answer || "");

  } catch (err) {
    console.error(err);
    alert("AI Error");
  } finally {
    setLoadingAi(false);
  }
}}
>
  <>
  {loadingAi && (
    <span className="animate-spin mr-2">
      ⏳
    </span>
  )}

  {loadingAi ? "Thinking..." : "Ask Pilot"}
</>
</button>

<button
  className="bg-purple-600 text-white px-4 py-2 rounded mt-3 ml-3"
  onClick={async () => {

    const res =
      await roadmapFn({
        data: {
          projectName:
            state?.name || "",
        },
      }) as {
        roadmap?: string;
        error?: string;
      };

    if (res.error) {
      alert(res.error);
      return;
    }

    setRoadmap(
      res.roadmap || ""
    );
  }}
>
  Generate Roadmap
</button>

<button
  className="bg-purple-600 text-white px-4 py-2 rounded mt-3 ml-3"
  onClick={async () => {
    try {
      setLoadingAi(true);

      const res = await askPilotFn({
        data: {
          question: `Estimate timeline, risks, tech stack and team effort for project ${state?.name}`,
          projectName: state?.name || "",
        },
      }) as {
        answer?: string;
        error?: string;
      };

      if (res.error) {
        alert(res.error);
        return;
      }

      setAnswer(res.answer || "");

    } catch (err) {
      console.error(err);
      alert("Estimation failed");
    } finally {
      setLoadingAi(false);
    }
  }}
>
  Estimate Project
</button>

        {answer && (
  <div className="border rounded p-4 mt-4 whitespace-pre-wrap">
    {answer}
  </div>
)}

      </div>
    </div>
  );
}

