const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");

const GEMINI_API_KEY = "AIzaSyDqIqkK7JUlKO3e0BqgO5oR-blLNO8Xhs8"; // Demo only
const db = firebase.firestore(); // Make sure firebase.js is included

function addMessage(text, isBot = false, timestamp = null) {
  const msg = document.createElement("div");
  msg.className = isBot ? "bot-message" : "user-message";
  msg.textContent = text;
  if (timestamp) {
    const ts = document.createElement("div");
    ts.style.fontSize = "0.8em";
    ts.style.opacity = "0.7";
    ts.style.marginTop = "0.2em";
    ts.textContent = timestamp;
    msg.appendChild(ts);
  }
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Typing indicator helpers
function showTyping() {
  const typingDiv = document.createElement("div");
  typingDiv.className = "bot-message typing-indicator";
  typingDiv.textContent = "DaakAI is typing...";
  typingDiv.id = "typingIndicator";
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function removeTyping() {
  const typing = document.getElementById("typingIndicator");
  if (typing) typing.remove();
}

async function sendToGemini(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `
You are DaakAI, a helpful, trustworthy, and concise safety assistant for Bangladeshi users. ONLY respond to safety, emergency, or crime queries, or to questions about how to use the Daak safety app.

If the user asks for army help, emergency contact, or mentions any of these Dhaka areas, reply with the specific army contacts listed below as well as relevant advice. Be short but clear.

Army Contact Numbers by Area (Only share the relevant numbers):

1. Lalbagh, Dhanmondi, Mohammadpur, Shaymoli, Agargaon, Mohakhali, Tejgaon, Elephant Road, Katabon:
   01769051838, 01769051839

2. Gulshan, Baridhara, Banani, Bashundhara, Badda, Rampura, Shahjahanpur, Uttarkhan, Dakshinkhan, Banasree:
   01769013102, 01769053154

3. Mirpur-1 to Mirpur-14, Khilkhet, Uttara, Hazrat Shahjalal Int. Airport:
   01769024210, 01769024211

4. Motijheel, Segunbagicha, Kakrail, Shantinagar, Eskaton, Rajarbagh, Paltan, Gulistan, Old Dhaka:
   01769092428, 01769095419

Never share all contacts together—only those relevant to the user’s query or mentioned area.

If the user asks how to use the Daak app, how to report a crime, how to use features (panic button, emergency contacts, heatmaps, etc.), give step-by-step clear instructions.
- For reporting a crime: Guide the user to tap 'Report a Crime', fill in details, add evidence if possible, choose anonymity if they wish, and submit.
- For panic button: Explain how to access and use it for emergencies.
- For adding emergency contacts: Show where to add/manage them in the app.
- For viewing crime heatmaps: Guide how to open the heatmap feature.

Never answer questions outside of safety or app usage topics.

User: ${prompt}
`

          }]
        }]
      }),
    }
  );
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ No response.";
}

async function fetchReportsFromFirestore(locationKeyword, filterToday = false) {
  const snapshot = await db.collection("reports").get();
  const today = new Date();
  const matched = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const fields = [data.region, data.area, data.streetAddress];
    const timestamp = data.timestamp?.toDate?.();

    // Filter by today if requested
    if (filterToday && timestamp) {
      const reportDate = new Date(timestamp);
      if (
        reportDate.getDate() !== today.getDate() ||
        reportDate.getMonth() !== today.getMonth() ||
        reportDate.getFullYear() !== today.getFullYear()
      ) {
        return; // Skip if not today
      }
    }

    const isMatch = fields.some(field =>
      field?.toLowerCase().normalize("NFKD").includes(locationKeyword)
    );

    if (isMatch) {
      matched.push({
        type: data.crimeType,
        desc: data.description,
        time: timestamp?.toLocaleString() || "",
        location: data.region || "Unknown"
      });
    }
  });

  return matched;
}

// Map keywords to hardcoded answers
const appFaqAnswers = [
  {
    keywords: ["how to report", "report a crime", "report crime", "reporting", "submit report"],
    answer: `To report a crime in Daak:
1. Tap the ‘Report a Crime’ button on the home screen.
2. Fill in the details: select the crime type, describe what happened, add the location, and attach any evidence (photos, audio, video) if possible.
3. Choose to submit anonymously or with your identity.
4. Tap ‘Submit’. Your report will be sent to authorities and help others stay safe.`
  },
  {
    keywords: ["panic button", "distress signal", "emergency button", "emergency alert", "how to panic"],
    answer: `If you’re in danger, tap the ‘Distress Signal’ button from the home screen.
- This will open the Panic Button page.
- Hold down the large red button for a few seconds to trigger an emergency alert.
- Your location will be sent to your emergency contacts and nearby users.
- This helps get help quickly in urgent situations.`
  },
  {
    keywords: ["emergency contact", "add contact", "save contact", "manage contact"],
    answer: `To add or update emergency contacts in Daak:
1. Tap the ‘Emergency Contacts’ button on the home screen.
2. Enter up to three trusted contacts’ phone numbers or emails.
3. Tap ‘Save’. You can edit or replace them anytime.
- In an emergency, these contacts will be notified automatically.`
  },
  {
    keywords: ["heatmap", "crime map", "hotspot", "see crime", "crime-prone", "crime area"],
    answer: `To view real-time crime heatmaps:
1. Tap the ‘Crime Heatmap’ option from the menu or home screen.
2. The map will show recent crime reports by location, using colors to show where incidents are frequent.
3. Tap on any hotspot to view report details and safety tips for that area.`
  },
  {
    keywords: ["anonymous", "identity safe", "report anonymously", "my identity"],
    answer: `Yes, Daak lets you report crimes anonymously.
- When submitting a report, just select the ‘Anonymous’ option.
- Your identity will not be shared with anyone.
- Only use your name if you’re comfortable and want to help further.`
  },
  {
    keywords: ["safety tip", "advice", "how to stay safe", "crime prevention", "what to do", "get help", "safety advice"],
    answer: `Yes! You can ask me anything about personal safety, crime prevention, or how to use Daak app features.
For example: “What should I do in a robbery?”, “Any safety tips for walking at night?”, or “How to report harassment?”
I’ll do my best to help you quickly and clearly.`
  }
];

// Helper to find a relevant answer
function matchAppFaq(question) {
  const q = question.toLowerCase();
  for (let faq of appFaqAnswers) {
    if (faq.keywords.some(k => q.includes(k))) {
      return faq.answer;
    }
  }
  return null;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userMsg = chatInput.value.trim();
  if (!userMsg) return;

  addMessage(userMsg, false, new Date().toLocaleTimeString());
  chatInput.value = "";

  // 1. Try to answer with app FAQ if possible
  const faqAnswer = matchAppFaq(userMsg);
  if (faqAnswer) {
    addMessage(faqAnswer, true, new Date().toLocaleTimeString());
    return;
  }

  // 2. ...rest of your code (search for reports or use Gemini as fallback)
  showTyping();

  // Enhanced flexible pattern matching
  const match = userMsg.toLowerCase().match(/\b(report|reports|crime|crimes|incident|incidents?)\b.*\b(in|at)?\s*([a-z\s]+)/i);

  if (match) {
    let locationKeyword = match[3].trim().toLowerCase();
    const filterToday = /\btoday\b/i.test(userMsg);

    // Remove confusing words inside the location phrase
    locationKeyword = locationKeyword.replace(/\b(today|recently|this week|yesterday)\b/g, "").trim();

    try {
      const reports = await fetchReportsFromFirestore(locationKeyword, filterToday);
      removeTyping();

      if (reports.length > 0) {
        const summary = reports.map((r, i) =>
          `${i + 1}. ${r.type} – ${r.desc} (${r.time})`
        ).join("\n\n");
        addMessage(`📍 Found ${reports.length} report(s) in ${locationKeyword}:\n\n${summary}`, true, new Date().toLocaleTimeString());
      } else {
        addMessage(`No reports found in ${locationKeyword}${filterToday ? " today" : ""}.`, true, new Date().toLocaleTimeString());
      }
    } catch (err) {
      removeTyping();
      addMessage("⚠️ Sorry, I couldn't fetch reports. Please try again.", true, new Date().toLocaleTimeString());
    }
    return;
  }

  // Fallback to Gemini for safety-related questions
  try {
    const botReply = await sendToGemini(userMsg);
    removeTyping();
    addMessage(botReply, true, new Date().toLocaleTimeString());
  } catch (err) {
    removeTyping();
    addMessage("⚠️ Sorry, I couldn't connect to DaakAI. Please try again.", true, new Date().toLocaleTimeString());
  }
});
