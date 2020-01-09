"use strict";

const AppConstants = require("./../app-constants");

const { LocaleUtils } = require("./../locale-utils");
const { prettyDate } = require("./hbs-helpers");
const { getAllPriorityDataClasses, getAllGenericRecommendations, getFourthPasswordRecommendation } = require("./recommendations");


function localize(locales, stringId, args) {
  return LocaleUtils.fluentFormat(locales, stringId, args);
}


function getBreachTitle(args) {
  return args.data.root.featuredBreach.Title;
}


function getVars(args) {
  const locales = args.data.root.req.supportedLocales;
  const breach = args.data.root.featuredBreach;
  const changePWLink = args.data.root.changePWLink;
  const isUserBrowserFirefox = (/Firefox/i.test(args.data.root.req.headers["user-agent"]));
  return { locales, breach, changePWLink, isUserBrowserFirefox };
}


function getBreachCategory(breach) {
  if (["Exactis", "Apollo", "YouveBeenScraped", "ElasticsearchSalesLeads", "Estonia", "MasterDeeds", "PDL"].includes(breach.Name)) {
    return "data-aggregator-breach";
  }
  if (breach.IsSensitive) {
    return "sensitive-breach";
  }
  if (breach.Domain !== "") {
    return "website-breach";
  }
  return "data-aggregator-breach";
}


function getSortedDataClasses(locales, breach, isUserBrowserFirefox=false, isUserLocaleEnUs=false, changePWLink=false) {
  const priorityDataClasses = getAllPriorityDataClasses(isUserBrowserFirefox, isUserLocaleEnUs, changePWLink);

  const sortedDataClasses = {
    priority: [],
    lowerPriority: [],
  };

  const dataClasses = breach.DataClasses;
  dataClasses.forEach(dataClass => {
    const dataType = localize(locales, dataClass);
    if (priorityDataClasses[dataClass]) {
      priorityDataClasses[dataClass]["dataType"] = dataType;
      sortedDataClasses.priority.push(priorityDataClasses[dataClass]);
      return;
    }
    sortedDataClasses.lowerPriority.push(dataType);
  });
  sortedDataClasses.priority.sort((a,b) => { return b.weight - a.weight; });
  return sortedDataClasses;
}

function compareBreachDates(breach) {
  const breachDate = new Date(breach.BreachDate);
  const addedDate = new Date(breach.AddedDate);
  const timeDiff = Math.abs(breachDate.getTime() - addedDate.getTime());
  const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  if (dayDiff > 90) {
    return true;
  }
  return false;
}

function getGenericFillerRecs(locales, numberOfRecsNeeded) {
  let genericRecommendations = getAllGenericRecommendations();

  genericRecommendations = genericRecommendations
    .slice(0, numberOfRecsNeeded); // Slice array down to number of needed recommendations

  genericRecommendations.forEach(rec => {
    for (const pieceOfCopy in rec.recommendationCopy) {
      rec.recommendationCopy[pieceOfCopy] = localize(locales, rec.recommendationCopy[pieceOfCopy]);
    }
  });
  return genericRecommendations;
}

function getBreachDetail(args) {
  const { locales, breach, changePWLink, isUserBrowserFirefox } = getVars(args);
  const { sortedDataClasses, recommendations } = getSortedDataClassesAndRecs(locales, breach, isUserBrowserFirefox, changePWLink);
  const breachCategory = getBreachCategory(breach);
  const breachExposedPasswords = breach.DataClasses.includes("passwords");

  const breachDetail = {
    breach: breach,
    overview: {
      headline: localize(locales, "breach-overview-title"),
      copy: localize(locales, "breach-overview-new", {
        addedDate: `<span class='bold'>${prettyDate(breach.AddedDate, locales)}</span>`,
        breachDate: `<span class='bold'>${prettyDate(breach.BreachDate, locales)}</span>`,
        breachTitle: breach.Title,
      }),
    },

    categoryId: breachCategory,
    category: localize(locales, breachCategory),
    changePWLink: changePWLink,

    dataClasses: {
      headline: localize(locales, "what-data"),
      dataTypes: sortedDataClasses,
    },

    recommendations: {
      headline: breachExposedPasswords ? localize(locales, "rec-section-headline") : localize(locales, "rec-section-headline-no-pw"),
      copy: breachExposedPasswords ? localize(locales, "rec-section-subhead") : localize(locales, "rec-section-subhead-no-pw"),
      recommendationsList: recommendations,
    },
  };

  // Add correct "What is a ... breach" copy.
  switch (breachDetail.categoryId) {
    case "data-aggregator-breach":
      breachDetail.whatIsThisBreach = {
        headline: localize(locales, "what-is-data-agg"),
        copy: localize(locales, "what-is-data-agg-blurb"),
      };
      break;
    case "sensitive-breach":
      breachDetail.whatIsThisBreach = {
        headline: localize(locales, "sensitive-sites"),
        copy: localize(locales, "sensitive-sites-copy"),
      };
      break;
    default:
      breachDetail.whatIsThisBreach = {
        headline: localize(locales, "what-is-a-website-breach"),
        copy: localize(locales, "website-breach-blurb"),
      };
  }

  // Compare the breach date to the breach added date
  // and show the "Why did it take so long to tell me about this breach?"
  // message if necessary.
  if (compareBreachDates(breach)) {
    breachDetail.delayedReporting = {
      headline: localize(locales, "delayed-reporting-headline"),
      copy: localize(locales, "delayed-reporting-copy"),
    };
  }

  if (AppConstants.BREACH_RESOLUTION_ENABLED) {
    const affectedEmails = args.data.root.affectedEmailAddresses;
    const numAffectedEmails = affectedEmails.length;

    if (numAffectedEmails > 0) {
      const affectedEmailNotification = numAffectedEmails > 1 ?
        localize(locales, "resolve-top-notification-plural", { numAffectedEmails: numAffectedEmails }) :
        localize(locales, "resolve-top-notification", { affectedEmail: affectedEmails[0].affectedEmailAddress });

      breachDetail.affectedEmailNotification = formatNotificationLink(affectedEmailNotification);
    }
  }
  return args.fn(breachDetail);
}

function formatNotificationLink(message) {
  return message.replace("<a>", "<a href='");
}


function getSortedDataClassesAndRecs(locales, breach, isUserBrowserFirefox=false, changePWLink=false) {
  const isUserLocaleEnUs = (locales[0] === "en");
  const sortedDataClasses = getSortedDataClasses(locales, breach, isUserBrowserFirefox, isUserLocaleEnUs, changePWLink);

  let recommendations = [];

  // Check each priority data class for a recommendation
  // and push localized recommendations into new array.
  sortedDataClasses.priority.forEach(dataClass => {
    if (dataClass.recommendations) {
      const recs = dataClass.recommendations;
      recs.forEach(rec => {
        for (const pieceOfCopy in rec.recommendationCopy) {
          rec.recommendationCopy[pieceOfCopy] = localize(locales, rec.recommendationCopy[pieceOfCopy]);
        }
        recommendations.push(rec);
      });
    }
  });

  // If the breach exposed passwords, push the fourth password recommendation
  // to the end of the recommendations list regardless of list length.
  if (breach.DataClasses.includes("passwords")) {
    recommendations.push(getFourthPasswordRecommendation(locales));
  }

  // If there are fewer than four recommendations,
  // backfill with generic recommendations.
  const minimumNumberOfRecs = 4;
  if (recommendations.length < minimumNumberOfRecs) {
    const numberOfRecsNeeded = minimumNumberOfRecs - recommendations.length;
    const genericRecs = getGenericFillerRecs(locales, numberOfRecsNeeded);
    recommendations = recommendations.concat(genericRecs);
  }
  return {sortedDataClasses, recommendations};
}

module.exports = {
  getBreachDetail,
  getBreachCategory,
  getSortedDataClasses,
  getBreachTitle,
  localize,
};
