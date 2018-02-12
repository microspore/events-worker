const db = require('../lib/db');
const { OrdersNewOrder, Counters } = db.models.Events;
const { LocalDate, TimeUuid, Long } = db.models.datatypes;

let buckets = [0, 10, 50, 100, 500, 1000];

let processOrdersNewOrderEvents = (data) => {

  let processOrderStart = Date.now();

  let date = new Date(parseInt(data.timestamp.StringValue));
  let newOrderEvent = {
    amount: parseInt(data.amount.StringValue),
    day: LocalDate.fromDate(date),
    created: new TimeUuid(date),
    userId: data.userId.StringValue,
    orderId: data.orderId.StringValue
  };

  var newOrder = new OrdersNewOrder(newOrderEvent);


  let bucket = buckets[0];

  for (let i = 1; i < buckets.length; i++) {
    if (newOrderEvent.amount > buckets[i]) {
      bucket = buckets[i];
    } else {
      break;
    }
  }

  var queries = [];

  let saveOrderStart = Date.now();

  return Promise.all([
    // save event
    newOrder.saveAsync(),
  
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

module.exports = function (message) {
  return processOrdersNewOrderEvents(message);
};