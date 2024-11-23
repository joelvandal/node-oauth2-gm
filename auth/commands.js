export const commands = {
  cancelAlert: {
    url: "commands/cancelAlert", // Cancel a vehicle alert (honk horns/flash lights).
  },
  getHotspotInfo: {
    url: "hotspot/commands/getInfo", // Retrieves the WiFi Hotspot info.
  },
  lockDoor: {
    url: "commands/lockDoor", // Locks the doors.
    postData: {
      delay: 0,
    },
  },
  unlockDoor: {
    url: "commands/unlockDoor", // Unlocks the doors.
    postData: {
      delay: 0,
    },
  },
  alert: {
    url: "commands/alert", // Triggers a vehicle alert (honk horns/flash lights).
  },
  start: {
    url: "commands/start", // Remotely starts the vehicle.
    postData: {
      cabinTemperature: false,
      delay: 0,
    },
  },
  cancelStart: {
    url: "commands/cancelStart", // Cancels previous remote start command.
  },
  diagnostics: {
    url: "commands/diagnostics", // Retrieves diagnostic vehicle data.
    postData: {
      diagnosticsRequest: {
        diagnosticItem: [
          "TARGET CHARGE LEVEL SETTINGS",
          "LAST TRIP FUEL ECONOMY",
          "PREF CHARGING TIMES SETTING",
          "ENERGY EFFICIENCY",
          "LIFETIME ENERGY USED",
          "ESTIMATED CABIN TEMPERATURE",
          "EV BATTERY LEVEL",
          "HV BATTERY CHARGE COMPLETE TIME",
          "HIGH VOLTAGE BATTERY PRECONDITIONING STATUS",
          "EV PLUG VOLTAGE",
          "HOTSPOT CONFIG",
          "ODOMETER",
          "HOTSPOT STATUS",
          "LIFETIME EV ODOMETER",
          "CHARGER POWER LEVEL",
          "CABIN PRECONDITIONING TEMP CUSTOM SETTING",
          "EV PLUG STATE",
          "EV CHARGE STATE",
          "TIRE PRESSURE",
          "LOCATION BASE CHARGE SETTING",
          "LAST TRIP DISTANCE",
          "CABIN PRECONDITIONING REQUEST",
          "GET COMMUTE SCHEDULE",
          "GET CHARGE MODE",
          "PREF CHARGING TIMES PLAN",
          "VEHICLE RANGE",
          "HYBRID BATTERY MINIMUM TEMPERATURE",
          "EV ESTIMATED CHARGE END",
          "AMBIENT AIR TEMPERATURE",
          "INTERM VOLT BATT VOLT",
          "EV SCHEDULED CHARGE START",
          "ENGINE COOLANT TEMP",
          "ENGINE RPM",
          "OIL LIFE",
          "LIFETIME FUEL ECON",
          "FUEL TANK INFO",
          "ENGINE AIR FILTER MONITOR STATUS",
          "LIFETIME FUEL USED",
        ],
      },
    },
  },
  sendTBTRoute: {
    url: "commands/sendTBTRoute", // Calculates route and initiates download of turn-by-turn directions to the vehicle.
  },
  location: {
    url: "commands/location", // Retrieves the vehicle's current location.
  },
  chargeOverride: {
    url: "commands/chargeOverride", // Sends Charge Override.
  },
  getChargingProfile: {
    url: "commands/getChargingProfile", // Gets the Charge Mode.
  },
  setChargingProfile: {
    url: "commands/setChargingProfile", // Sets the charging profile.
    postData: {
      chargeMode: "DEFAULT_IMMEDIATE", // DEFAULT_IMMEDIATE, IMMEDIATE, DEPARTURE_BASED, RATE_BASED, PHEV_AFTER_MIDNIGHT
      rateType: "OFFPEAK", // OFFPEAK, MIDPEAK, PEAK
    },
  },
  getCommuteSchedule: {
    url: "commands/getCommuteSchedule", // Gets the commuting schedule.
  },
  setCommuteSchedule: {
    url: "commands/setCommuteSchedule", // Sets the commuting schedule.
    postData: {},
  },
  stopFastCharge: {
    url: "commands/stopFastCharge", // Stops the charge.
  },
  createTripPlan: {
    url: "commands/createTripPlan", // Creates a Trip Plan.
    postData: {},
  },
  getTripPlan: {
    url: "commands/getTripPlan", // Retrieves an existing trip plan for an electric vehicle.
  },
  getHotspotStatus: {
    url: "hotspot/commands/getStatus", // Retrieves WiFi status.
  },
  setHotspotInfo: {
    url: "hotspot/commands/setInfo", // Updates the WiFi SSID and passphrase.
    postData: {},
  },
  disableHotspot: {
    url: "hotspot/commands/disable", // Disables the WiFi Hotspot.
  },
  enableHotspot: {
    url: "hotspot/commands/enable", // Enables the WiFi Hotspot.
  },
  stopCharge: {
    url: "commands/stopCharge", // Stops the charging process.
  },
  setHvacSettings: {
    url: "commands/setHvacSettings", // Sets the HVAC Settings in the vehicle remotely.
    postData: {},
  },
  getChargerPowerLevel: {
    url: "commands/getChargerPowerLevel", // Retrieves the charger power level.
  },
  setChargerPowerLevel: {
    url: "commands/setChargerPowerLevel", // Sets the charger power level.
  },
  getRateSchedule: {
    url: "commands/getRateSchedule", // Gets the EV Rate Schedule.
  },
  setRateSchedule: {
    url: "commands/setRateSchedule", // Sets the EV Rate Schedule.
  },
  unlockTrunk: {
    url: "commands/unlockTrunk", // Unlocks the trunk.
    postData: {
      delay: 0,
    },
  },
  lockTrunk: {
    url: "commands/lockTrunk", // Locks the trunk.
    postData: {
      delay: 0,
    },
  },
  setPriorityCharging: {
    url: "commands/setPriorityCharging", // Sets priority charging.
    postData: {},
  },
  getPriorityCharging: {
    url: "commands/getPriorityCharging", // Gets priority charging.
  },
  startTrailerLightSeq: {
    url: "commands/startTrailerLightSeq", // Starts the trailer light sequence.
  },
  stopTrailerLightSeq: {
    url: "commands/stopTrailerLightSeq", // Stops the trailer light sequence.
  },
};
