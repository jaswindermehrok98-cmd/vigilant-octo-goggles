export const PROTOCOLS = Object.freeze({
  prep_for_meeting: {
    title: "Prep for Meeting",
    purpose: "Build a focused briefing without sending or changing anything.",
    steps: [
      { order: 1, tool: "webSearch", action: "Research current meeting context.", approval: false },
      { order: 2, tool: "draftMeetingBrief", action: "Turn research into a concise briefing.", approval: false },
      { order: 3, tool: "calendarDraft", action: "Prepare a calendar proposal only if needed.", approval: true }
    ]
  },
  daily_brief: {
    title: "Daily Brief",
    purpose: "Assemble a situational brief from time, live information, and optional environment data.",
    steps: [
      { order: 1, tool: "currentTime", action: "Establish local time.", approval: false },
      { order: 2, tool: "webSearch", action: "Gather high-signal current updates.", approval: false },
      { order: 3, tool: "environmentLookup", action: "Check environment conditions when relevant.", approval: false }
    ]
  },
  research_pack: {
    title: "Research Pack",
    purpose: "Research, inspect primary sources, and create a reusable document.",
    steps: [
      { order: 1, tool: "webSearch", action: "Find credible sources.", approval: false },
      { order: 2, tool: "browserOpen", action: "Inspect approved pages when needed.", approval: false },
      { order: 3, tool: "draftDocument", action: "Synthesize findings into a document.", approval: false }
    ]
  }
});

export function listProtocols() {
  return Object.entries(PROTOCOLS).map(([name, item]) => ({ name, title: item.title, purpose: item.purpose }));
}

export function describeProtocol(name) { return PROTOCOLS[name] || null; }
