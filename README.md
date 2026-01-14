# guardz-fetch-service

A backend service built with [NestJS](https://nestjs.com/) that exposes an HTTP API to fetch and retrieve the content of given HTTP URLs.

This project was created as a home assignment for Guardz.

## 📋 Features

* **Submit URLs:** Endpoint to submit a list of URLs for processing.
* **Retrieve Content:** Endpoint to view the fetched content and metadata.
* **Robust Fetching:** Handles HTTP redirects automatically.
* **Error Handling:** Gracefully manages invalid URLs or network errors without crashing the service.
* **Rate Limiting:** Built-in DoS protection with configurable rate limits:
  - Global limit: 100 requests per minute (default)
  - POST `/api/v1/scans`: 20 requests per minute (stricter limit for resource-intensive operations)
  - Uses Redis for distributed rate limiting across multiple instances

## 🛠️ Prerequisites

* [Node.js](https://nodejs.org/) (LTS version recommended)
* [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

## 🚀 Installation

1.  Clone the repository:
    ```bash
    git clone [https://github.com/](https://github.com/)<your-username>/guardz-fetch-service.git
    cd guardz-fetch-service
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

## ▶️ Running the Application

### 🐳 Using Docker Compose (Recommended)

The easiest way to run the entire backend with all dependencies (Postgres, Redis, RabbitMQ, LocalStack) is using Docker Compose.

```bash
docker-compose up --build
```

This will start the following services:

*   **API Service:** [http://localhost:3000](http://localhost:3000)
*   **Redis Commander (UI):** [http://localhost:8081](http://localhost:8081)
*   **RabbitMQ Management:** [http://localhost:15672](http://localhost:15672) (User: `user`, Pass: `password`)
*   **LocalStack (S3):** [http://localhost:4566](http://localhost:4566)
*   **PostgreSQL:** Port `5432`

### 💻 Local Development

If you prefer to run the Node.js application locally but kept infrastructure in Docker:

1.  Start dependencies:
    ```bash
    docker-compose up redis postgres rabbitmq localstack
    ```
2.  Run the app:
    ```bash
    npm run start:dev
    ```

## ⚙️ Environment Variables

The application can be configured using environment variables. All variables are optional and have default values suitable for local development.

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `REDIS_HOST` | `localhost` | Hostname of the Redis server. |
| `REDIS_PORT` | `6379` | Port of the Redis server. |
| `AWS_REGION` | `us-east-1` | AWS Region for S3 client. |
| `S3_ENDPOINT` | `http://localhost:4566` | S3 Endpoint URL (default points to LocalStack). |
| `AWS_ACCESS_KEY_ID` | `test` | AWS Access Key ID. |
| `AWS_SECRET_ACCESS_KEY` | `test` | AWS Secret Access Key. |
| `S3_BUCKET_NAME` | `scraped-content` | Name of the S3 bucket to store scraped content. |
| `PORT` | `3000` | Port for the API server. |
| `THROTTLE_TTL` | `60000` | Rate limit time window in milliseconds (60 seconds). |
| `THROTTLE_LIMIT` | `100` | Maximum number of requests allowed per time window. |
| `FETCH_TIMEOUT` | `5000` | Timeout for fetching URLs in milliseconds. |
| `FETCH_MAX_REDIRECTS` | `5` | Maximum number of redirects to follow when fetching URLs. |

