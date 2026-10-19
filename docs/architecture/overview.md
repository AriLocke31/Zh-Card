# System architecture

Status: persistence and Cognito JWT authentication are implemented in source and tested locally. Production configuration, deployment, and a live browser-to-DynamoDB round trip remain unverified.

```mermaid
flowchart LR
    User --> UI[React / Material UI]
    UI --> Repo[ApiWordRepository]
    Repo -->|Bearer access token| API[API Gateway JWT authorizer]
    API --> Lambda[Word handler / owner check]
    Lambda --> DB[(Existing DynamoDB table)]
    Jenkins -->|bundle and deploy| Lambda
```

The browser loads a paginated dictionary, fetches selected entries, and creates/updates/deletes words through the API. There is no mock-data fallback. Written forms, readings, senses, components, tags, and timestamps travel as one WordEntry aggregate. Editor drafts stay local until a successful response replaces them with server data.

The table is a shared dictionary with a string partition key named id and no sort key. API Gateway validates Cognito JWTs; Lambda requires access-token claims and the configured OWNER_SUB. The browser signs in through Cognito with authorization-code/PKCE. Attach the existing authorizer to all five Gateway routes; source changes do not update deployed Gateway configuration.

[Persistence](persistence.md) describes HTTP contracts, conditional writes, auth, and setup. [Data model](data-model.md) describes invariants. [Roadmap](../roadmap/index.md) distinguishes implemented source from outstanding rollout and product work.

Jenkins installs both dependency sets, runs tests and frontend build, typechecks/bundles the backend, packages lambda.zip, and updates the configured Lambda. The optional SAM template describes a new API/Lambda around an existing table and identity provider; it does not adopt existing cloud resources or deploy automatically.
