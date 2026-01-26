---
name: save-context
description: Save context about decisions, changes, or reasoning to a thread. Use after making significant changes or decisions you want to remember.
argument-hint: [thread] [context]
user-invocable: true
---

Save context to threadlinking for future reference.

## Usage

The user will provide:
1. A thread name (project or topic identifier)
2. The context to save (what was done and WHY)

## Instructions

1. Parse the user's input to identify:
   - Thread name (first word, or ask if unclear)
   - Context content (the rest)

2. Call the `threadlinking_snippet` tool with:
   - `thread_id`: The thread name
   - `content`: The context to save
   - `tags`: Extract relevant tags from the content (e.g., "decision", "bugfix", "architecture")

3. Confirm the save was successful.

## Examples

User: `/save-context myproject Chose PostgreSQL over MongoDB because we need ACID transactions for the payment system`

Action: Call threadlinking_snippet with:
- thread_id: "myproject"
- content: "Chose PostgreSQL over MongoDB because we need ACID transactions for the payment system"
- tags: "decision,database"

User: `$ARGUMENTS`
