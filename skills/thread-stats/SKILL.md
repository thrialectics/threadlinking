---
name: thread-stats
description: View analytics and statistics about your threads. Shows activity patterns, most active threads, and usage insights.
argument-hint:
user-invocable: true
---

Show analytics and insights about threadlinking usage.

## Instructions

1. **Call threadlinking_analytics** to get usage data

2. **Present a summary**:
   - Total threads and snippets
   - Most active threads
   - Recent activity
   - Tag distribution

3. **Highlight insights**:
   - Threads that haven't been updated in a while
   - Most common tags
   - Files with the most context

4. **Offer follow-up actions**:
   - Review a specific thread
   - Export threads for backup
   - Search for specific context

## Output Format

```
## Threadlinking Stats

**Overview**
- Total threads: [N]
- Total snippets: [N]
- Total linked files: [N]

**Most Active Threads**
1. [thread-name] - [N] snippets, [N] files
2. [thread-name] - [N] snippets, [N] files
3. [thread-name] - [N] snippets, [N] files

**Recent Activity**
- [date]: Added context to [thread]
- [date]: Linked file to [thread]

**Popular Tags**
- decision ([N])
- architecture ([N])
- bugfix ([N])

**Insights**
- Thread '[name]' hasn't been updated in 30+ days
- Most context saved about: [topic]
```

User input: $ARGUMENTS
