# Authentication Server for OnStar (GM)

This repository contains an authentication server built with [Fastify](https://www.fastify.io/). The server is designed to integrate with OnStar (GM) services, implementing PKCE (Proof Key for Code Exchange) flows and integrating with an OpenID Connect provider for secure user authentication. It also handles token management and MFA (Multi-Factor Authentication).

The original code for this project is based on [https://github.com/metheos/node-oauth2-gm](https://github.com/metheos/node-oauth2-gm).

## Features
- **PKCE Authentication Flow**: Implements the PKCE flow for secure authentication without a client secret.
- **MFA Support**: Requests and verifies multi-factor authentication codes via email.
- **Token Management**: Handles saving, loading, and refreshing tokens.
- **Modular Codebase**: Utility functions for common tasks are separated for reusability and maintainability.

## Prerequisites
- Node.js (v18 or later)
- npm or yarn

## Installation

1. Clone the repository:
   ```bash
   git clone git@github.com:joelvandal/node-oauth2-gm.git
   cd node-oauth2-gm
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Project Structure

```
.
├── auth/
│   ├── utils.js        # Utility functions for authentication
│   └── app.js          # Main application file
├── package.json        # Dependencies and scripts
└── README.md           # Documentation
```

## Usage

1. Start the server:
   ```bash
   npm start
   ```
   The server will run at `http://0.0.0.0:3000`.

2. For development, use the following command to enable hot-reloading:
   ```bash
   npm run dev
   ```

## Endpoints

### `/auth`
- **Method**: `POST`
- **Description**: Initiates the PKCE flow and sends user credentials.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "transaction": "transaction_id",
    "csrf": "csrf_token",
    "code_verifier": "code_verifier"
  }
  ```

### `/mfa`
- **Method**: `POST`
- **Description**: Submits the MFA code for verification.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "code": "123456",
    "transaction": "transaction_id",
    "csrf": "csrf_token",
    "code_verifier": "code_verifier"
  }
  ```
- **Response**:
  ```json
  {
    "success": true
  }
  ```

### `/start`
- **Method**: `POST`
- **Description**: Starts a session using a previously saved token.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "vin": "vehicle_id",
    "uuid": "device_uuid"
  }
  ```
- **Response**:
  ```json
  {
    "success": true
  }
  ```

## Scripts
- `npm start`: Starts the server.
- `npm run dev`: Starts the server with hot-reloading for development.

## Dependencies

- [Fastify](https://www.fastify.io/): Web framework.
- [openid-client](https://github.com/panva/node-openid-client): OpenID Connect client.
- [axios](https://github.com/axios/axios): HTTP client.
- [tough-cookie](https://github.com/salesforce/tough-cookie): Cookie handling.

## License
This project is licensed under the MIT License. See the LICENSE file for details.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request.

## Contact
For any inquiries or support, please reach out at joel@vandal.ca.

