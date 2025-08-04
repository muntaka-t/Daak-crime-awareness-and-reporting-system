console.log("admin.js loaded!");
// Initialize Firebase
// Your firebase.js should initialize app and export firebase/firestore/auth instances

// Elements
const navLinks = document.querySelectorAll('.nav-link');
const adminContent = document.getElementById('admin-content');
const accessDenied = document.getElementById('access-denied');
const logoutBtn = document.getElementById('logoutBtn');

let currentUser = null;
let currentOpenReportId = null; // Keep track of the open report
let allReportsData = []; // <-- Add this global for filtering

// Helper: Load section
function loadSection(section) {
    navLinks.forEach(link => link.classList.remove('active'));
    document.querySelector(`[data-section="${section}"]`).classList.add('active');

    if (section === 'dashboard') {
        renderAdminDashboard();
        return;
    }
    if (section === 'reports') {
        // --- Inserted: Render reports table ---
        renderReportsTable();
        return;
    }
    if (section === 'accounts') {
        adminContent.innerHTML = `<h2>Account Management</h2>
        <p>Edit or remove user/admin accounts here.</p>`;
    }
}

// Handle nav clicks
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        loadSection(link.getAttribute('data-section'));
    });
});

// Firebase Auth & Admin Check
firebase.auth().onAuthStateChanged(async user => {
    if (!user) {
        window.location.href = 'login.html'; // Or show login
        return;
    }
    currentUser = user;
    // --- Admin check: you must have a field in Firestore (e.g., users collection) or use custom claims ---
    const db = firebase.firestore();
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists || !userDoc.data().role || userDoc.data().role !== 'admin') {
        document.querySelector('.admin-navbar').style.display = "none";
        document.querySelector('.admin-container').style.display = "none";
        document.getElementById('access-denied').style.display = 'block';
        return;
    }
    // If admin, show dashboard
    loadSection('dashboard');
});

// Logout
logoutBtn.onclick = () => {
    firebase.auth().signOut().then(() => {
        window.location.href = 'login.html';
    });
};

// js/admin.js

// Helper: Fetch reports from Firestore
async function fetchReports() {
    const snapshot = await firebase.firestore().collection('reports').orderBy('timestamp', 'desc').get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log('Fetched reports:', data);
    return data;
}

// Render the reports table
async function renderReportsTable() {
    adminContent.innerHTML = `
        <h2>Monitor Reports</h2>
        <input type="text" id="reportSearch" placeholder="Search by crime type, reporter, or status" style="margin-bottom:10px;width:100%;">
        <div id="reportsTableWrapper"></div>
    `;
    const reports = await fetchReports();
    allReportsData = reports; // Save all reports for filtering
    displayReports(reports);

    // Attach search
    document.getElementById('reportSearch').addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        const filtered = allReportsData.filter(r =>
            (r.crimeType && r.crimeType.toLowerCase().includes(q)) ||
            (r.reporterName && r.reporterName.toLowerCase().includes(q)) ||
            (r.status && r.status.toLowerCase().includes(q))
        );
        displayReports(filtered);
    });
}

// Helper: Display reports in table
function displayReports(reports) {
    const wrapper = document.getElementById('reportsTableWrapper');
    if (!wrapper) {
        console.error("No element with id 'reportsTableWrapper' found.");
        return;
    }
    if (!reports.length) {
        wrapper.innerHTML = `<p>No reports found.</p>`;
        return;
    }
    // --- Filter controls and bulk action buttons ---
    let html = `
      <div style="margin-bottom:10px;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;">
        <div>
          <label>Crime Type<br>
            <select id="filterCrimeType" style="width:120px;">
              <option value="">All</option>
              <option value="Robbery">Robbery</option>
              <option value="Assault">Assault</option>
              <option value="Theft">Theft</option>
              <option value="Harassment">Harassment</option>
              <option value="Vandalism">Vandalism</option>
              <option value="Other">Other</option>
            </select>
          </label>
        </div>
        <div>
          <label>Status<br>
            <select id="filterStatus" style="width:120px;">
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
        </div>
        <div>
          <label>Date From<br>
            <input type="date" id="filterDateFrom">
          </label>
        </div>
        <div>
          <label>Date To<br>
            <input type="date" id="filterDateTo">
          </label>
        </div>
        <div style="margin-left:auto;">
          <button id="bulkVerifyBtn" style="background:#1d72b8;color:white;border:none;padding:0.4em 1em;border-radius:6px;margin-right:5px;">Bulk Verify</button>
          <button id="bulkDeleteBtn" style="background:#be3144;color:white;border:none;padding:0.4em 1em;border-radius:6px;">Bulk Delete</button>
        </div>
      </div>
      <table class="admin-table">
        <thead>
            <tr>
                <th><input type="checkbox" id="selectAllReports"></th>
                <th>ID</th>
                <th>Crime Type</th>
                <th>Date</th>
                <th>Reporter</th>
                <th>Status</th>
                <th>Actions</th>
            </tr>
        </thead><tbody>`;
    reports.forEach(r => {
        html += `<tr class="report-row" data-id="${r.id}">
            <td><input type="checkbox" class="report-checkbox" value="${r.id}"></td>
            <td>${r.id}</td>
            <td>${r.crimeType || ''}</td>
            <td>${r.timestamp ? new Date(r.timestamp.seconds*1000).toLocaleString() : ''}</td>
            <td>${r.reporterName || ''}</td>
            <td>${r.status || 'pending'}</td>
            <td>
                <button class="verify-btn" data-id="${r.id}">Verify</button>
                <button class="delete-btn" data-id="${r.id}">Delete</button>
            </td>
        </tr>`;
    });
    html += `</tbody></table>`;
    wrapper.innerHTML = html;

    // --- Filtering logic ---
    const filterCrimeType = document.getElementById('filterCrimeType');
    const filterStatus = document.getElementById('filterStatus');
    const filterDateFrom = document.getElementById('filterDateFrom');
    const filterDateTo = document.getElementById('filterDateTo');

    function filterAndRender() {
        let filtered = allReportsData;
        if (filterCrimeType.value) {
            filtered = filtered.filter(r => r.crimeType === filterCrimeType.value);
        }
        if (filterStatus.value) {
            filtered = filtered.filter(r => r.status === filterStatus.value);
        }
        if (filterDateFrom.value) {
            const fromDate = new Date(filterDateFrom.value);
            filtered = filtered.filter(r => r.timestamp && r.timestamp.toDate() >= fromDate);
        }
        if (filterDateTo.value) {
            const toDate = new Date(filterDateTo.value);
            toDate.setDate(toDate.getDate() + 1); // inclusive
            filtered = filtered.filter(r => r.timestamp && r.timestamp.toDate() < toDate);
        }
        displayReports(filtered);
    }

    [filterCrimeType, filterStatus, filterDateFrom, filterDateTo].forEach(el => {
        el.onchange = filterAndRender;
    });

    // Handle "Select All" checkbox
    const selectAll = document.getElementById('selectAllReports');
    if (selectAll) {
        selectAll.onclick = function() {
            document.querySelectorAll('.report-checkbox').forEach(cb => {
                cb.checked = selectAll.checked;
            });
        };
    }

    // Bulk verify selected
    document.getElementById('bulkVerifyBtn').onclick = async function() {
        const ids = Array.from(document.querySelectorAll('.report-checkbox:checked')).map(cb => cb.value);
        if (ids.length === 0) {
            alert("No reports selected.");
            return;
        }
        if (!confirm(`Verify ${ids.length} selected reports?`)) return;
        for (let id of ids) {
            await firebase.firestore().collection('reports').doc(id).update({ status: "verified" });
        }
        alert("Selected reports verified.");
        renderReportsTable();
    };

    // Bulk delete selected
    document.getElementById('bulkDeleteBtn').onclick = async function() {
        const ids = Array.from(document.querySelectorAll('.report-checkbox:checked')).map(cb => cb.value);
        if (ids.length === 0) {
            alert("No reports selected.");
            return;
        }
        if (!confirm(`Delete ${ids.length} selected reports? This cannot be undone.`)) return;
        for (let id of ids) {
            await firebase.firestore().collection('reports').doc(id).delete();
        }
        alert("Selected reports deleted.");
        renderReportsTable();
    };

    // Attach button events
    document.querySelectorAll('.verify-btn').forEach(btn => {
        btn.onclick = () => verifyReport(btn.dataset.id);
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = () => deleteReport(btn.dataset.id);
    });

    // Attach row click events for modal
    attachRowClicks();
}

// Modal event logic
document.addEventListener('DOMContentLoaded', () => {
    // Close modal handler
    document.getElementById('closeReportModal').onclick = () => {
        document.getElementById('reportModal').style.display = 'none';
    };
    // Optional: Close modal if click outside modal-content
    document.getElementById('reportModal').onclick = e => {
        if (e.target.id === 'reportModal') {
            document.getElementById('reportModal').style.display = 'none';
        }
    };
});

// Handle table row click to view report details
function attachRowClicks() {
    document.querySelectorAll('.report-row').forEach(row => {
        row.onclick = (e) => {
            // Prevent modal if the click was on a button or checkbox
            if (
                e.target.tagName === "BUTTON" ||
                (e.target.tagName === "INPUT" && e.target.type === "checkbox")
            ) return;
            showReportModal(row.dataset.id);
        };
    });
}

// Modal display logic
async function showReportModal(reportId) {
    currentOpenReportId = reportId; // <-- set this global for editing
    const doc = await firebase.firestore().collection('reports').doc(reportId).get();
    if (!doc.exists) {
        alert("Report not found.");
        return;
    }
    const r = doc.data();
    let html = `<h2>Report Details</h2>
        <p><b>Crime Type:</b> ${r.crimeType || ''}</p>
        <p><b>Description:</b> ${r.description || ''}</p>
        <p><b>Date:</b> ${r.timestamp ? new Date(r.timestamp.seconds*1000).toLocaleString() : ''}</p>
        <p><b>Location:</b> ${r.streetAddress || ''}</p>
        <div id="heatmap-view-modal" style="height:220px;width:100%;border-radius:12px;margin:10px 0;"></div>
        <p><b>Status:</b> ${r.status || 'pending'}</p>
        <p><b>Reporter:</b> ${r.reporterName || ''}</p>`;

    // --- GD Evidence display ---
    html += `<div style="margin:10px 0 0 0;"><b>GD Evidence:</b> `;
    if (Array.isArray(r.gd) && r.gd.length > 0) {
        r.gd.forEach(url => {
            if (url.match(/\.(jpg|jpeg|png|gif)$/i)) {
                html += `<img src="${url}" style="max-width:140px;margin:7px;border-radius:5px;">`;
            } else if (url.match(/\.pdf$/i)) {
                html += `<a href="${url}" target="_blank" style="margin:7px;display:inline-block;">View GD PDF</a>`;
            }
        });
    } else if (typeof r.gd === "string" && r.gd.length > 0) {
        const url = r.gd;
        if (url.match(/\.(jpg|jpeg|png|gif)$/i)) {
            html += `<img src="${url}" style="max-width:140px;margin:7px;border-radius:5px;">`;
        } else if (url.match(/\.pdf$/i)) {
            html += `<a href="${url}" target="_blank" style="margin:7px;display:inline-block;">View GD PDF</a>`;
        }
    } else {
        html += `<span style="color:#888;">No GD submitted.</span>`;
    }
    html += `</div>`;

    // Show media (if available)
    if (r.mediaUrls && Array.isArray(r.mediaUrls) && r.mediaUrls.length) {
        html += `<div><b>Media Evidence:</b>`;
        r.mediaUrls.forEach(url => {
            if (url.match(/\.(jpg|jpeg|png|gif)$/i)) {
                html += `<img src="${url}" alt="Image Evidence">`;
            } else if (url.match(/\.(mp4|webm)$/i)) {
                html += `<video src="${url}" controls></video>`;
            } else if (url.match(/\.(mp3|wav)$/i)) {
                html += `<audio src="${url}" controls></audio>`;
            } else if (url.match(/\.pdf$/i)) {
                html += `<a href="${url}" target="_blank">View PDF</a>`;
            }
        });
        html += `</div>`;
    }

    // Optionally, list tips
    html += `<div id="modalTips"></div>`;
    html += `<button id="editReportBtn" style="margin-top:1em;background:#1d72b8;">Edit Report</button>`;

    document.getElementById('modalReportContent').innerHTML = html;
    document.getElementById('reportModal').style.display = 'flex';

    // Load tips for this report
    const tipsSnap = await firebase.firestore().collection('reports').doc(reportId).collection('tips').get();
    let tipsHtml = `<h4 style="margin-top:1.5em;">Tips & Community Insights</h4>`;
    if (tipsSnap.empty) {
        tipsHtml += `<i>No tips yet.</i>`;
    } else {
        tipsHtml += `<ul style="padding-left:1.2em;">`;
        tipsSnap.forEach(tipDoc => {
            const t = tipDoc.data();
            tipsHtml += `<li>
                ${t.text || ''} <span style="color:#aaa;font-size:0.93em;">(${t.upvotes || 0} upvotes)</span>
                <button class="remove-tip-btn" data-report="${reportId}" data-tip="${tipDoc.id}" style="background:#be3144;margin-left:10px;">Remove</button>
            </li>`;
        });
        tipsHtml += `</ul>`;
    }
    document.getElementById('modalTips').innerHTML = tipsHtml;

    // Attach event listeners to Remove Tip buttons
    document.querySelectorAll('.remove-tip-btn').forEach(btn => {
        btn.onclick = function() {
            const reportId = btn.getAttribute('data-report');
            const tipId = btn.getAttribute('data-tip');
            if (confirm('Remove this tip?')) {
                deleteTip(reportId, tipId);
            }
        };
    });

    // Heatmap logic for view modal
    if (r.latitude && r.longitude) {
        firebase.firestore().collection('reports').get().then(snapshot => {
            const heatPoints = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.latitude && data.longitude) {
                    heatPoints.push([data.latitude, data.longitude, 0.5]);
                }
            });
            setTimeout(() => {
                const map = L.map('heatmap-view-modal').setView([r.latitude, r.longitude], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap'
                }).addTo(map);
                L.heatLayer(heatPoints, {radius: 25, blur: 18, maxZoom: 17}).addTo(map);
                L.marker([r.latitude, r.longitude]).addTo(map);
            }, 100);
        });
    } else {
        document.getElementById('heatmap-view-modal').innerHTML = "<em>No coordinates found for this report.</em>";
    }
}

// Replace your existing showEditReportForm with:
async function showEditReportForm(reportId) {
    const doc = await firebase.firestore().collection('reports').doc(reportId).get();
    if (!doc.exists) {
        alert("Report not found.");
        return;
    }
    const r = doc.data();
    let html = `<h2>Edit Report</h2>
        <form id="editReportForm">
            <label>Crime Type:<br>
                <select name="crimeType" required>
                    <option value="">-- Select Crime --</option>
                    <option value="Robbery" ${r.crimeType==="Robbery"?"selected":""}>Robbery</option>
                    <option value="Assault" ${r.crimeType==="Assault"?"selected":""}>Assault</option>
                    <option value="Theft" ${r.crimeType==="Theft"?"selected":""}>Theft</option>
                    <option value="Harassment" ${r.crimeType==="Harassment"?"selected":""}>Harassment</option>
                    <option value="Vandalism" ${r.crimeType==="Vandalism"?"selected":""}>Vandalism</option>
                    <option value="Other" ${r.crimeType==="Other"?"selected":""}>Other</option>
                </select>
            </label><br><br>
            <label>Description:<br>
                <textarea name="description" rows="3" required>${r.description || ""}</textarea>
            </label><br><br>
            <label>Location:<br>
                <input name="streetAddress" value="${r.streetAddress || ""}">
            </label><br>
            <input type="hidden" id="editLatInput" name="latitude" value="${r.latitude || ''}">
            <input type="hidden" id="editLngInput" name="longitude" value="${r.longitude || ''}">
            <div id="heatmap-edit-modal" style="height:220px;width:100%;border-radius:12px;margin:10px 0;"></div>
            <div id="edit-coords-box" style="margin:8px 0 0 0;"></div>
            <br>
            <label>Status:<br>
                <select name="status">
                    <option value="pending" ${r.status==="pending"?"selected":""}>Pending</option>
                    <option value="verified" ${r.status==="verified"?"selected":""}>Verified</option>
                    <option value="rejected" ${r.status==="rejected"?"selected":""}>Rejected</option>
                </select>
            </label><br><br>
            <div>
              <label>GD Evidence (image/pdf URL or one per line):<br>
                <textarea name="gd" rows="2" style="width:100%;">${Array.isArray(r.gd) ? r.gd.join('\n') : (r.gd || "")}</textarea>
              </label>
            </div>
            <br>
            <button type="submit" style="background:#1d72b8;">Save</button>
            <button type="button" id="cancelEditBtn" style="background:#aaa;margin-left:10px;">Cancel</button>
        </form>`;
    document.getElementById('modalReportContent').innerHTML = html;

    // --- Render map + draggable marker ---
    if (r.latitude && r.longitude) {
        firebase.firestore().collection('reports').get().then(snapshot => {
            const heatPoints = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.latitude && data.longitude) {
                    heatPoints.push([data.latitude, data.longitude, 0.5]);
                }
            });
            setTimeout(() => {
                const map = L.map('heatmap-edit-modal').setView([r.latitude, r.longitude], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap'
                }).addTo(map);
                L.heatLayer(heatPoints, {radius: 25, blur: 18, maxZoom: 17}).addTo(map);

                const marker = L.marker([r.latitude, r.longitude], { draggable: true }).addTo(map);

                marker.on('dragend', function(e) {
                    const lat = marker.getLatLng().lat;
                    const lng = marker.getLatLng().lng;
                    // Update hidden fields for submit
                    document.getElementById('editLatInput').value = lat;
                    document.getElementById('editLngInput').value = lng;
                    // Show coords
                    document.getElementById('edit-coords-box').innerHTML = `<b>New Location:</b> ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                });
            }, 100);
        });
    } else {
        document.getElementById('heatmap-edit-modal').innerHTML = "<em>No coordinates found for this report.</em>";
    }

    document.getElementById('editReportForm').onsubmit = async function(e) {
        e.preventDefault();
        const form = e.target;
        const gdVal = form.gd.value.trim();
        let gdField;
        if (!gdVal) {
          gdField = [];
        } else if (gdVal.includes('\n')) {
          gdField = gdVal.split('\n').map(x => x.trim()).filter(x => x);
        } else {
          gdField = gdVal;
        }
        const updates = {
            crimeType: form.crimeType.value.trim(),
            description: form.description.value.trim(),
            streetAddress: form.streetAddress.value.trim(),
            status: form.status.value,
            latitude: form.latitude.value ? parseFloat(form.latitude.value) : null,
            longitude: form.longitude.value ? parseFloat(form.longitude.value) : null,
            gd: gdField
        };
        try {
            await firebase.firestore().collection('reports').doc(reportId).update(updates);
            alert("Report updated.");
            showReportModal(reportId); // Reload modal with updated data
        } catch (error) {
            alert("Error: " + error.message);
        }
    };
    document.getElementById('cancelEditBtn').onclick = () => showReportModal(reportId);
}

// Attach the Edit button handler ONCE, after the above functions
document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'editReportBtn') {
        showEditReportForm(currentOpenReportId);
    }
});

// Admin actions
async function verifyReport(reportId) {
    if (!confirm("Mark this report as verified?")) return;
    try {
        await firebase.firestore().collection('reports').doc(reportId).update({ status: "verified" });
        alert("Report verified.");
        renderReportsTable(); // Refresh
    } catch (e) {
        alert("Error: " + e.message);
    }
}

async function deleteReport(reportId) {
    if (!confirm("Are you sure you want to delete this report? This cannot be undone.")) return;
    try {
        await firebase.firestore().collection('reports').doc(reportId).delete();
        alert("Report deleted.");
        renderReportsTable();
    } catch (e) {
        alert("Error: " + e.message);
    }
}

// Add at the bottom of your JS file:
async function deleteTip(reportId, tipId) {
    try {
        await firebase.firestore().collection('reports').doc(reportId).collection('tips').doc(tipId).delete();
        alert("Tip removed.");
        showReportModal(reportId); // Refresh modal to update tips list
    } catch (error) {
        alert("Error removing tip: " + error.message);
    }
}

// --- New: Admin dashboard rendering ---
async function renderAdminDashboard() {
    // --- Dashboard Cards Skeleton ---
    adminContent.innerHTML = `
      <div id="dashboard-cards" style="display:flex;flex-wrap:wrap;gap:1.5em;margin-bottom:2em;"></div>
      <h3 style="margin-top:0;">Recent Reports</h3>
      <div id="dashboard-recent-reports"></div>
      <div style="margin-top:2em;">
        <button onclick="loadSection('reports')" style="background:#1d72b8;color:#fff;border:none;padding:0.6em 1.3em;border-radius:8px;font-weight:500;">Monitor Reports</button>
        <button onclick="loadSection('accounts')" style="background:#333;color:#fff;border:none;padding:0.6em 1.3em;border-radius:8px;font-weight:500;margin-left:1em;">Account Management</button>
      </div>
    `;

    // --- Fetch stats in parallel ---
    const reportsSnap = await firebase.firestore().collection('reports').get();
    const usersSnap = await firebase.firestore().collection('users').get();

    let totalReports = reportsSnap.size;
    let verified = 0, pending = 0, rejected = 0;
    reportsSnap.forEach(doc => {
        const s = doc.data().status;
        if (s === 'verified') verified++;
        else if (s === 'pending' || !s) pending++;
        else if (s === 'rejected') rejected++;
    });

    // Show stat cards
    document.getElementById('dashboard-cards').innerHTML = `
      <div class="dash-card"><h2>${totalReports}</h2><span>Total Reports</span></div>
      <div class="dash-card"><h2>${verified}</h2><span>Verified</span></div>
      <div class="dash-card"><h2>${pending}</h2><span>Pending</span></div>
      <div class="dash-card"><h2>${rejected}</h2><span>Rejected</span></div>
      <div class="dash-card"><h2>${usersSnap.size}</h2><span>Total Users</span></div>
    `;

    // Recent reports (latest 5)
    const reportsArr = [];
    reportsSnap.forEach(doc => {
        const d = doc.data();
        reportsArr.push({
            id: doc.id,
            crimeType: d.crimeType || '',
            status: d.status || 'pending',
            date: d.timestamp ? d.timestamp.toDate() : null,
        });
    });
    reportsArr.sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0));
    let recentHtml = `<table class="admin-table" style="margin-top:0;"><thead>
        <tr><th>ID</th><th>Type</th><th>Date</th><th>Status</th><th>View</th></tr></thead><tbody>`;
    reportsArr.slice(0, 5).forEach(r => {
        recentHtml += `<tr>
            <td>${r.id}</td>
            <td>${r.crimeType}</td>
            <td>${r.date ? r.date.toLocaleString() : ''}</td>
            <td>${r.status}</td>
            <td><button onclick="showReportModal('${r.id}')">View</button></td>
        </tr>`;
    });
    recentHtml += `</tbody></table>`;
    document.getElementById('dashboard-recent-reports').innerHTML = recentHtml;
}
