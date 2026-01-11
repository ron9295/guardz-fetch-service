# guardz-fetch-service

A backend service built with [NestJS](https://nestjs.com/) that exposes an HTTP API to fetch and retrieve the content of given HTTP URLs.

This project was created as a home assignment for Guardz.

## 📋 Features

* **Submit URLs:** Endpoint to submit a list of URLs for processing.
* **Retrieve Content:** Endpoint to view the fetched content and metadata.
* **Robust Fetching:** Handles HTTP redirects automatically.
* **Error Handling:** Gracefully manages invalid URLs or network errors without crashing the service.

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

To run the project locally as required for the code review:

```bash
# development mode
npm run start

# watch mode (recommended for development)
npm run start:dev

# production mode
npm run start:prod
