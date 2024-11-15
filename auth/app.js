import "dotenv/config";
import FastAPI from "fastify";

import { authConfig } from "./config.js";

import { commands } from "./commands.js";

import {
  ensureSessionsDir,
  readSession,
  writeSession,
  deleteSession,
} from "./sessions.js";

import {
  validateInputs,
  extractTokens,
  setupRequest,
  processCommand,
  ensureTokensDir,
  saveTokens,
  setupClient,
  getVehicles,
  postRequest,
  getRequest,
  getRegexMatch,
  captureRedirectLocation,
  getAccessToken,
} from "./utils.js";

import { generators } from "openid-client";

const app = FastAPI();
const host = process.env.HOST || "localhost";
const port = process.env.PORT || 3000;

await ensureTokensDir();
await ensureSessionsDir();

/**
 * Endpoint authentifcation
 */
app.addHook("onRequest", async (req, res) => {
  const apiToken = process.env.API_TOKEN;

  // Skip verification if API_TOKEN is not defined or empty
  if (!apiToken) {
    return;
  }

  const token = req.headers.authorization;

  if (token !== `Bearer ${apiToken}`) {
    res.status(401).send({ success: false, error: "Unauthorized" });
  }
});

/**
 * Endpoint to handle authentication and initiate PKCE flow
 */
app.post("/auth", async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!validateInputs({ email, password }, res)) return;

  try {
    console.log("Starting PKCE auth");
    console.log("Starting PKCE auth");
    const client = await setupClient();

    const { scope, code_challenge_method } = authConfig.pkce;

    // Generate the code verifier and code challenge for PKCE
    const code_verifier = generators.codeVerifier();
    const code_challenge = generators.codeChallenge(code_verifier);

    // Generate the authorization URL with the code challenge for PKCE
    const authorizationUrl = client.authorizationUrl({
      scope,
      code_challenge,
      code_challenge_method,
    });

    console.log("got PKCE code verifier:", code_verifier);

    //Follow authentication url
    var authResponse = await getRequest(authorizationUrl);

    // Extract CSRF token and transaction ID
    let { csrfToken, transId } = extractTokens(authResponse);

    // Send user credentials to custom policy endpoint
    console.log("Sending GM login credentials");

    const sendCredentialsUrl = authConfig.endpoints.sendCredentialsUrl(transId);
    const credentialsData = {
      request_type: "RESPONSE",
      logonIdentifier: email,
      password,
    };

    await postRequest(sendCredentialsUrl, credentialsData, csrfToken);

    // Request the MFA page
    const mfaRequestUrl = authConfig.endpoints.mfaRequestUrl(
      csrfToken,
      transId,
    );
    const mfaResponse = await getRequest(mfaRequestUrl);

    // Extract CSRF token and transaction ID
    ({ csrfToken, transId } = extractTokens(mfaResponse));

    console.log("Requesting MFA Code. Check your email!");

    const mfaConfirmUrl = authConfig.endpoints.sendMfaCodeUrl(transId);
    const confirmData = {
      emailMfa: email,
    };

    await postRequest(mfaConfirmUrl, confirmData, csrfToken);

    // Save session data
    await writeSession(email, {
      transaction: transId,
      csrf: csrfToken,
      code_verifier,
    });

    res.send({ success: true, message: "MFA request sent. Check your email." });
  } catch (error) {
    console.error("Error during PKCE auth:", error);
    res
      .status(500)
      .send({ success: false, error: "PKCE authentication failed." });
  }
});

/**
 * Endpoint to handle MFA verification and complete authentication
 */
app.post("/mfa", async (req, res) => {
  const { email, code } = req.body;

  // Validate input
  if (!validateInputs({ email, code }, res)) return;

  // Load session data
  const sessionData = await readSession(email);

  if (!sessionData) {
    res.status(404).send({ success: false, error: "Session not found." });
    return;
  }

  const { transaction, csrf, code_verifier } = sessionData;

  // Submit MFA code
  console.log("Submitting MFA Code.");

  const postMFACodeURL = authConfig.endpoints.sendMfaVerifyUrl(transaction);
  const MFACodeData = {
    emailMfa: email,
    verificationCode: code,
  };

  await postRequest(postMFACodeURL, MFACodeData, csrf);

  // Complete MFA process
  const postMFACodeRespURL =
    authConfig.endpoints.sendCredentialsUrl(transaction);

  const MFACodeDataResp = {
    emailMfa: email,
    verificationCode: code,
    request_type: "RESPONSE",
  };

  await postRequest(postMFACodeRespURL, MFACodeDataResp, csrf);

  // Retrieve authorization code
  const authCodeRequestURL = authConfig.endpoints.confirmMfaUrl(
    csrf,
    transaction,
  );

  // Get auth Code request url
  var authResponse = await captureRedirectLocation(authCodeRequestURL);

  var authCode = getRegexMatch(authResponse, `code=(.*)`);

  // Exchange authorization code for tokens
  var thisTokenSet = await getAccessToken(authCode, code_verifier);

  console.log("Saving MS tokens for ", email);
  saveTokens(email, thisTokenSet);

  // Delete session data
  await deleteSession(email);

  res.send({ success: true, message: "MFA completed, tokens saved." });
});

/**
 * List vehicles available on the account
 */
app.post("/vehicles", async (req, res) => {
  const { email, uuid } = req.body;

  // Validate required parameters
  if (!validateInputs({ email, uuid }, res)) return;

  let vin = "";
  // Prepare the request
  const requestSetup = await setupRequest(email, vin, uuid, res);
  if (!requestSetup) return; // Error handled in setupRequest

  const { config } = requestSetup;

  // Get specific postData for the command, if available
  const postData = {
    includeCommands: true,
    includeEntitlements: true,
    includeModules: true,
    includeSharedVehicles: true
  };

  // Process the command
  const result = await getVehicles(postData, config);

  if (result.success) {
    res.send(result); // Successfully processed
  } else {
    res.status(result.statusCode || 500).send(result);
  }
});

/**
 * Dynamically generate all routes for commands
 */
Object.keys(commands).forEach((command) => {
  app.post(`/${command}`, async (req, res) => {
    const { email, vin, uuid } = req.body;

    // Validate required parameters
    if (!validateInputs({ email, vin, uuid }, res)) return;

    // Prepare the request
    const requestSetup = await setupRequest(email, vin, uuid, res);
    if (!requestSetup) return; // Error handled in setupRequest

    const { config } = requestSetup;

    // Get specific postData for the command, if available
    const postData = commands[command].postData || {};

    // Process the command
    const result = await processCommand(command, vin, postData, config);

    if (result.success) {
      res.send(result); // Successfully processed
    } else {
      res.status(408).send(result); // Timeout or error
    }
  });
});

/**
 * Start the server and listen for requests
 */
const startServer = async () => {
  try {
    await app.listen({ port, host });
    console.log(`Server running on http://${host}:${port}`);
  } catch (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
};

startServer();
