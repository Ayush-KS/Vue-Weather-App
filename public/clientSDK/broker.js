const clientId = Math.floor(Math.random(0, 1) * 10000000).toString();

const testCredentials = {
  hostname: "p7262892.en.emqx.cloud",
  port: 8084,
  token: "stupefy",
};

const credentials = {
  hostname: "qa4-live-chat-mqtt.sprinklr.com",
  port: 443,
  token:
    "eyJhbGciOiJSUzI1NiJ9.eyJhbm9ueW1vdXNJZCI6IlBfNjAwMDAwMDAxIiwic3ViIjoiQWNjZXNzIFRva2VuIEdlbmVyYXRlZCBCeSBTcHJpbmtsciIsImNsaWVudElkIjoyLCJpc3MiOiJTUFJJTktMUiIsInR5cCI6IkpXVCIsInVzZXJJZCI6NjAwMDAwMDAxLCJhdWQiOlsiU1BSSU5LTFIiXSwibmJmIjoxNjE3MDc5MzA4LCJtcXR0QWNsIjoie1wic1wiOltcImluYm94XC9QXzYwMDAwMDAwMVwiXSxcInNwXCI6W1wiLiotNDAwMDAyLS4qXCIsXCIuKi00MDAwMDIkXCIsXCIuKi00MDAwMDJcLy4qXCJdfSIsImNoYXRVc2VySWQiOiJQXzYwMDAwMDAwMSIsImNoYXRVc2VyVHlwZSI6IlBBUlRORVIiLCJzY29wZSI6WyJSRUFEIiwiV1JJVEUiXSwicGFydG5lcklkIjo0MDAwMDIsImF1dGhUeXBlIjoiU1BSX0tFWV9QQVNTX0xPR0lOIiwidG9rZW5UeXBlIjoiQUNDRVNTIiwiZXhwIjoxNjE3Njg1MzA4LCJpYXQiOjE2MTcwODA1MDgsImp0aSI6IjY0OWUwMGRlLTM0MzAtNDdjMy05MjQ0LWQwMTU4M2Q4MTI0NiJ9.e6Xxn8oApLAbo2NYkiKvTtAmDMVbqk3eDjvGYNUGdNpBsmnhGhPCnlxXN0pvkJUFIYMI1x6RiqHSiRN1oS-Tq3PUhcQOK8-5ytB5RbX7F9UYMLjFpJgLoZ5RsJfAUzPAeeF0zpgu_obv9EgMTtxsPCxtg8TCbLdCIJlZVuV3qh1zAUJh9pr2TUpVBArQvNWCqqs_aHUxwctuT4NreIFUkSpzNLfCD6udv_D7PSvw3BdmuCD7x6MJTRawbR_tmwYFV0DP-r5woFiuIE47E5iQjgf1MuwrD5qVgsHbNdPoAKK_uU8Vu8LwkNDkhZkYXZlfLQelGN0UgMrtSUAJ1KuZgQ",
};

// Create a client instance
client = new Paho.MQTT.Client(credentials.hostname, credentials.port, clientId);

// set callback handlers
client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived;

// connect the client
client.connect({
  onSuccess: onConnect,
  useSSL: true,
  userName: credentials.token,
  password: credentials.token,
  timeout: 1,
  onFailure: (e) => {
    console.log("Connection Failed!", e);
  },
});

// called when the client connects
function onConnect() {
  addStartButton();
  // initiateCoBrowse();
}

// called when the client loses its connection
function onConnectionLost(responseObject) {
  if (responseObject.errorCode !== 0) {
    console.log("onConnectionLost:" + responseObject.errorMessage);
  }
}

// called when a message arrives
function onMessageArrived(message) {
  console.log("onMessageArrived:" + message.payloadString);
}
