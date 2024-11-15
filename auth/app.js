import FastAPI from "fastify";

import {
  commands
} from "./commands.js";

import {
  ensureSessionsDir,
  readSession,
  writeSession,
  deleteSession,
} from "./sessions.js";

import {
  setupRequest,
  processCommand,
  handleTokenValidation,
  saveTokens,
  loadAccessToken,
  setupClient,
  postRequest,
  getRequest,
  captureRedirectLocation,
  getAccessToken,
} from "./utils.js";

const app = FastAPI();
const port = 3000;

/**
 * Endpoint to handle authentication and initiate PKCE flow
 */
app.post("/auth", async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    res.status(400).send({ success: false, error: "Missing required parameters." });
    return;
  }

  console.log("Starting PKCE auth");
  const client = await setupClient();

  // Generate the code verifier and code challenge for PKCE
  const code_verifier = generators.codeVerifier();
  const code_challenge = generators.codeChallenge(code_verifier);

  // Generate the authorization URL with the code challenge for PKCE
  const authorizationUrl = client.authorizationUrl({
    scope: "https://gmb2cprod.onmicrosoft.com/3ff30506-d242-4bed-835b-422bf992622e/Test.Read openid profile offline_access",
    code_challenge,
    code_challenge_method: "S256",
  });

  console.log("got PKCE code verifier:", code_verifier);

  //Follow authentication url
  var authResponse = await getRequest(authorizationUrl);

  // Extract CSRF token and transaction ID
  var csrfToken = getRegexMatch(authResponse.data, `\"csrf\":\"(.*?)\"`);
  var transId = getRegexMatch(authResponse.data, `\"transId\":\"(.*?)\"`);

  // Send user credentials to custom policy endpoint
  console.log("Sending GM login credentials");
  const cpe1Url = `https://custlogin.gm.com/gmb2cprod.onmicrosoft.com/B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn/SelfAsserted?tx=${transId}&p=B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn`;
  
  const cpe1Data = {
    request_type: "RESPONSE",
    logonIdentifier: email,
    password: password,
  };
  var cpe1Response = await postRequest(cpe1Url, cpe1Data, csrfToken);

  // Request the MFA page
  const mfaRequestURL = `https://custlogin.gm.com/gmb2cprod.onmicrosoft.com/B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn/api/CombinedSigninAndSignup/confirmed?rememberMe=true&csrf_token=${csrfToken}&tx=${transId}&p=B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn`;
  var authResponse = await getRequest(mfaRequestURL);
  
  // Extract updated CSRF token and transaction ID for MFA
  var csrfToken = getRegexMatch(authResponse.data, `\"csrf\":\"(.*?)\"`);
  var transId = getRegexMatch(authResponse.data, `\"transId\":\"(.*?)\"`);

  // Request MFA code
  console.log("Requesting MFA Code. Check your email!");
  const cpe2Url = `https://custlogin.gm.com/gmb2cprod.onmicrosoft.com/B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn/SelfAsserted/DisplayControlAction/vbeta/emailVerificationControl-RO/SendCode?tx=${transId}&p=B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn`;
  const cpe2Data = {
    emailMfa: email
  };
  
  var cpe2Response = await postRequest(cpe2Url, cpe2Data, csrfToken);
  // console.dir(cpe2Response)

 // Save session data
  await writeSession(email, { transaction: transId, csrf: csrfToken, code_verifier: code_verifier });

  res.send({ success: true, message: "MFA request sent. Check your email." });
  
});

/**
 * Endpoint to handle MFA verification and complete authentication
 */  
app.post("/mfa", async (req, res) => {

  const { email, code } = req.body;

  // Validate input
  if (!email || !code) {
    res.status(400).send({ success: false, error: "Missing required parameters." });
    return;
  }

  // Load session data
  const sessionData = await readSession(email);

  if (!sessionData) {
    res.status(404).send({ success: false, error: "Session not found." });
    return;
  }

  const { transaction, csrf, code_verifier } = sessionData;

  // Submit MFA code
  console.log("Submitting MFA Code.");
  const postMFACodeURL = `https://custlogin.gm.com/gmb2cprod.onmicrosoft.com/B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn/SelfAsserted/DisplayControlAction/vbeta/emailVerificationControl-RO/VerifyCode?tx=${transaction}&p=B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn`;
  // console.log(postMFACodeURL);
  const MFACodeData = {
    emailMfa: email,
    verificationCode: code,
  };
  
  var MFACodeResponse = await postRequest(postMFACodeURL, MFACodeData, csrf);

  // Complete MFA process
  const postMFACodeRespURL = `https://custlogin.gm.com/gmb2cprod.onmicrosoft.com/B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn/SelfAsserted?tx=${transaction}&p=B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn`;
  // console.log(postMFACodeRespURL);
  
  const MFACodeDataResp = {
    emailMfa: email,
    verificationCode: code,
    request_type: "RESPONSE",
  };
  
  var MFACodeResponse = await postRequest(postMFACodeRespURL, MFACodeDataResp, csrf);

  // Retrieve authorization code
  const authCodeRequestURL = `https://custlogin.gm.com/gmb2cprod.onmicrosoft.com/B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn/api/SelfAsserted/confirmed?csrf_token=${csrf}&tx=${transaction}&p=B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn`;
  
  // Get auth Code request url
  var authResponse = await captureRedirectLocation(authCodeRequestURL);
  
  var authCode = getRegexMatch(authResponse, `code=(.*)`);
  // console.log("Auth Code:", authCode);

  // Exchange authorization code for tokens
  var thisTokenSet = await getAccessToken(authCode, code_verifier);
  // console.log(thisTokenSet);

  console.log("Saving MS tokens for ", email);
  saveTokens(email, thisTokenSet);

  // Delete session data
  await deleteSession(email);

  res.send({ success: true, message: "MFA completed, tokens saved." });

});


Object.keys(commands).forEach((command) => {
  app.post(`/${command}`, async (req, res) => {
    const { email, vin, uuid } = req.body;

    // Validate required parameters
    if (!email || !vin || !uuid) {
      res.status(400).send({ success: false, error: "Missing required parameters." });
      return;
    }

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
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`Server running on http://0.0.0.0:${port}`);
  } catch (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
};

startServer();
