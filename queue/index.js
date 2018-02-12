const AWS = require('aws-sdk');
const Promise = require('bluebird');
AWS.config.update({ region: 'us-east-2' });
var sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
var stats = require('../../lib/statsD'); 

// stats
var pollingStart = 0;
var processBatchStart = 0;
var processBatchTimer = 0;
var saveMessagesStart = 0;
var deleteMessagesStart = 0;

sqs.getQueueUrlAsync = Promise.promisify(sqs.getQueueUrl);
sqs.receiveMessageAsync = Promise.promisify(sqs.receiveMessage);
sqs.deleteMessageAsync = Promise.promisify(sqs.deleteMessage);
sqs.deleteMessageBatchAsync = Promise.promisify(sqs.deleteMessageBatch);

var params = {
  QueueName: 'events'
};

var EventQueue = function () {

  this.handlers = {};
  this.queueUrl = null;
  this.duplicates = {};

  let params = {
    QueueName: 'events'
  };

  sqs.getQueueUrlAsync(params)

    .then((data) => {
      this.queueUrl = data.QueueUrl;

      if (this.handlers['connect']) {
        this.handlers['connect'].forEach(handler => handler());
      }

      if (this.handlers['data']) {
        this.pollMessages();
      }
    });
};

EventQueue.prototype.pollMessages = async function () {

  pollingStart = Date.now();
  // console.log('waiting', Date.now());

    
  params = {
    AttributeNames: [
      'SentTimestamp'
    ],
    MaxNumberOfMessages: 10,
    MessageAttributeNames: [
      'All'
    ],
    QueueUrl: this.queueUrl,
    VisibilityTimeout: 200,
    WaitTimeSeconds: 20
  };

  try {

    let data = await sqs.receiveMessageAsync(params)
    
    if (data.Messages) {

      stats.timing('.backend.worker.timers.waiting', Date.now() - pollingStart);  
      
      processBatchStart = Date.now();
      // console.log('Process Batch', Date.now());
      let done = [];
      
      // loop through all messages received
      // console.log('1', Date.now());
      let tasks = data.Messages.map((msg, index) => {

        stats.increment('.backend.worker.counters.messages');  
        // check if message has already been received
        if (!this.duplicates[msg.MessageId]) {
          this.duplicates[msg.MessageId] = true;

          // add processed messages to list for deletion from queue
          done.push({ Id: `${index}`, ReceiptHandle: msg.ReceiptHandle });

          // call subscriber callback with the message data
          return Promise.all(
            this.handlers['data'].map(handler => handler(msg.MessageAttributes))
          );
        }
      });

      // console.log('save', Date.now());
      stats.timing('.backend.worker.timers.processBatch', Date.now() - processBatchStart);
      saveMessagesStart = Date.now();

      await Promise.all(tasks);

      // console.log('delete', Date.now());
      stats.timing('.backend.worker.timers.saveMessages', Date.now() - saveMessagesStart);
        
      var params = {
        Entries: done,
        QueueUrl: this.queueUrl /* required */
      };

      deleteMessagesStart = Date.now();  
    
      await sqs.deleteMessageBatchAsync(params);
     
      // reset long polling
      // console.log('finished', Date.now());
      stats.timing('.backend.worker.timers.deleteMessages', Date.now() - deleteMessagesStart);  

      this.pollMessages();
    } else {

      this.pollMessages();
    }
    
  } catch(err) {
    console.log(err);
  }
};

EventQueue.prototype.on = function (event, callback) {

  if (event === 'connect') {

    if (this.queueUrl) {
      callback();
    } else {
      if (!this.handlers[event]) {
        this.handlers[event] = [];
      }
      this.handlers[event].push(callback);
    }
  }

  if (event === 'data') {

    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(callback);

    if (this.queueUrl) {
      this.pollMessages();
    }
  }
};

module.exports = EventQueue;