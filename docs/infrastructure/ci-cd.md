# CI/CD

Jenkinsfile targets AWS region us-east-1 and Lambda zh-card-words. Its current stages:

1. Print tool versions and verify the AWS caller identity.
2. Inspect the checkout directory.
3. npm ci in the root and src/backend.
4. Run root npm test and npm run build (non-emitting typecheck plus Vite frontend bundle).
5. Run backend npm run typecheck and npm run build.
6. Recreate src/backend/lambda.zip from dist/index.js.
7. Update Lambda code and wait for function-updated.
8. Archive the deployment ZIP.

Both package locks must remain consistent with their respective manifests. The shared backend validator imports root TypeScript/Pinyin data source, which esbuild includes in the Lambda bundle. It has no browser runtime dependency.

This pipeline deploys Lambda code only. It does not publish the frontend, provision API routes, or set CORS/IAM/environment values. Frontend VITE_* variables must be available during its hosting build. The SAM template is an optional separate deployment path; it now declares anonymous routes; reconcile Jenkins LAMBDA_FUNCTION if using its generated function.

The constituent tests/builds passed locally; the updated pipeline has not been run against Jenkins/AWS. Roles Anywhere authentication was previously reported working. See [AWS auth](aws-auth.md), [persistence deployment](../architecture/persistence.md), and [remaining checks](../roadmap/index.md).
