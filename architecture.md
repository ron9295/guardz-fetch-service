# System Architecture

## Overview
The **Guardz Fetch Service** uses an asynchronous, distributed architecture to handle high-volume URL fetching. It separates the request ingestion (Producer) from the actual processing (Consumer) using a reliable message queue.

## Components

### 1. API Layer (NestJS Controller)
- **Role**: Entry point for user requests.
- **Responsibilities**:
    - Validates inputs using DTOs.
    - Enforces Rate Limiting (Global & per-endpoint).
    - Checks API Keys.
    - Delegates business logic to `AppService`.

### 2. Service Layer (Producer)
- **Role**: Orchestrator.
- **Responsibilities**:
    - Creates initial request records in PostgreSQL.
    - Chunks large lists of URLs.
    - Pre-inserts rows into the `Results` table.
    - Publishes messages to **RabbitMQ**.

### 3. Worker Layer (Consumer)
- **Role**: Background Processor.
- **Responsibilities**:
    - Listens to RabbitMQ queue `fetch_queue_rabbitmq`.
    - Fetches URLs via HTTP.
    - Handles redirects and timeouts.
    - Uploads HTML content to **S3**.
    - Updates PostgreSQL with status and S3 keys.

### 4. Infrastructure
- **PostgreSQL**: Relational DB for request metadata and job status.
- **Redis**: Used for Rate Limiting storage and Caching of finished results.
- **RabbitMQ**: Message broker for reliable task distribution.
- **LocalStack (S3)**: Object storage for the raw HTML content.

## Architecture Diagram

```mermaid
graph TD
    Client[Client] -->|HTTP POST /scans| API[API Controller]
    
    subgraph "NestJS Application"
        API -->|Validate & Rate Limit| Service[AppService]
        Service -->|1. Create Request| DB[(PostgreSQL)]
        Service -->|2. Pre-insert Rows| DB
        Service -->|3. Publish Jobs| MQ[RabbitMQ]
        
        MQ -->|Consume| Worker[UrlConsumer]
        Worker -->|4. Fetch URL| Internet((Internet))
        Worker -->|5. Upload HTML| S3[[S3 Bucket]]
        Worker -->|6. Update Status| DB
    end
    
    subgraph "Data & Infra"
        Redis[(Redis)] -.->|Rate Limits| API
        Redis -.->|Cache Results| Service
    end
```

## Request Flow (Sequence)

```mermaid
sequenceDiagram
    participant U as User
    participant C as Controller
    participant S as AppService
    participant DB as PostgreSQL
    participant Q as RabbitMQ
    participant W as Worker

    U->>C: POST /scans (URLs[])
    C->>S: fetchUrls(urls)
    S->>DB: INSERT Request (status=processing)
    S->>DB: INSERT MANY Results (status=pending)
    S->>Q: Publish 'fetch.chunk'
    S-->>C: Returns requestId
    C-->>U: 202 Accepted (requestId)
    
    note over W: Async Processing
    Q->>W: Consume Message
    loop For each URL
        W->>W: Fetch URL (Axios)
        W->>W: Upload to S3
    end
    W->>DB: UPDATE Results (status=success/error)
    W->>DB: UPDATE Request (processed count)
```
