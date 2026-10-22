# AgriConnect UI patch (readability)
Extract into the project root (folder with package.json), replace when asked. No DB, dependency or schema changes.

Files:
- components/ai/AssistantChat.tsx  (replies shown as price cards / lists / headings; "\n" bug fixed; larger fonts)
- app/(app)/crops/page.tsx         (image-on-top product cards, big price, details below)
- components/layout/Sidebar.tsx    (wider sidebar, larger text and icons)

Then run: npm run typecheck && npm run build && npm run dev
