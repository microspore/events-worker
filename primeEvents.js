const db = require('../lib/db');
const { PrimeTrialSignup, PrimeTrialOptout, Counters } = db.models.Events;
const { LocalDate, TimeUuid, Long } = db.models.datatypes;

let buckets = [0, 10, 50, 100, 500, 1000];

let processPrimeTrialSignupEvents = (data) => {
  
  let date = new Date(parseInt(data.timestamp.StringValue));
  let trialSignupEvent = {
    cartSize: parseInt(data.cartSize.StringValue),
    day: LocalDate.fromDate(date),
    created: new TimeUuid(date),
    userId: data.userId.StringValue,
    orderId: data.userId.StringValue
  };

  let bucket = buckets[0];

  for (let i = 1; i < buckets.length; i++) {
    if (trialSignupEvent.cartSize > buckets[i]) {
      bucket = buckets[i];
    } else {
      break;
    }
  }

  var trialSignup = new PrimeTrialSignup(trialSignupEvent);

  var queries = [];

  return Promise.all([
    // save event
    trialSignup.saveAsync(),
    
    // update Counters
    Counters.Global.updateAsync({ category: data.type.StringValue }, { counter: Long.fromInt(1) }),
    Counters.Year.updateAsync({ category: data.type.StringValue, year: date.getFullYear() }, { counter: Long.fromInt(1) }),
    Counters.Month.updateAsync({ category: data.type.StringValue, year: date.getFullYear(), month: date.getMonth() + 1 }, { counter: Long.fromInt(1) }),
    Counters.Day.updateAsync({ category: data.type.StringValue, year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }, { counter: Long.fromInt(1) }),
    Counters.Histogram.Global.updateAsync({ category: data.type.StringValue, bucket: bucket }, { count: Long.fromInt(1) }),
    Counters.Histogram.Year.updateAsync({ category: data.type.StringValue, year: date.getFullYear(), bucket: bucket }, { count: Long.fromInt(1) }),
    Counters.Histogram.Month.updateAsync({ category: data.type.StringValue, year: date.getFullYear(), month: date.getMonth() + 1, bucket: bucket }, { count: Long.fromInt(1) }),
    Counters.Histogram.Day.updateAsync({ category: data.type.StringValue, year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), bucket: bucket }, { count: Long.fromInt(1) })

  ])
    .catch(err => console.log(err));
};


let processPrimeTrialOptoutEvents = (data) => {

  let date = new Date(parseInt(data.timestamp.StringValue));
  let trialOptoutEvent = {
    day: LocalDate.fromDate(date),
    created: new TimeUuid(date),
    userId: data.userId.StringValue,
    signUp: LocalDate.fromString(data.signUp.StringValue)
  };

  var trialOptout = new PrimeTrialOptout(trialOptoutEvent);

  var queries = [];

  return Promise.all([
    // save event
    trialOptout.saveAsync(),
    // update Counters
    Counters.Global.updateAsync({ category: data.type.StringValue }, { counter: Long.fromInt(1) }),
    Counters.Year.updateAsync({ category: data.type.StringValue, year: date.getFullYear() }, { counter: Long.fromInt(1) }),
    Counters.Month.updateAsync({ category: data.type.StringValue, year: date.getFullYear(), month: date.getMonth() + 1 }, { counter: Long.fromInt(1) }),
    Counters.Day.updateAsync({ category: data.type.StringValue, year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }, { counter: Long.fromInt(1) }),
    Counters.Cohort.updateAsync({ category: data.type.StringValue, cohort: trialOptoutEvent.signUp, stage: trialOptoutEvent.day }, { counter: Long.fromInt(1) })
  ])
    .catch(err => console.log(err));
};

const eventMessageHandlers = {
  'trialsignup': processPrimeTrialSignupEvents,
  'trialoptout': processPrimeTrialOptoutEvents
};

module.exports = function(message) {

  if (eventMessageHandlers[message.type.StringValue]) {
    eventMessageHandlers[message.type.StringValue](message);
  }
};