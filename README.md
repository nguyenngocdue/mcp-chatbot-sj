
# MCP Chatbot Server

## Quick Start Guide

### 1. Create a `.env` file
Create a `.env` file in the project root with the following keys:

```
PORT=<YOUR_PORT>
POSTGRES_URL=<YOUR_POSTGRES_URL>
OPENAI_MODEL=<YOUR_OPENAI_MODEL>         # (optional, for developer)
OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>     # (optional, for developer)
```

### 2. Start the Development Server
Navigate to the project directory and run:

```bash
cd twin-editor-mcp/
pnpm install
pnpm dev
```

After running the above command, the server will start at:
http://localhost:8931
(or the port you set in the `.env` file)
```



### 3. Start PostgreSQL with Docker and Run Migrations
If you don't have PostgreSQL running locally, you can start it with:

```bash
pnpm docker:pg
```

Then run database migrations:

```bash
pnpm db:migrate
```

To reset the database (drop and recreate all tables), use:

```bash
pnpm db:reset
```

### 4. Set API Key in Frontend
In the frontend, you must set your API key in the settings. The API key will be saved into the database.

- For development, you can also set the API key in the `.env` file in step 1.

---

- Make sure you have [pnpm](https://pnpm.io/) installed.
- For more details, see the comments in `.env.example`.
