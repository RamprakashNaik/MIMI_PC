<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Spreadsheet & Data Generation
When a user asks for data analysis, reports, Excel files, XLSX, or CSV:
- **ALWAYS** use the `excel` artifact type.
- **NEVER** generate HTML tables or plain text blocks for datasets.
- The `content` must be valid CSV data (commas, semicolons, or tabs).
- Prioritize the "excel" format even if the user mentions "xlsx" - our internal editor will handle the visualization and editing.
