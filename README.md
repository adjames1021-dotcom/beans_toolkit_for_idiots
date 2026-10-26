# Bean's Toolkit

A one-page box of coding tools. Paste text, press a button. Plain HTML, CSS and JavaScript in `public/`, no build step, nothing leaves the browser.

- **Save** the text as a `.html`, `.js` or `.py` file, or preview it as a web page
- **JSON** format or minify
- **Encode / decode** Base64, URL and HTML
- **Case** UPPER, lower, camelCase, snake_case, kebab-case
- **Lines** sort, remove duplicates, reverse, trim trailing spaces
- **Make** a SHA-256 hash or a UUID
- **Edit** undo, copy, clear

## Running it

- **Locally:** `python3 -m http.server 8000 --directory public`, then open <http://localhost:8000>.
- **Online:** `npx wrangler deploy`. Change `name` in `wrangler.jsonc` to pick the subdomain.
