// Internal pub/sub bus with MQTT-style topics, delivered to browsers over Server-Sent Events.
//
// Topics:  user/<userId>        – personal notifications (task assigned, ...)
//          scope/<ws>/<project> – chat messages & live board updates for a scope
//
// Publishers call publish(topic, event, data). Each connected SSE client subscribes to its own
// user topic; scope topics are resolved to a user audience at publish time so membership
// changes take effect immediately. To scale horizontally, replace the EventEmitter with
// Redis pub/sub or an MQTT broker (e.g. Aedes/Mosquitto) – the publish() interface stays the same.
const { EventEmitter } = require('events');
const { audienceForScope } = require('./access');

const bus = new EventEmitter();
bus.setMaxListeners(0);

function subscribeClient(userId, res) {
  const topic = `user/${userId}`;
  const listener = ({ event, data }) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  bus.on(topic, listener);
  return () => bus.off(topic, listener);
}

function publishToUsers(userIds, event, data) {
  for (const id of new Set(userIds.map(String))) bus.emit(`user/${id}`, { event, data });
}

async function publishToScope(workspaceId, projectId, event, data) {
  const audience = await audienceForScope(workspaceId, projectId);
  publishToUsers(audience, event, data);
}

module.exports = { subscribeClient, publishToUsers, publishToScope };
