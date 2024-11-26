# Unofficial Node.js Library for OnStar Requests

This repository contains an unofficial Node.js library designed to facilitate interaction with OnStar services. It provides support for secure authentication using PKCE (Proof Key for Code Exchange) flows, token management, and Multi-Factor Authentication (MFA), as well as issuing commands to OnStar-enabled vehicles. **Use at your own risk** as this is an unofficial implementation.

## Features

**Note**: This code is based on [https://github.com/metheos/node-oauth2-gm](https://github.com/metheos/node-oauth2-gm).

- **PKCE Authentication Flow**: Implements the PKCE flow for secure authentication without requiring a client secret.
- **MFA Support**: Requests and verifies Multi-Factor Authentication codes via email.
- **Token Management**: Handles saving, loading, and refreshing tokens securely.
- **Vehicle Commands**: Provides endpoints to send requests such as locking/unlocking doors, starting the vehicle, and diagnostics.
- **Utility Functions**: Modular codebase with reusable utility functions.

## Supported MFA Methods 🔒

This library supports the following Multi-Factor Authentication (MFA) methods for enhanced security:

- **Email:** Fully supported. MFA codes are sent to the user's registered email address.
- **TOTP (Time-based One-Time Password):** Fully supported. Compatible with popular authenticator apps like Google Authenticator, Authy, or Microsoft Authenticator.
- **SMS:** _Currently under development._ Support for SMS-based MFA will be available in a future release.

Stay tuned for updates on SMS support!

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

3. C*onfigure environment variables:
   Copy the provided **`.env.example`** file to **`.env`**:*

   ```bash
   cp .env.example .env
   ```

   _Example **`.env`** file content:_

   ```env
   API_TOKEN=my_secure_api_token
   HOST=localhost
   PORT=3000
   ```

   - The `API_TOKEN` can be left empty, but if specified, the API will require Bearer authentication.
   - Replace `localhost` with `0.0.0.0` to listen on all interfaces.

## Project Structure

```
.
├── auth/
│   ├── app.js          # Main application file
│   ├── commands.js     # Command definitions for vehicle interactions
│   ├── config.js       # Configuration settings
│   ├── sessions.js     # Session management for users
│   └── utils.js        # Utility functions for authentication
├── package.json        # Dependencies and scripts
├── .env.example        # Example environment configuration
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
    "message": "MFA request sent. Check your email."
  }
  ```

### `/verify`

- **Method**: `POST`
- **Description**: Submits the MFA code for verification.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "code": "123456"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "MFA completed, tokens saved."
  }
  ```

### `/token`

- **Method**: `GET`
- **Description**: Retrieve MS Auth Token for a given email
- **Query Parameter**:
  - email (string, required): The email address associated with the MS Auth Token.

- **Response**:
  ```json
  {
    "success": true,
    "access_token": "ACCESS_TOKEN"
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

### `/vehicles`

- **Method**: `POST`
- **Description**: Retrieves the list of vehicles linked to the user's account.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "uuid": "device_uuid"
  }
  ```
- **Response**:

  ```json
  {
    "success": true,
    "data": {
      "vehicles": [
        { "vin": "1234567890ABCDEF", "make": "Chevrolet", "model": "Malibu" },
        { "vin": "0987654321FEDCBA", "make": "GMC", "model": "Terrain" }
      ]
    }
  }
  ```

  In case of an error:

  ```json
  {
    "success": false,
    "error": "Unauthorized",
    "statusCode": 401
  }
  ```

### Vehicle Commands

The following commands are available, allowing interaction with the vehicle:

- **`start`**: Remotely starts the vehicle.
- **`cancelStart`**: Cancels a previous remote start command.
- **`lockDoor`**: Locks the doors.
- **`unlockDoor`**: Unlocks the doors.
- **`lockTrunk`**: Locks the trunk.
- **`unlockTrunk`**: Unlocks the trunk.
- **`location`**: Retrieves the vehicle's current location.
- **`alert`**: Triggers a vehicle alert (honk horns/flash lights).
- **`cancelAlert`**: Cancels a vehicle alert (honk horns/flash lights).
- **`diagnostics`**: Retrieves diagnostic vehicle data.

Additional commands include:

- **`getHotspotInfo`**: Retrieves WiFi hotspot information.
- **`sendTBTRoute`**: Calculates and sends turn-by-turn directions to the vehicle.
- **`chargeOverride`**: Sends a charge override command.
- **`getChargingProfile`**: Retrieves the current charging profile.
- **`setChargingProfile`**: Sets a new charging profile.
- **`getCommuteSchedule`**: Retrieves the commuting schedule.
- **`setCommuteSchedule`**: Updates the commuting schedule.
- **`stopFastCharge`**: Stops the current fast charge.
- **`createTripPlan`**: Creates a new trip plan.
- **`getTripPlan`**: Retrieves an existing trip plan.
- **`getHotspotStatus`**: Retrieves WiFi hotspot status.
- **`setHotspotInfo`**: Updates the WiFi SSID and passphrase.
- **`disableHotspot`**: Disables the WiFi hotspot.
- **`enableHotspot`**: Enables the WiFi hotspot.
- **`stopCharge`**: Stops the charging process.
- **`setHvacSettings`**: Configures the HVAC settings remotely.
- **`getChargerPowerLevel`**: Retrieves the current charger power level.
- **`setChargerPowerLevel`**: Sets a new charger power level.
- **`getRateSchedule`**: Retrieves the EV rate schedule.
- **`setRateSchedule`**: Sets a new EV rate schedule.
- **`setPriorityCharging`**: Configures priority charging.
- **`getPriorityCharging`**: Retrieves the priority charging configuration.
- **`startTrailerLightSeq`**: Starts the trailer light sequence.
- **`stopTrailerLightSeq`**: Stops the trailer light sequence.

All commands require the following parameters in the request body:

```json
{
  "email": "user@example.com",
  "vin": "vehicle_id",
  "uuid": "device_uuid"
}
```

## Notes on UUID

Use a random version 4 UUID as the `deviceId` for vehicle interactions. This ensures uniqueness and compatibility with the OnStar service.

## Scripts

- `npm start`: Starts the server.
- `npm run dev`: Starts the server with hot-reloading for development.

## Dependencies

- [Fastify](https://www.fastify.io/): Web framework.
- [openid-client](https://github.com/panva/node-openid-client): OpenID Connect client.
- [axios](https://github.com/axios/axios): HTTP client.
- [tough-cookie](https://github.com/salesforce/tough-cookie): Cookie handling.

## Funding 💖

If you'd like to support this project and my work, here are a few options:

- **[Buy Me a Coffee](https://buymeacoffee.com/jvandal):** Show your support by buying me a coffee!
- **[PayPal](https://paypal.me/joelvandal):** Send your contributions directly via PayPal.
- **Interac Transfer:** You can also send support via Interac to [joel@vandal.ca](mailto:joel@vandal.ca).

Every contribution helps me dedicate more time to improving this project. Thank you! 🙌

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Contact

For any inquiries or support, please reach out at [joel@vandal.ca](mailto:joel@vandal.ca).
