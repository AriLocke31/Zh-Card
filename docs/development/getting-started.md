# Getting started

## Application

```bash
npm ci
npm --prefix src/backend ci
```

Copy .env.example to .env.local and set VITE_API_BASE_URL. Configure the Cognito OAuth endpoints/client from .env.example. Register the exact callback URL (the current browser origin plus a trailing slash by default) on the public Cognito client with authorization-code flow. Attach ZhCardCognito to all API routes. CORS must allow localhost:5173 and localhost:5174 plus Authorization/Content-Type/If-Match headers. Lambda requires TABLE_NAME, OWNER_SUB, and its normal DynamoDB IAM permissions. See [persistence setup](../architecture/persistence.md).

```bash
npm run dev
npm test
npm run build
npm --prefix src/backend run typecheck
npm --prefix src/backend run build
```

The development server normally uses http://localhost:5173/. npm build typechecks without emitting source files and produces the frontend in dist/. The backend build produces src/backend/dist/index.js. The existing Jenkins pipeline installs/tests/builds and deploys the Lambda; frontend hosting is separate.

## Documentation

```bash
python -m pip install -r requirements-docs.txt
python -m mkdocs serve
python -m mkdocs build --strict
```

The documentation server uses http://127.0.0.1:8000/. Use --site-dir with a temporary output directory if desired.

## Acceptance

Local automated tests use fake DynamoDB/OAuth transports. After configuring and deploying, perform the live create/reload/update/reload/delete checks in [persistence](../architecture/persistence.md). UI automation and production verification remain on the [roadmap](../roadmap/index.md).
