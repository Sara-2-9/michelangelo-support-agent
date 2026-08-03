> ## Documentation Index
> Fetch the complete documentation index at: https://docs.michelangelo.land/llms.txt
> Use this file to discover all available pages before exploring further.

# Create an async job

> Validates the prompt with a server-side AI evaluation step, creates a job row (`status: queued`), dispatches the work to the managed runner and returns immediately with a `job_id`. The HTTP request never waits for the work itself — poll `GET /jobs/{jobId}` for progress.




## OpenAPI

````yaml /api-reference/openapi.yaml post /jobs
openapi: 3.1.0
info:
  title: Michelangelo Public API
  version: 0.1.0
  description: >
    Public API of the Michelangelo platform. This is the stable contract for the
    community: plugins, SDKs, MCP servers and third-party apps integrate here —
    never directly with the underlying backend.

    Design rules: - Every long-running operation is an async **job** with state
    in the DB. - Auth is OAuth 2.1 + PKCE; tokens are JWTs validated via JWKS. -
    All routes are versioned under `/v1`. Breaking changes ship as `/v2`.
  contact:
    name: Michelangelo Community
  license:
    name: MIT
    identifier: MIT
servers:
  - url: https://api.michelangelo.land/v1
    description: Production
security: []
tags:
  - name: auth
    description: Identity introspection for the current token
  - name: jobs
    description: Async long-running operations (prompts, builds, AI runs)
  - name: projects
    description: Michelangelo projects owned by the authenticated user
paths:
  /jobs:
    post:
      tags:
        - jobs
      summary: Create an async job
      description: >
        Validates the prompt with a server-side AI evaluation step, creates a
        job row (`status: queued`), dispatches the work to the managed runner
        and returns immediately with a `job_id`. The HTTP request never waits
        for the work itself — poll `GET /jobs/{jobId}` for progress.
      operationId: createJob
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateJobRequest'
      responses:
        '202':
          description: Job accepted and queued
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Job'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          $ref: '#/components/responses/RateLimited'
      security:
        - oauth2: []
        - bearerAuth: []
components:
  schemas:
    CreateJobRequest:
      type: object
      required:
        - type
        - input
      properties:
        type:
          type: string
          enum:
            - prompt
          description: Job kind. Only `prompt` in v0.1; grows with the runner catalog
        project_id:
          type: integer
          format: int64
          description: Numeric project id (matches public.projects.id)
        input:
          type: object
          description: >
            Job-specific payload (e.g. the prompt text and options). `model` and
            `appName` are optional: when omitted the API evaluates the prompt
            server-side and fills them in before the runner picks up the job.
          additionalProperties: true
          properties:
            prompt:
              type: string
            model:
              type: string
              enum:
                - light
                - full
              description: >
                Vendor-neutral generation tier. `light`: faster and cheaper, for
                simple changes. `full`: deepest reasoning, for complex builds.
                The concrete model behind each tier is a server-side detail and
                may change over time. Server-enriched from prompt evaluation
                when absent.
            appName:
              type:
                - string
                - 'null'
              description: >-
                Generated app name (first generation only); server-enriched when
                absent
    Job:
      type: object
      required:
        - id
        - type
        - status
        - created_at
      properties:
        id:
          type: string
          format: uuid
        type:
          type: string
        status:
          type: string
          enum:
            - queued
            - running
            - succeeded
            - failed
            - canceled
        project_id:
          type: integer
          format: int64
          description: Numeric project id (matches public.projects.id), nullable
        result:
          type: object
          additionalProperties: true
          description: Output payload on success — contains `project_id` and `files_saved`
        error:
          $ref: '#/components/schemas/Error'
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
    Error:
      type: object
      required:
        - code
        - message
      properties:
        code:
          type: string
          description: Machine-readable error code (e.g. `job_not_found`)
        message:
          type: string
          description: Human-readable detail
        details:
          type: object
          additionalProperties: true
  responses:
    BadRequest:
      description: Invalid request payload
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    Unauthorized:
      description: Missing, expired or invalid token
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    RateLimited:
      description: Quota exceeded; retry after the indicated time
      headers:
        Retry-After:
          schema:
            type: integer
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
  securitySchemes:
    oauth2:
      type: oauth2
      description: >
        OAuth 2.1 authorization code flow with PKCE, issued by the Michelangelo
        identity provider. Third-party clients register via Dynamic Client
        Registration — see the Authentication guide for the full flow.
      flows:
        authorizationCode:
          authorizationUrl: https://api.michelangelo.land/auth/v1/oauth/authorize
          tokenUrl: https://api.michelangelo.land/auth/v1/oauth/token
          scopes: {}
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT issued by the identity provider, validated by the API via JWKS

````