export const authConfig = {
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_10 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  pkce: {
    scope:
      "https://gmb2cprod.onmicrosoft.com/3ff30506-d242-4bed-835b-422bf992622e/Test.Read openid profile offline_access",
    code_challenge_method: "S256",
  },
  endpoints: {
    authorizationUrl: (client) => client.authorizationUrl.bind(client),
    mfaRequestUrl: (csrfToken, transId) =>
      `https://custlogin.gm.com/gmb2cprod.onmicrosoft.com/B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn/api/CombinedSigninAndSignup/confirmed?rememberMe=true&csrf_token=${csrfToken}&tx=${transId}&p=B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn`,
    sendCredentialsUrl: (transId) =>
      `https://custlogin.gm.com/gmb2cprod.onmicrosoft.com/B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn/SelfAsserted?tx=${transId}&p=B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn`,
    sendMfaVerifyUrl: (method, transId) =>
      `https://custlogin.gm.com/gmb2cprod.onmicrosoft.com/B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn/SelfAsserted/DisplayControlAction/vbeta/${method}/VerifyCode?tx=${transId}&p=B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn`,
    confirmMfaUrl: (csrfToken, transId) =>
      `https://custlogin.gm.com/gmb2cprod.onmicrosoft.com/B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn/api/SelfAsserted/confirmed?csrf_token=${csrfToken}&tx=${transId}&p=B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn`,
    sendMfaCodeUrl: (method, transId) =>
      `https://custlogin.gm.com/gmb2cprod.onmicrosoft.com/B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn/SelfAsserted/DisplayControlAction/vbeta/${method}/SendCode?tx=${transId}&p=B2C_1A_SEAMLESS_MOBILE_SignUpOrSignIn`,
    openIdConfig:
      "https://custlogin.gm.com/gmb2cprod.onmicrosoft.com/b2c_1a_seamless_mobile_signuporsignin/v2.0/.well-known/openid-configuration",
    gmApiTokenUrl: "https://na-mobile-api.gm.com/sec/authz/v3/oauth/token",
    vehiclesUrl: "https://na-mobile-api.gm.com/api/v1/account/vehicles",
    commandUrl: (vin, command) =>
      `https://na-mobile-api.gm.com/api/v1/account/vehicles/${vin}/${command}`,
  },
};
