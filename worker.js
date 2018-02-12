import EventQueue from './queue';
import processOrderEvents from './ordersEvents';
import processPrimeEvents from './primeEvents';

const queue = new EventQueue();

const eventMessageHandlers = {
  orders: processOrderEvents,
  prime: processPrimeEvents
};

let showProgress = false;
if (process.argv.length > 2) {
  if (process.argv[2] === '-p') {
    showProgress = true;
  }
}

/* Terminal Spinner */

let Progress = function() {
  this.index = 0;
  this.spinner = ['\\', '|', '/', '-', '\\', '|', '/', '-'];
  this.messageCount = 0;
};

Progress.prototype.tick = function() {
  this.messageCount++;

  if (this.messageCount % 10 === 0) {
    this.index = (this.index + 1) % this.spinner.length;
    let string = `${this.spinner[this.index]} ${this.messageCount} messages received`;
  
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(string);
  }
};

let progress = new Progress();

/* Handle Queue */

queue.on('data', (msg) => {

  if (showProgress) {
    progress.tick();
  }

  if (eventMessageHandlers[msg.service.StringValue]) {
    return eventMessageHandlers[msg.service.StringValue](msg);
  }
});

