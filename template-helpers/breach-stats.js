"use strict";

const AppConstants = require("../app-constants");
const { resultsSummary } = require("../scan-results");
const { localize } = require("./breach-detail");


function getBreachStats(args) {
  const verifiedEmails = args.data.root.verifiedEmails;
  const locales = args.data.root.req.supportedLocales;

  const userBreachStats = {
    breachStats: resultsSummary(verifiedEmails),
    progressBar: "",
    progressIntro: "",
  };

  const breachStatBundle = userBreachStats.breachStats;
  const totalEmailsStat = breachStatBundle.monitoredEmails;
  // Format "00 emails being monitored" callout
  totalEmailsStat.subhead = localize(locales, "email-addresses-being-monitored", { emails: verifiedEmails.length });
  totalEmailsStat.displayCount = breachStatBundle.monitoredEmails.count;

  const breachesStat = breachStatBundle.numBreaches;
  const passwordStat = breachStatBundle.passwords;

  if (breachesStat.numResolved > 0) {
    // If a user has resolved at least one breach:
    // Change the password stat to show the number of password-exposing unresolved breaches.
    const remainingExposedPasswords = passwordStat.count - passwordStat.numResolved;
    passwordStat.subhead = localize(locales, "unresolved-passwords-exposed", { passwords: remainingExposedPasswords });
    passwordStat.displayCount = remainingExposedPasswords;

    // Change the total number of breaches callout to show the total number of resolved breaches
    breachesStat.subhead = localize(locales, "known-data-breaches-resolved", { breaches: breachesStat.numResolved });
    breachesStat.displayCount = breachesStat.numResolved;
  } else {

    passwordStat.subhead = localize(locales, "passwords-exposed", { passwords: passwordStat.count });
    passwordStat.displayCount = passwordStat.count;

    breachesStat.subhead = localize(locales, "known-data-breaches-exposed", { breaches: breachesStat.count });
    breachesStat.displayCount = breachesStat.count;
  }

  // add progress bar strings
  if (AppConstants.BREACH_RESOLUTION_ENABLED === "1") {
    userBreachStats.progressBar = makeProgressBar(breachesStat, locales);
  }
  return args.fn(userBreachStats);
}

function formatProgressMessage(message) {
  return message.replace("<span>", "<span class='demi'>");
}

function getProgressMessage(locales, percentBreachesResolved) {
  if (percentBreachesResolved <= 25) {
    return formatProgressMessage(localize(locales, "progress-message-1"));
  }
  if (percentBreachesResolved <= 50) {
    return formatProgressMessage(localize(locales, "progress-message-2"));
  }
  if (percentBreachesResolved <= 75) {
    return formatProgressMessage(localize(locales, "progress-message-3"));
  }
  return formatProgressMessage(localize(locales, "progress-message-4"));
}

function makeProgressBar(userBreachTotals, locales) {
  const numResolvedBreaches = userBreachTotals.numResolved;
  const numTotalBreaches = userBreachTotals.count;
  const percentBreachesResolved = Math.floor(numResolvedBreaches / numTotalBreaches * 100);

  if (percentBreachesResolved === 0) {
    return {
      subhead: localize(locales, "progress-intro-subhead"),
      progressMessage: localize(locales, "progress-intro-message"),
    };
  }
  if (percentBreachesResolved === 100) {
    return {
      subhead: localize(locales, "progress-complete"),
      progressMessage: formatProgressMessage(localize(locales, "progress-complete-message")),
    };
  }

  return {
    progressStatus: localize(locales, "progress-status", {
      "numResolvedBreaches": numResolvedBreaches,
      "numTotalBreaches": numTotalBreaches,
    }),
    percentComplete: localize(locales, "progress-percent-complete", { "percentComplete": percentBreachesResolved}),
    progressMessage: getProgressMessage(locales, percentBreachesResolved),
    percentBreachesResolved: percentBreachesResolved,
  };
}

module.exports = {
  getBreachStats,
};
