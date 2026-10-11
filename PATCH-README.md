# AgriConnect AI Clarity Patch

## Included changes
- Adds stricter answer-style guidance so the assistant answers the exact question, keeps responses concise, and makes one recommendation when the farmer explicitly asks it to choose.
- Instructs the assistant not to call gross sale value “profit” without cost data.
- Increases chat message readability and spacing.
- Scrolls only the chat message panel rather than calling `scrollIntoView`, which could move the whole page when a response arrives.
- Cleans escaped Markdown asterisks from displayed assistant messages.

## Apply
1. Back up your current project.
2. Extract the two included source files into the project root, preserving their paths and overwriting the existing files.
3. Run `npm run typecheck`, `npm run verify`, and `npm run build`.

No database schema or migration changes are included.
