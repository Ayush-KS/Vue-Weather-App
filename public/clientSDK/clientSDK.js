console.log("In client SDK");

let scripts = ["cobrowse-bundle.js", "broker.js"];

scripts.forEach(function (url) {
  let script = document.createElement("script");
  script.src = "./clientSDK/" + url;
  script.async = false;
  document.body.appendChild(script);
});
