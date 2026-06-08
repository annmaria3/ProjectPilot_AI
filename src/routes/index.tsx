import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integration/supabase/client";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [project, setProject] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length || 0;

const progress =
  totalTasks === 0
    ? 0
    : Math.round(
        (completedTasks / totalTasks) * 100
      );

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const { data: projects } = await supabase
      .from("projects")
      .select("*")
      .limit(1);

    if (!projects || projects.length === 0) return;

    const activeProject = projects[0];
    setProject(activeProject);

    const { data: moduleData } = await supabase
      .from("modules")
      .select("*")
      .eq("project_id", activeProject.id);

    setModules(moduleData || []);

    const { data: activityData } = await supabase
      .from("activity_events")
      .select("*")
      .eq("project_id", activeProject.id)
      .order("created_at", { ascending: false });

    setActivities(activityData || []);
  }

  const completedModules = modules.filter(
    (m) => m.status === "done"
  ).length;

  return (
    <div>
      <div className="mt-2">
        Progress: {progress}%
      </div>
      <div style={{ padding: "40px" }}>
        <h1>Project Dashboard</h1>

        {project && (
          <>
            <h2>{project.name}</h2>

            <p>{project.description}</p>

            <hr />

            <h3>Project Progress</h3>
            <p>
              {completedModules} / {modules.length} Modules Completed
            </p>

            <h3>Module Count</h3>
            <p>{modules.length}</p>

            <h3>Completed Modules</h3>
            <p>{completedModules}</p>

            <h3>Recent Activity</h3>

            <ul>
              {activities.map((activity) => (
                <li key={activity.id}>
                  {activity.summary}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}