import { authConfig } from "./config.js";
import axios from "axios";
import { HttpCookieAgent, HttpsCookieAgent } from "http-cookie-agent/http";
import * as openidClient from "openid-client";
import qs from "qs";

import { loadAccessToken } from "./tokens.js";

import { loadCookieJar, saveCookieJar } from "./cookies.js";

const { Issuer } = openidClient;

export async function createAxiosClient(email) {
  const jar = await loadCookieJar(email);

  const axiosClient = axios.create({
    httpAgent: new HttpCookieAgent({ cookies: { jar } }),
    httpsAgent: new HttpsCookieAgent({ cookies: { jar } }),
    headers: {
      "User-Agent": authConfig.userAgent,
    },
  });

  // Save the cookie jar after each request
  axiosClient.interceptors.response.use(
    async (response) => {
      await saveCookieJar(email, jar);
      return response;
    },
    async (error) => {
      await saveCookieJar(email, jar);
      return Promise.reject(error);
    },
  );

  return axiosClient;
}

export const handleTokenValidation = async (email, vin, uuid, res) => {
  // Load existing tokens
  const loadedTokenSet = await loadAccessToken(email);

  if (loadedTokenSet !== false) {
    console.log("Existing tokens loaded!");
    const GMAPIToken = await getGMAPIToken(email, loadedTokenSet, vin, uuid);
    // Respond with success and token data
    return { success: true, GMAPIToken };
  } else {
    console.log("No existing tokens found or were invalid.");
    res.status(404).send({ success: false, error: "Tokens not found." });
    return null; // Return null to indicate failure
  }
};

export async function setupClient() {
  console.log("Doing auth discovery");
  const issuer = await Issuer.discover(authConfig.endpoints.openIdConfig);

  // Initialize the client without client_secret since PKCE doesn't require it
  return new issuer.Client({
    client_id: "3ff30506-d242-4bed-835b-422bf992622e",
    redirect_uris: ["msauth.com.gm.myChevrolet://auth"], // Add your app's redirect URI here
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
}

//use the MS token to get a GM API Token
//these GM API tokens are only valid for 30 minutes
export async function getGMAPIToken(email, tokenSet, vin, uuid) {
  // Create an Axios client specific to the user
  const axiosClient = await createAxiosClient(email);

  console.log("Requesting GM API Token using MS Access Token");
  const url = authConfig.endpoints.gmApiTokenUrl;
  var responseObj;
  const postData = {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    subject_token: tokenSet.access_token,
    subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
    scope: "msso role_owner priv onstar gmoc user user_trailer",
    device_id: uuid,
  };
  await axiosClient
    .post(url, postData, {
      withCredentials: true,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
    })
    .then((response) => {
      console.log("Response Status:", response.status);
      // console.log("Response Status:", response.statusText);
      // console.log("Response Headers:", response.headers);
      // console.log("Response:", response.data);
      // console.log(response.CookieJar.cookies);
      responseObj = response;
    })
    .catch((error) => {
      console.error("Error:", error.message);
    });
  const expires_at =
    Math.floor(new Date() / 1000) + parseInt(responseObj.data.expires_in);
  responseObj.data.expires_at = expires_at;

  console.log("Set GM Token expiration to ", expires_at);
  return responseObj.data;
}

export const validateInputs = (inputs, res) => {
  for (const [key, value] of Object.entries(inputs)) {
    if (!value) {
      res
        .status(400)
        .send({ success: false, error: `Missing required parameter: ${key}.` });
      return false;
    }
  }
  return true;
};

export const extractTokens = (authResponse) => {
  return {
    csrfToken: getRegexMatch(authResponse.data, `"csrf":"(.*?)"`),
    transId: getRegexMatch(authResponse.data, `"transId":"(.*?)"`),
  };
};

//little function to make grabbing a regex match simple
export function getRegexMatch(haystack, regexString) {
  let re = new RegExp(regexString);
  let r = haystack.match(re);
  if (r) {
    return r[1];
  } else {
    return false;
  }
}

//post request function for the MS oauth side of things
export async function postRequest(
  email,
  url,
  postData,
  csrfToken = "",
  referer = "",
) {
  let encodedData;

  const axiosClient = await createAxiosClient(email);

  if (typeof postData === "object") {
    if (postData.strongAuthenticationPhoneNumber) {
      encodedData = `&${qs.stringify(postData)}`;
    } else {
      encodedData = qs.stringify(postData);
    }
  } else if (typeof postData === "string") {
    if (
      postData.includes("strongAuthenticationPhoneNumber") &&
      !postData.startsWith("&")
    ) {
      encodedData = `&${postData}`;
    } else {
      encodedData = postData;
    }
  }

  console.log("Request URL:", url);
  // console.log("Encoded Data:", encodedData);

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    accept: "application/json, text/javascript, */*; q=0.01",
    origin: "https://custlogin.gm.com",
    "x-csrf-token": csrfToken,
  };

  if (referer) {
    headers.referer = referer;
  }

  // console.log("Request Headers:", headers);

  var responseObj;
  await axiosClient
    .post(url, encodedData, {
      withCredentials: true,
      headers,
    })
    .then((response) => {
      //console.log("Response Status:", response.status);
      //console.log("Response Headers:", response.headers);
      //console.log("Response Data:", response.data);

      // Axios does not expose cookies directly; use response.headers['set-cookie'] if available.
      //console.log("Cookies from Response Headers:", response.headers["set-cookie"]);

      responseObj = response;
    })
    .catch((error) => {
      console.error("Error Message:", error.message);

      if (error.response) {
        console.error("Error Response Status:", error.response.status);
        console.error("Error Response Headers:", error.response.headers);
        console.error("Error Response Data:", error.response.data);
      } else {
        console.error("No response received, Error:", error);
      }
    });

  return responseObj;
}

//general get request function with cookie support
export async function getRequest(email, url) {
  const axiosClient = await createAxiosClient(email);
  var responseObj;
  await axiosClient
    .get(url, { withCredentials: true, maxRedirects: 0 })
    .then((response) => {
      console.log("Response Status:", response.status);
      // console.log("Response Status:", response.statusText);
      // console.log("Response Headers:", response.headers);
      // console.log("Response:", response.data);
      responseObj = response;
    })
    .catch((error) => {
      console.error("Error:", error.message);
    });
  return responseObj;
}

//this helps grab the MS oauth pkce code response
export async function captureRedirectLocation(email, url) {
  const axiosClient = await createAxiosClient(email);
  console.log("Requesting PKCE code");
  var result = false;
  try {
    const response = await axiosClient.get(url, {
      maxRedirects: 0, // Prevent Axios from following redirects
      validateStatus: function (status) {
        // Accept any status code in the 300 range (or any other as needed)
        return status >= 200 && status < 400;
      },
    });

    if (response.status === 302) {
      // Capture the `Location` header
      const redirectLocation = response.headers["location"];
      // console.log("Redirect Location:", redirectLocation);
      result = redirectLocation;
    } else {
      // console.log("Response received:", response.data);
    }
  } catch (error) {
    // Handle errors (e.g., network issues) that are not redirect-related
    console.error("Error:", error.message);
  }

  return result;
}

//complete PKCE and get the MS tokens
export async function getAccessToken(code, code_verifier) {
  const client = await setupClient();

  try {
    // Exchange the authorization code and code verifier for an access token
    const tokenSet = await client.callback(
      "msauth.com.gm.myChevrolet://auth",
      { code },
      { code_verifier },
    );

    // console.log("Access Token:", tokenSet.access_token);
    // console.log("ID Token:", tokenSet.id_token);

    return tokenSet;
  } catch (err) {
    console.error("Failed to obtain access token:", err);
    throw err;
  }
}

export const setupRequest = async (email, vin, uuid, res) => {
  const axiosClient = await createAxiosClient(email);
  const api = await handleTokenValidation(email, vin, uuid, res);
  if (!api) return null;

  const GMAPIToken = api.GMAPIToken;

  const config = {
    withCredentials: true,
    headers: {
      authorization: `bearer ${GMAPIToken.access_token}`,
      "content-type": "application/json; charset=UTF-8",
      accept: "application/json",
    },
    axiosClient,
  };

  return { config, GMAPIToken };
};

export const getVehicles = async (email, postData, config) => {
  const axiosClient = await createAxiosClient(email);
  const commandUrl = authConfig.endpoints.vehiclesUrl;

  try {
    const response = await axiosClient.get(commandUrl, {
      params: postData,
      ...config,
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error.response?.data || error.message || "An unknown error occurred",
      statusCode: error.response?.status || 500,
    };
  }
};

export const processCommand = async (email, command, vin, postData, config) => {
  const commandUrl = authConfig.endpoints.commandUrl(vin, command);
  return await sendCommandAndWait(email, commandUrl, postData, config);
};

export const sendCommandAndWait = async (
  email,
  commandUrl,
  postData,
  config,
  maxRetries = 10,
  delayMs = 10000,
) => {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const axiosClient = await createAxiosClient(email); // User-specific Axios client

  try {
    const response = await axiosClient.post(commandUrl, postData, config);
    const { commandResponse } = response.data;

    if (
      commandResponse &&
      commandResponse.url &&
      commandResponse.status === "inProgress"
    ) {
      console.log(`Follow-up URL detected: ${commandResponse.url}`);
      const updatedUrl = commandResponse.url;

      let followUpResponse = null;
      let attempt = 0;

      while (attempt < maxRetries) {
        attempt++;
        console.log(`Attempt ${attempt}: Checking status...`);

        try {
          followUpResponse = await axiosClient.get(updatedUrl, config);

          if (
            followUpResponse.data &&
            followUpResponse.data.commandResponse.status !== "inProgress"
          ) {
            console.log("Follow-up completed:", followUpResponse.data);
            return { success: true, data: followUpResponse.data };
          }
          // console.log(`Status still inProgress:`, followUpResponse.data);
        } catch (error) {
          console.error(`Error during follow-up attempt ${attempt}:`, error);
        }

        if (attempt < maxRetries) {
          await delay(delayMs);
        }
      }

      console.log("Maximum retries reached. Status still inProgress.");
      return {
        success: false,
        error: "Request timeout: Status remained inProgress.",
      };
    } else {
      console.log("Initial command response is final.");
      return { success: true, data: response.data };
    }
  } catch (error) {
    console.error("Error sending command:", error);
    return { success: false, error: "Diagnostics request failed." };
  }
};
