import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
if (
  process.env.NODE_ENV === "production" ||
  process.env.WORKNOTE_AGENT_LOCAL_PREVIEW !== "true"
)
  throw Error("Explicit development-only preview opt-in required.");
const assessmentFixture =
  process.env.WORKNOTE_AGENT_PREVIEW_ASSESSMENT_FIXTURE === "true";
if (
  assessmentFixture &&
  !["development", "test"].includes(process.env.NODE_ENV ?? "")
)
  throw Error("Synthetic assessment preview requires development or test.");
const providerNotice = assessmentFixture
  ? "Assessment provider: SYNTHETIC deterministic fixture; no xKiro calls or credentials. UI/lifecycle validation only, not model-quality evidence. Choose QA for ready-to-edit; PROGRESS asks for the observed retry result."
  : "Provider: configured xKiro model; explicit Agent actions can call the provider.";
const folder = resolve(root, ".worknote-agent-preview");
await mkdir(resolve(folder, "app/api/backend/[...path]"), { recursive: true });
await writeFile(
  resolve(folder, "package.json"),
  JSON.stringify({
    name: "worknote-local-fixture",
    private: true,
    type: "module",
  }),
);
await writeFile(
  resolve(folder, "tsconfig.json"),
  JSON.stringify(
    {
      extends: "../tsconfig.json",
      compilerOptions: { baseUrl: "..", paths: { "@/*": ["./src/*"] } },
      include: ["**/*.ts", "**/*.tsx", "../src/**/*.ts", "../src/**/*.tsx"],
    },
    null,
    2,
  ),
);
await writeFile(
  resolve(folder, "next.config.mjs"),
  `export default {turbopack:{root:${JSON.stringify(root)},rules:{"*.svg":{loaders:["@svgr/webpack"],as:"*.js"}}},devIndicators:false};`,
);
await writeFile(
  resolve(folder, "postcss.config.mjs"),
  `export default {plugins:{'@tailwindcss/postcss':{}}};`,
);
await writeFile(
  resolve(folder, "app/layout.tsx"),
  `import '../../src/app/globals.css';export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}`,
);
await writeFile(
  resolve(folder, "app/page.tsx"),
  "'use client';\nimport {useState} from 'react';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {NextIntlClientProvider} from 'next-intl';import messages from '@/messages/en.json';import WorkNoteComposer from '@/components/work-notes/WorkNoteComposer';import type {EditorSourceIdentity} from '@/lib/queries/work-notes/work-note-agent.api';\nexport default function Page(){const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:false}}}));const [open,setOpen]=useState(true),[source,setSource]=useState<EditorSourceIdentity|undefined>(),[saved,setSaved]=useState(false),[documentId,setDocumentId]=useState<string|null>(null);\nconst start=(source?:EditorSourceIdentity)=>{setSource(source);setOpen(true);setSaved(false);};\nreturn <QueryClientProvider client={client}><NextIntlClientProvider locale=\"en\" timeZone=\"Asia/Bangkok\" messages={messages}><main className=\"min-h-dvh space-y-3 bg-gray-50 p-8 text-gray-900 dark:bg-gray-950 dark:text-gray-100\"><h1>Agent WorkNote local integration fixture</h1><p>Disposable synthetic data; no Atlas connection. Task, Document and Report use real editor services.</p><p>" +
    providerNotice +
    "</p>{saved&&<p role=\"status\">Canonical content saved successfully. No submission was performed.</p>}<nav className=\"flex flex-wrap gap-4\"><button onClick={()=>start()}>Open task note</button><button onClick={()=>start({workflow:'PROJECT_DOCUMENT',documentType:'RESEARCH'})}>New project document</button>{documentId&&<button onClick={()=>start({workflow:'PROJECT_DOCUMENT',resourceId:documentId})}>Reopen saved document</button>}<button onClick={()=>start({workflow:'WORK_REPORT',resourceId:'b51a2b3c4d5e6f7a8b9c0d21'})}>Open work report</button><button onClick={()=>document.documentElement.classList.toggle('dark')}>Toggle preview theme</button></nav>{open&&<WorkNoteComposer key={source?JSON.stringify(source):'task'} projectId=\"651a2b3c4d5e6f7a8b9c0d21\" taskId={source?undefined:\"851a2b3c4d5e6f7a8b9c0d21\"} source={source} onClose={()=>setOpen(false)} onSaved={result=>{if(source?.workflow==='PROJECT_DOCUMENT'&&result&&typeof result==='object'&&'id' in result&&typeof result.id==='string')setDocumentId(result.id);setSaved(true);setOpen(false);}}/>}</main></NextIntlClientProvider></QueryClientProvider>;}",
);
await writeFile(
  resolve(folder, "app/api/backend/[...path]/route.ts"),
  `import type {NextRequest} from 'next/server';async function forward(req:NextRequest,{params}:{params:Promise<{path:string[]}>}){const {path}=await params;if(req.method==='GET'&&path.join('/')==='tasks/projects/651a2b3c4d5e6f7a8b9c0d21/tasks/851a2b3c4d5e6f7a8b9c0d21')return Response.json({"id":"851a2b3c4d5e6f7a8b9c0d21","projectId":"651a2b3c4d5e6f7a8b9c0d21","key":"SYN-620","title":"Validate retry behaviour","description":"Add retry support; verify network failure and rollback before release.","status":"DONE","steps":[],"type":"TASK","priority":"MEDIUM","assigneeId":null,"createdBy":"951a2b3c4d5e6f7a8b9c0d21","parentId":null,"sprintId":null,"labels":[],"subtaskCounts":{"total":0,"done":0},"dueDate":null,"startDate":null,"createdAt":"2026-10-28T00:00:00.000Z","updatedAt":"2026-10-28T00:00:00.000Z","version":1,"completedAt":null},{headers:{'cache-control':'no-store'}});if(path.slice(0,3).join('/')!=='capture/projects/651a2b3c4d5e6f7a8b9c0d21')return new Response(null,{status:404});const upstream=await fetch('http://127.0.0.1:3192/internal/'+path.map(encodeURIComponent).join('/')+req.nextUrl.search,{method:req.method,headers:{'content-type':'application/json',authorization:'Bearer worknote-local-fixture'},...(!['GET','HEAD'].includes(req.method)?{body:await req.text()}:{}),cache:'no-store',redirect:'error'});return new Response(await upstream.arrayBuffer(),{status:upstream.status,headers:{'content-type':'application/json','cache-control':'no-store'}});}export {forward as GET,forward as POST,forward as PATCH,forward as DELETE};`,
);
const child = spawn(
  process.execPath,
  [
    resolve(root, "node_modules/next/dist/bin/next"),
    "dev",
    folder,
    "--hostname",
    "127.0.0.1",
    "--port",
    "3019",
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      ...(assessmentFixture
        ? { NEXT_PUBLIC_WORKNOTE_ASSESSMENT_ENABLED: "true" }
        : {}),
    },
    stdio: "inherit",
    windowsHide: true,
  },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
