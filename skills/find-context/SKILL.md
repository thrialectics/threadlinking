---
name: find-context
description: Search for relevant context across all threads using natural language. Use when exploring decisions, looking for related work, or understanding past reasoning.
argument-hint: [query]
user-invocable: true
---

Find relevant context by searching semantically across all threads.

## Instructions

1. **Get the search query** from `$ARGUMENTS`
   - If not provided, ask what the user is looking for

2. **Choose search strategy**:
   - For specific terms (file names, exact phrases): Use `threadlinking_search`
   - For conceptual queries (why, how, decisions about): Use `threadlinking_semantic_search`
   - When unsure, try semantic search first (more flexible)

3. **Execute the search**:
   - Call the appropriate tool with the query
   - If semantic search returns no results, fall back to keyword search

4. **Present results**:
   - Show matching threads with relevance scores
   - Include snippets of the matching context
   - Highlight the most relevant parts

5. **Offer follow-up actions**:
   - View full thread details
   - Search for related topics
   - Explain specific files mentioned in results

## Examples

**Conceptual query:**
```
User: /find-context why we chose this database
Action: Call threadlinking_semantic_search with "database choice decisions reasoning"
```

**Specific query:**
```
User: /find-context authentication
Action: Call threadlinking_search with "authentication"
```

**Exploratory query:**
```
User: /find-context what decisions did we make about caching
Action: Call threadlinking_semantic_search with "caching decisions strategy"
```

## Output Format

```
## Found [N] relevant thread(s)

### [thread-name] (85% match)
> "Chose PostgreSQL over MongoDB because we need ACID transactions..."

Tags: decision, database
Files: src/db/config.ts, src/models/index.ts

---

### [other-thread] (72% match)
> "Database migration strategy: using Prisma for type safety..."
```

User input: $ARGUMENTS
