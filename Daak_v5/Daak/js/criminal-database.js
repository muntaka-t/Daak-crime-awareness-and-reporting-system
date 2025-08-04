const db = firebase.firestore();

async function getAllReports() {
  const snapshot = await db.collection('reports').get();
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

function aggregateCriminals(reports) {
  const map = {};
  reports.forEach(report => {
    const { suspects = [], crimeType, id, timestamp, streetAddress, region, area } = report;
    suspects.forEach(suspect => {
      const name = suspect.name?.trim() || "Unknown";
      if (!map[name]) {
        map[name] = {
          name,
          images: [],
          reportIds: [],
          crimeTypes: new Set(),
          lastSeenLocation: "",
          lastSeenDate: null,
        };
      }
      if (suspect.imageUrl) map[name].images.push(suspect.imageUrl);
      map[name].reportIds.push(id);
      map[name].crimeTypes.add(crimeType);
      // Update last seen if this report is newer
      const reportTime = report.timestamp?.toDate ? report.timestamp.toDate() : new Date(report.timestamp);
      if (!map[name].lastSeenDate || reportTime > map[name].lastSeenDate) {
        map[name].lastSeenDate = reportTime;
        map[name].lastSeenLocation = streetAddress || region || area || "";
      }
    });
  });
  // Convert to array
  return Object.values(map).map(entry => ({
    ...entry,
    incidentCount: entry.reportIds.length,
    crimeTypes: Array.from(entry.crimeTypes),
    imageUrl: entry.images[0] || "assets/images/profile-placeholder.png"
  })).sort((a, b) => b.incidentCount - a.incidentCount);
}

function renderCriminals(criminals) {
  const cardsDiv = document.getElementById("criminalCards");
  cardsDiv.innerHTML = "";
  if (criminals.length === 0) {
    cardsDiv.innerHTML = `<div style="color:#fff8;text-align:center;">No suspects found.</div>`;
    return;
  }
  criminals.forEach(criminal => {
    const card = document.createElement("div");
    card.className = "criminal-card";
    card.innerHTML = `
      <img class="suspect-img" src="${criminal.imageUrl}" alt="suspect" style="cursor:pointer;" />
      <div class="suspect-details">
        <div class="suspect-name">${criminal.name}</div>
        <div>
          <span class="incident-count">${criminal.incidentCount} incident${criminal.incidentCount > 1 ? "s" : ""}</span>
          <span class="crime-types">${criminal.crimeTypes.join(", ")}</span>
        </div>
        <div class="last-seen"><b>Last Seen:</b> ${criminal.lastSeenLocation || "Unknown"}<br>
        <b>Date:</b> ${criminal.lastSeenDate ? criminal.lastSeenDate.toLocaleString() : "Unknown"}</div>
      </div>
      <button class="view-reports-btn">View Reports</button>
    `;
    // Add enlarge image on click
    const img = card.querySelector('.suspect-img');
    img.onclick = () => showEnlargedSuspectImg(criminal);

    // Modal for incidents
    card.querySelector(".view-reports-btn").onclick = () => showReportsModal(criminal);
    cardsDiv.appendChild(card);
  });
}

function showReportsModal(criminal) {
  const modal = document.createElement("div");
  modal.className = "reports-modal";
  modal.innerHTML = `
    <div class="reports-modal-content">
      <button class="close-modal-btn" onclick="this.closest('.reports-modal').remove()">&times;</button>
      <h3 style="margin-top:0;">Reports for ${criminal.name}</h3>
      <div id="reportsListModal" style="margin-top:1.2rem;">
        Loading reports...
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  // Fetch and display reports for this suspect
  Promise.all(
    criminal.reportIds.map(id => db.collection("reports").doc(id).get())
  ).then(snapshots => {
    const reports = snapshots.map(snap => ({ ...snap.data(), id: snap.id }));
    const list = reports.map(rep => `
      <div style="border-bottom:1px solid #ddd;padding:0.7rem 0;">
        <div><b>Crime:</b> ${rep.crimeType}</div>
        <div><b>Description:</b> ${rep.description || "No description"}</div>
        <div><b>Location:</b> ${rep.streetAddress || rep.region || rep.area || "Unknown"}</div>
        <div><b>Time:</b> ${rep.timestamp?.toDate ? rep.timestamp.toDate().toLocaleString() : new Date(rep.timestamp).toLocaleString()}</div>
        <div><b>Reporter:</b> ${rep.isAnonymous ? "Anonymous" : rep.reporterName || "Unknown"}</div>
        ${rep.mediaUrl ? `<div><a href="${rep.mediaUrl}" target="_blank">View Media</a></div>` : ""}
      </div>
    `).join("");
    modal.querySelector("#reportsListModal").innerHTML = list || `<div>No linked reports.</div>`;
  });
}

// Search logic
function setupSearch(criminals) {
  const searchInput = document.getElementById("searchInput");
  searchInput.oninput = () => {
    const val = searchInput.value.trim().toLowerCase();
    renderCriminals(criminals.filter(c =>
      c.name.toLowerCase().includes(val) ||
      c.crimeTypes.join(" ").toLowerCase().includes(val) ||
      (c.lastSeenLocation || "").toLowerCase().includes(val)
    ));
  };
}

// Main run
getAllReports().then(reports => {
  const criminals = aggregateCriminals(reports);
  renderCriminals(criminals);
  setupSearch(criminals);
});

function showEnlargedSuspectImg(criminal) {
  const modal = document.createElement("div");
  modal.className = "suspect-img-modal";
  modal.innerHTML = `
    <button class="close-modal-btn" onclick="this.closest('.suspect-img-modal').remove()">&times;</button>
    <img src="${criminal.imageUrl}" alt="${criminal.name}" />
  `;
  // Close modal on outside click
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  document.body.appendChild(modal);
}
