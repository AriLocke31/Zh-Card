# Getting started

## Application

```bash
npm ci
npm --prefix src/backend ci
```

Copy .env.example to .env.local and set VITE_API_BASE_URL. Authentication is temporarily unplugged: no OAuth configuration or login is required. Existing API Gateway routes must allow anonymous access, and CORS must allow http://localhost:5173 plus Content-Type/If-Match headers. Lambda still requires TABLE_NAME and its normal DynamoDB IAM permissions. See [persistence setup](../architecture/persistence.md).

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
