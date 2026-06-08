# ProjectPilot_AI
AI-powered project planning assistant for students and developers.


ProjectPilot AI
AI-Powered Project Planning Assistant for Students & Early-Career Developers

ProjectPilot AI helps students and developers transform a simple project idea into a structured execution plan using Generative AI.

Instead of spending hours planning architecture, modules, timelines, risks, and tasks, users can describe their idea and receive an AI-generated project blueprint instantly.

📌 Problem Statement

Students often have great project ideas but struggle with:

Defining project modules
Breaking work into tasks
Designing architecture
Estimating project feasibility
Managing project execution
Understanding risks before development

Most teams spend more time planning than actually building.

ProjectPilot AI solves this problem by acting as an AI Project Strategist.

🎯 Solution

ProjectPilot AI converts a project idea into:

Structured project modules
Development tasks
Technical architecture
AI-powered mentoring
Development roadmap
Risk analysis
Project feasibility simulation
✨ Features
🔐 Authentication
User Signup
User Login
Email Verification
Secure Authentication using Supabase


 AI Project Generation

Users provide:

Project Idea
Team Size
Project Duration
Skill Level
Technical Skills

Gemini AI generates:

Project Description
Modules
Suggested Development Structure
📋 AI Task Generator

For every module:

Generate implementation tasks
Create actionable development steps
Store tasks in Supabase


🎓 AI Mentor

Ask project-related questions:

Examples:

Which database should I use?
How should I deploy this?
What architecture fits this project?
How can I improve scalability?

Powered by Gemini API.

🏗 Architecture Generator

Automatically generates:

Technology Stack
System Components
Actors
Data Flow
Suggested Architecture


Roadmap Generator

Creates:

Week-by-week plan
Development milestones
Project phases
⚠ Risk Analysis

AI identifies:

Potential project risks
Technical challenges
Resource limitations
Mitigation strategies


 Project Simulator

Simulate different scenarios:

Team Size
Budget
Duration
Skill Level

Generates:

Success Probability
Risk Score
Readiness Score
Project Complexity
🏛 System Architecture
User
 ↓
React Frontend
 ↓
TanStack Start Server Functions
 ↓
Gemini API
 ↓
AI Responses
 ↓
Supabase Database
 ↓
Dashboard / Tasks / Roadmap / Architecture
🛠 Tech Stack
Frontend
React
TypeScript
TanStack Router
TanStack Start
Tailwind CSS
Backend
Server Functions
TypeScript
Database
Supabase
AI
Google Gemini API
Authentication
Supabase Auth
📂 Project Structure
src/
│
├── routes/
│   ├── dashboard
│   ├── architecture
│   ├── roadmap
│   ├── simulator
│   ├── project
│
├── lib/
│   ├── ai.functions.ts
│   ├── project-store.tsx
│   ├── simulation.ts
│
├── components/
│
└── integration/
    └── supabase
⚙ Installation Guide
Step 1 — Clone Repository
git clone https://github.com/annmaria3/ProjectPilot_AI-ai.git
cd projectpilot-ai
Step 2 — Install Dependencies
npm install
Step 3 — Configure Environment Variables

Create:

.env

Add:

VITE_SUPABASE_URL=your_supabase_url

VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

GEMINI_API_KEY=your_gemini_api_key
Step 4 — Configure Supabase

Create tables:

projects
id uuid primary key
name text
description text
modules
id uuid primary key
project_id uuid
name text
status text
tasks
id uuid primary key
module_id uuid
title text
completed boolean
activity_events
id uuid primary key
project_id uuid
summary text
created_at timestamp
Step 5 — Run Development Server
npm run dev

Application will start at:

http://localhost:3000

or

http://localhost:8080

depending on configuration.

Step 6 — Create Account
Open application
Sign Up
Verify email
Login
Step 7 — Create Project

Enter:

Project Idea
Team Size
Duration
Skill Level

Generate project.

Step 8 — Explore Features
Dashboard

View:

Progress
Modules
Activities
Generate Tasks

Create AI-generated implementation tasks.

AI Mentor

Ask technical questions.

Architecture

Generate architecture and technology stack.

Roadmap

Generate development timeline.

Simulator

Analyze project feasibility.

 Demo Workflow
 
Login
 ↓
Create Project
 ↓
AI Generates Modules
 ↓
Generate Tasks
 ↓
AI Mentor
 ↓
Architecture
 ↓
Roadmap
 ↓
Risk Analysis
 ↓
Simulator

Future Improvements

Multi-user collaboration
GitHub integration
Jira integration
AI sprint planning
Automatic documentation generation
Deployment recommendations
Project analytics dashboard

Author

Ann Maria Joby

B.Tech Computer Science Engineering Graduate

Project developed as part of the QuAnHack Software Engineering & AI Internship Final Round Challenge.
