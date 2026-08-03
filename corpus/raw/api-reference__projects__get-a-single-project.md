> ## Documentation Index
> Fetch the complete documentation index at: https://docs.michelangelo.land/llms.txt
> Use this file to discover all available pages before exploring further.

# Get a single project



## OpenAPI

````yaml /api-reference/openapi.yaml get /projects/{projectId}
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
  /projects/{projectId}:
    get:
      tags:
        - projects
      summary: Get a single project
      operationId: getProject
      parameters:
        - name: projectId
          in: path
          required: true
          schema:
            type: integer
            format: int64
      responses:
        '200':
          description: The project
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Project'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/NotFound'
      security:
        - oauth2: []
        - bearerAuth: []
components:
  schemas:
    Project:
      type: object
      required:
        - id
        - name
        - created_at
      properties:
        id:
          type: integer
          format: int64
          description: Numeric project id (matches public.projects.id)
        name:
          type: string
        description:
          type: string
        icon_url:
          type: string
          format: uri
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
    Unauthorized:
      description: Missing, expired or invalid token
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    NotFound:
      description: Resource does not exist (or is not visible to this token)
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