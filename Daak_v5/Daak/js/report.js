// report.js

async function uploadToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/dvexnxlb0/auto/upload`;
  const preset = "daak_unsigned";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", preset);

  const response = await fetch(url, {
    method: "POST",
    body: formData
  });

  const data = await response.json();
  if (!data.secure_url) throw new Error("Upload failed");
  return data.secure_url;
}

const auth = firebase.auth();
const db = firebase.firestore();

// Helper to get full name from users collection
async function getReporterName(user, isAnonymous) {
  if (isAnonymous) return "Anonymous";
  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists && doc.data().fullName) {
      return doc.data().fullName;
    }
  } catch (e) {}
  return "User";
}

async function getReverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  const response = await fetch(url);
  const data = await response.json();
  return {
    streetAddress: data.display_name || null,
    region: data.address.suburb || data.address.neighbourhood || data.address.city_district || null,
    area: data.address.road || null
  };
}

auth.onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const reportForm = document.getElementById('reportForm');
  reportForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const crimeType = document.getElementById('crimeType').value;
    const description = document.getElementById('description').value;
    const latitude = document.getElementById('latitude').value;
    const longitude = document.getElementById('longitude').value;
    const isAnonymous = document.getElementById('anonymousCheckbox').checked;
    const incidentFiles = document.getElementById('media').files;
    const gdFile = document.getElementById('gdFile') ? document.getElementById('gdFile').files[0] : null;

    let streetAddress = null;
    let region = null;
    let area = null;

    if (latitude && longitude) {
      try {
        const locationInfo = await getReverseGeocode(latitude, longitude);
        streetAddress = locationInfo.streetAddress;
        region = locationInfo.region;
        area = locationInfo.area;
      } catch (err) {
        console.warn("Reverse geocoding failed:", err);
      }
    }

    // 1. Gather suspects (array of { name, file })
    const suspects = [];
    document.querySelectorAll('#suspectsContainer .suspect-entry').forEach(entry => {
      const name = entry.querySelector('input[type="text"]').value;
      const file = entry.querySelector('input[type="file"]').files[0];
      suspects.push({ name, file });
    });

    // 2. Gather victims (array of { name, file })
    const victims = [];
    document.querySelectorAll('#victimsContainer .victim-entry').forEach(entry => {
      const name = entry.querySelector('input[type="text"]').value;
      const file = entry.querySelector('input[type="file"]').files[0];
      victims.push({ name, file });
    });

    // Helper: upload all images and pair with names
    const uploadPersonImages = async (arr) => {
      return await Promise.all(arr.map(async (person) => ({
        name: person.name,
        imageUrl: person.file ? await uploadToCloudinary(person.file) : null
      })));
    };

    let suspectsData = [];
    let victimsData = [];
    let mediaUrls = [];
    let gdUrl = null;
    let gdType = null;

    try {
      // Upload suspects & victims images
      suspectsData = await uploadPersonImages(suspects);
      victimsData = await uploadPersonImages(victims);

      // Incident media (image/video, optional, multiple)
      if (incidentFiles && incidentFiles.length > 0) {
        for (let file of incidentFiles) {
          const url = await uploadToCloudinary(file);
          mediaUrls.push(url);
        }
      }

      // GD file (optional)
      if (gdFile) {
        gdUrl = await uploadToCloudinary(gdFile);
        if (gdFile.type.startsWith('image/')) {
          gdType = 'image';
        } else if (gdFile.type === 'application/pdf' || gdFile.name.endsWith('.pdf')) {
          gdType = 'pdf';
        }
      }
    } catch (err) {
      console.error("Image/GD upload failed", err);
      alert("Failed to upload one or more images or GD.");
      return;
    }

    // Get reporter full name from users collection
    const reporterName = await getReporterName(user, isAnonymous);

    const reportData = {
      crimeType,
      description,
      userId: user.uid,
      reporterName,
      isAnonymous,
      timestamp: new Date(),
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      streetAddress,
      region,
      area,
      mediaUrls, // Array of URLs
      gdUrl,
      gdType,
      suspects: suspectsData, // Array of {name, imageUrl}
      victims: victimsData    // Array of {name, imageUrl}
    };

    try {
      await db.collection('reports').add(reportData);
      alert("Report submitted successfully!");
      reportForm.reset();
      // Optionally, reset suspects/victims sections:
tion('reports').add(reportData);
      alert("Report submitted successfully!");
      reportForm.reset();
      // Optionally, reset suspects/victims sections:
      document.getElementById('suspectsContainer').innerHTML = "";
      document.getElementById('victimsContainer').innerHTML = "";
      addSuspect();
      addVictim();
    } catch (error) {
      console.error("Error submitting report:", error);
      alert("Failed to submit report. Please try again.");
    }
  });
});
