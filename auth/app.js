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
  createAxiosClient,
  validateInputs,
  extractTokens,
  setupRequest,
  processCommand,
  setupClient,
  getVehicles,
  postRequest,
  getRequest,
  getRegexMatch,
  captureRedirectLocation,
  getAccessToken,
} from "./utils.js";

import { loadAccessToken, ensureTokensDir, saveTokens } from "./tokens.js";

import { ensureCookiesDir, deleteCookieJar } from "./cookies.js";

import { generators } from "openid-client";

const app = FastAPI();
const host = process.env.HOST || "localhost";
const port = process.env.PORT || 3000;

await ensureCookiesDir();
await ensureTokensDir();
await ensureSessionsDir();

/**
 * Endpoint authentication
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

  // Cleanup cookie on initial authentication
  await deleteCookieJar(email);

  // Delete session data
  await deleteSession(email);

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
    const authResponse = await getRequest(email, authorizationUrl);

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

    await postRequest(email, sendCredentialsUrl, credentialsData, csrfToken);

    console.log("Retrieve CSRF and Transaction ID");

    // Request the MFA page
    const mfaRequestUrl = authConfig.endpoints.mfaRequestUrl(
      csrfToken,
      transId,
    );

    console.dir(mfaRequestUrl);
    const mfaResponse = await getRequest(email, mfaRequestUrl);
    if (typeof mfaResponse === "undefined") {
      console.log(`Invalid username and/or password for ${email}`);
      res
        .status(302)
        .send({ success: false, error: "Invalid username and/or password." });
      return;
    }

    // Extract CSRF token and transaction ID
    ({ csrfToken, transId } = extractTokens(mfaResponse));

    const responseText = JSON.stringify(mfaResponse.data);

    const confirmData = {};
    let verificationType = "";
    let verificationMethod = "";
    let verificationPhone = "";
    if (responseText.includes("phoneVerificationControl")) {
      verificationType = "phone";
      verificationMethod = "phoneVerificationControl-readOnly";
      const regex = /(XXXX-XXX-\d{4})/;
      const match = responseText.match(regex);
      if (match) {
        verificationPhone = match[1];
      } else {
        res.status(302).send({
          success: false,
          error: "No phone number detected.",
        });
        return;
      }
      confirmData.strongAuthenticationPhoneNumber = verificationPhone;

      // TODO: Fix SMS authentication
      res.status(302).send({
        success: false,
        error: "Unsupported authentication method.",
      });
      return;
    } else if (responseText.includes("emailVerificationControl")) {
      verificationType = "email";
      verificationMethod = "emailVerificationControl-RO";
      confirmData.emailMfa = email;
    } else if (responseText.includes("otpCode")) {
      verificationType = "otp";
    } else {
      res.status(302).send({
        success: false,
        error: "Unsupported authentication method.",
      });
      return;
    }

    if (verificationType != "otp") {
      const mfaConfirmUrl = authConfig.endpoints.sendMfaCodeUrl(
        verificationMethod,
        transId,
      );

      const confirmResponse = await postRequest(
        email,
        mfaConfirmUrl,
        confirmData,
        csrfToken,
        mfaRequestUrl,
      );

      if (typeof confirmResponse === "undefined") {
        res.status(302).send({
          success: false,
          error:
            "Verify your that you are using Phone or Email authentification.",
        });
        return;
      }

      console.log(confirmResponse.data);

      if (confirmResponse.data.status != "200") {
        res
          .status(confirmResponse.data.status)
          .send({ success: false, error: confirmResponse.data.message });
        return;
      }
    }

    // Save session data
    await writeSession(email, {
      transaction: transId,
      csrf: csrfToken,
      code_verifier,
      verificationType,
      verificationPhone,
    });

    console.log(`Requesting MFA Code. Check your ${verificationType} !`);
    res.send({
      success: true,
      message: `MFA request sent. Check your ${verificationType}.`,
    });
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
app.post("/verify", async (req, res) => {
  const { email, code } = req.body;

  // Validate input
  if (!validateInputs({ email, code }, res)) return;

  // Load session data
  const sessionData = await readSession(email);

  if (!sessionData) {
    res.status(404).send({ success: false, error: "Session not found." });
    return;
  }

  const {
    transaction,
    csrf,
    code_verifier,
    verificationType,
    verificationPhone,
  } = sessionData;

  // Submit MFA code
  console.log("Submitting MFA Code.");

  if (verificationType == "email") {
    let verificationMethod = "emailVerificationControl-RO";
    const postMFACodeURL = authConfig.endpoints.sendMfaVerifyUrl(
      verificationMethod,
      transaction,
    );

    const MFACodeData = {
      emailMfa: email,
      verificationCode: code,
    };

    await postRequest(email, postMFACodeURL, MFACodeData, csrf);
  }

  if (verificationType == "phone") {
    let verificationMethod = "phoneVerificationControl-readOnly";
    const postMFACodeURL = authConfig.endpoints.sendMfaVerifyUrl(
      verificationMethod,
      transaction,
    );

    const MFACodeData = {
      strongAuthenticationPhoneNumber: verificationPhone,
      verificationCode: code,
    };

    await postRequest(email, postMFACodeURL, MFACodeData, csrf);
  }

  // Complete MFA process
  const postMFACodeRespURL =
    authConfig.endpoints.sendCredentialsUrl(transaction);

  const MFACodeDataResp = {
    request_type: "RESPONSE",
  };

  if (verificationType == "email") {
    MFACodeDataResp.emailMfa = email;
    MFACodeDataResp.verificationCode = code;
  }

  if (verificationType == "phone") {
    MFACodeDataResp.strongAuthenticationPhoneNumber = verificationPhone;
    MFACodeDataResp.verificationCode = code;
  }

  if (verificationType == "otp") {
    MFACodeDataResp.otpCode = code;
  }

  await postRequest(email, postMFACodeRespURL, MFACodeDataResp, csrf);

  // Retrieve authorization code
  const authCodeRequestURL = authConfig.endpoints.confirmMfaUrl(
    csrf,
    transaction,
  );

  // Get auth Code request url
  var authResponse = await captureRedirectLocation(email, authCodeRequestURL);

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
 * Endpoint to retrieve MS Auth Token for a given email
 */
app.get("/token", async (req, res) => {
  const email = req.query.email;

  // Validate email
  if (!email) {
    res.status(400).send({ success: false, error: "Email is required."
  });
  }

  try {
    console.log(`Fetching MS token for ${email}`);

    // Read token data
    const tokenData = await loadAccessToken(email);

    if (!tokenData || !tokenData.access_token) {
      res.status(404).send({ success: false, error: "Token not found." });
      return;
   }
   
    res.send({ success: true, access_token: tokenData.access_token });
  } catch (error) {
    console.error("Error fetching token:", error);
    res.status(500).send({ success: false, error: "Failed to retrieve token." });
  }
});

/**
 * List vehicles available on the account
 */
app.post("/vehicles", async (req, res) => {
  const { email, uuid } = req.body;

  // Validate required parameters
  if (!validateInputs({ email, uuid }, res)) return;

  // VIN may not be required for this endpoint
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
    includeSharedVehicles: true,
  };

  // Process the command
  const result = await getVehicles(email, postData, config);

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
    const { email, vin, uuid, ...additionalParams } = req.body;
    // Validate required parameters
    if (!validateInputs({ email, vin, uuid }, res)) return;

    // Create an Axios client specific to the user
    const axiosClient = await createAxiosClient(email);

    // Prepare the request
    const requestSetup = await setupRequest(email, vin, uuid, res);
    if (!requestSetup) return; // Error handled in setupRequest

    const { config } = requestSetup;

    // Command to execute
    const commandUrl = commands[command].url || false;
    if (!commandUrl) {
      return res.status(400).send({ error: "Invalid command configuration" });
    }

    // Get specific postData for the command, if available
    const defaultPostData = commands[command].postData || {};
    const mergedPostData = {
      ...defaultPostData,
      ...additionalParams, // Overrides defaults with user-provided values
    };

    // Remove any false or undefined values if needed
    const filteredPostData = Object.fromEntries(
      Object.entries(mergedPostData).filter(
        ([_, value]) => value !== false && value !== undefined, // eslint-disable-line no-unused-vars
      ),
    );

    // Process the command
    const result = await processCommand(
      email,
      commandUrl,
      vin,
      filteredPostData,
      {
        ...config,
        axiosClient, // Pass the Axios client
      },
    );

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
