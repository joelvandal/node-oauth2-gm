import FastAPI from "fastify";

import {
  saveTokens,
  loadAccessToken,
  setupClient,
  postRequest,
  getRequest,
  captureRedirectLocation,
  getAccessToken,
  getGMAPIToken
} from "./utils.js";

const app = FastAPI();
const port = 3000;

app.post("/auth", async (req, res) => {
  const { email, password } = req.body;

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

  //get correlation id
  var csrfToken = getRegexMatch(authResponse.data, `\"csrf\":\"(.*?)\"`);
  
  //get transId/stateproperties
  var transId = getRegexMatch(authResponse.data, `\"transId\":\"(.*?)\"`);

  //send credentials to custom policy endpoint
  console.log("Sending GM login credentials");
  const cpe1Url = `https://custlogin.gm.com/gmb2cprod.onmicrosoft.com/B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn/SelfAsserted?tx=${transId}&p=B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn`;
  // console.log(cpe1Url);
  
  const cpe1Data = {
    request_type: "RESPONSE",
    logonIdentifier: email,
    password: password,
  };
  var cpe1Response = await postRequest(cpe1Url, cpe1Data, csrfToken);

  //load the page that lets us request the MFA Code
  const mfaRequestURL = `https://custlogin.gm.com/gmb2cprod.onmicrosoft.com/B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn/api/CombinedSigninAndSignup/confirmed?rememberMe=true&csrf_token=${csrfToken}&tx=${transId}&p=B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn`;
  
  //Get MFA request url
  var authResponse = await getRequest(mfaRequestURL);
  
  //get csrf
  var csrfToken = getRegexMatch(authResponse.data, `\"csrf\":\"(.*?)\"`);
  
  //get transId/stateproperties
  var transId = getRegexMatch(authResponse.data, `\"transId\":\"(.*?)\"`);

  // request mfa code
  console.log("Requesting MFA Code. Check your email!");
  const cpe2Url = `https://custlogin.gm.com/gmb2cprod.onmicrosoft.com/B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn/SelfAsserted/DisplayControlAction/vbeta/emailVerificationControl-RO/SendCode?tx=${transId}&p=B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn`;
  const cpe2Data = {
    emailMfa: email
  };
  
  var cpe2Response = await postRequest(cpe2Url, cpe2Data, csrfToken);
  // console.dir(cpe2Response)

  res.send({ success: true, transaction: transId, csrf: csrfToken, code_verifier: code_verifier });
  
});
  
app.post("/mfa", async (req, res) => {

  const { email, code, transaction, csrf, code_verifier } = req.body;

  if (!code) {
    res.status(400).send({ success: false, error: "Missing required parameters." });
    return;
  }

  //submit MFA code
  console.log("Submitting MFA Code.");
  const postMFACodeURL = `https://custlogin.gm.com/gmb2cprod.onmicrosoft.com/B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn/SelfAsserted/DisplayControlAction/vbeta/emailVerificationControl-RO/VerifyCode?tx=${transaction}&p=B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn`;
  // console.log(postMFACodeURL);
  const MFACodeData = {
    emailMfa: email,
    verificationCode: code,
  };
  
  var MFACodeResponse = await postRequest(postMFACodeURL, MFACodeData, csrf);

  //RESPONSE - not sure what this does, but we need to do it to move on
  const postMFACodeRespURL = `https://custlogin.gm.com/gmb2cprod.onmicrosoft.com/B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn/SelfAsserted?tx=${transaction}&p=B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn`;
  // console.log(postMFACodeRespURL);
  
  const MFACodeDataResp = {
    emailMfa: email,
    verificationCode: code,
    request_type: "RESPONSE",
  };
  
  var MFACodeResponse = await postRequest(postMFACodeRespURL, MFACodeDataResp, csrf);

  //Get Auth Code in redirect (This actually contains the 'code' for completing PKCE in the oauth flow)
  const authCodeRequestURL = `https://custlogin.gm.com/gmb2cprod.onmicrosoft.com/B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn/api/SelfAsserted/confirmed?csrf_token=${csrf}&tx=${transaction}&p=B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn`;
  
  //Get auth Code request url
  var authResponse = await captureRedirectLocation(authCodeRequestURL);
  
  var authCode = getRegexMatch(authResponse, `code=(.*)`);
  // console.log("Auth Code:", authCode);

  //use code with verifier to get MS access token!
  var thisTokenSet = await getAccessToken(authCode, code_verifier);
  // console.log(thisTokenSet);

  console.log("Saving MS tokens for ", email);
  saveTokens(email, thisTokenSet);

});
  

app.post("/start", async (req, res) => {
  const { email, vin, uuid } = req.body;

  if (!email || !vin || !uuid) {
    res.status(400).send({ success: false, error: "Missing required parameters." });
    return;
  }

  //Try to load a saved token set
  const loadedTokenSet = await loadAccessToken(email);
  
  if (loadedTokenSet !== false) {
    //we already have our MS tokens, let's use them to get the access token for the GM API!
    // console.log(loadedTokenSet);
    
    console.log("Existing tokens loaded!");
    const GMAPIToken = await getGMAPIToken(loadedTokenSet, vin, uuid);
    // console.log(GMAPIToken);
  } else {
    console.log("No existing tokens found or were invalid.");
    return false;
  }
});

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
