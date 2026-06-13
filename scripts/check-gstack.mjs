import { existsSync, statSync } from "node:fs";
import os from "node:os";

const requiredPaths = [
  {
    label: "gstack repo",
    path: "/home/egori/.gstack/repos/gstack",
  },
  {
    label: "gstack root Codex skill",
    path: "/home/egori/.codex/skills/gstack/SKILL.md",
  },
  {
    label: "gstack browser runtime",
    path: "/home/egori/.gstack/repos/gstack/browse/dist/browse",
    executable: true,
  },
  {
    label: "plan CEO review skill",
    path: "/home/egori/.codex/skills/gstack-plan-ceo-review/SKILL.md",
  },
  {
    label: "plan engineering review skill",
    path: "/home/egori/.codex/skills/gstack-plan-eng-review/SKILL.md",
  },
  {
    label: "plan design review skill",
    path: "/home/egori/.codex/skills/gstack-plan-design-review/SKILL.md",
  },
  {
    label: "review skill",
    path: "/home/egori/.codex/skills/gstack-review/SKILL.md",
  },
  {
    label: "QA skill",
    path: "/home/egori/.codex/skills/gstack-qa/SKILL.md",
  },
  {
    label: "spec skill",
    path: "/home/egori/.codex/skills/gstack-spec/SKILL.md",
  },
];

const isWsl = process.platform === "linux" && /microsoft|wsl/i.test(os.release());
let ok = true;

if (!isWsl) {
  console.error("gstack:check must run from WSL/bash for this CRM setup.");
  process.exit(1);
}

for (const check of requiredPaths) {
  const exists = existsSync(check.path);
  let executable = true;

  if (exists && check.executable) {
    executable = Boolean(statSync(check.path).mode & 0o111);
  }

  if (!exists || !executable) {
    ok = false;
    console.error(`FAIL ${check.label}: ${check.path}`);
  } else {
    console.log(`OK ${check.label}`);
  }
}

if (!ok) {
  process.exit(1);
}

console.log("gstack is ready for Lunch-UP CRM Codex workflows.");
