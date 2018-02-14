const db = require('./events-db/');
const { OrdersNewOrder, Counters } = db.models.Events;
const { LocalDate, TimeUuid, Long } = db.models.datatypes;

var statsD = require('node-statsd');

var stats = new statsD({
  host: 'statsd.hostedgraphite.com',
  port: 8125,
  prefix: '9cc6ccfc-211b-410b-8442-df686a1abe6d'
});

let workerId = '';
if (process.env.TASK_SLOT) {
  workerId = `.worker_${process.env.TASK_SLOT}`;
}

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

  stats.increment('.backend.worker.counters.newOrderDbEntries');  

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