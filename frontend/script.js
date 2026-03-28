// ----------------------
// 🌍 CONFIG (IMPORTANT)
// ----------------------
const BASE_URL = "https://safe-path-router.onrender.com"; 
// 🔥 replace with your Render backend URL


// ----------------------
// 🌐 GLOBAL VARIABLES
// ----------------------
let map = null;
let routeLayers = [];
let heatLayer = null;


// ----------------------
// 🗺️ INITIALIZE MAP
// ----------------------
function initMap() {
  const mapContainer = document.getElementById("map");

  if (!mapContainer) return; // ✅ prevents errors on other pages

  map = L.map('map').setView([13.0827, 80.2707], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: "© OpenStreetMap"
  }).addTo(map);
}

window.onload = initMap;


// ----------------------
// 🔍 AUTOCOMPLETE
// ----------------------
async function suggestLocation(input, listId) {

  const query = input.value;

  if (query.length < 3) return;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${query} Chennai`
    );

    const data = await res.json();

    const list = document.getElementById(listId);
    if (!list) return;

    list.innerHTML = "";

    data.slice(0, 5).forEach(place => {
      const option = document.createElement("option");
      option.value = place.display_name;
      list.appendChild(option);
    });

  } catch (err) {
    console.error("Autocomplete error:", err);
  }
}


// ----------------------
// 📍 GET COORDINATES
// ----------------------
async function getCoordinates(place) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${place}`
    );

    const data = await res.json();

    if (!data.length) {
      alert("Location not found: " + place);
      return null;
    }

    return [parseFloat(data[0].lon), parseFloat(data[0].lat)];

  } catch (err) {
    console.error("Geocoding error:", err);
    return null;
  }
}


// ----------------------
// 🧭 GET ROUTE (FROM RENDER BACKEND)
// ----------------------
async function getRoute(start, end) {
  try {

    const res = await fetch(`${BASE_URL}/route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        coordinates: [
          [start[0], start[1]],
          [end[0], end[1]]
        ]
      })
    });

    const data = await res.json();

    if (!res.ok || !data.features) {
      alert("Route API Error");
      return null;
    }

    return data;

  } catch (err) {
    console.error("Routing error:", err);
    return null;
  }
}


// ----------------------
// 🧠 ML RISK API (RENDER)
// ----------------------
async function getRisk(point) {
  try {
    const res = await fetch(`${BASE_URL}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        Latitude: point[0],
        Longitude: point[1]
      })
    });

    const data = await res.json();
    return data.risk || 0;

  } catch (err) {
    console.error("ML API error:", err);
    return 0;
  }
}


// ----------------------
// ⚡ CALCULATE ROUTE RISK
// ----------------------
async function calculateRouteRisk(points) {

  const sampled = points.filter((_, i) => i % 10 === 0);

  const risks = await Promise.all(
    sampled.map(p => getRisk(p))
  );

  const totalRisk = risks.reduce((sum, r) => sum + r, 0);

  return sampled.length ? totalRisk / sampled.length : 0;
}


// ----------------------
// 🟢 FIND SAFE ROUTE
// ----------------------
async function findRoute() {

  if (!map) return;

  routeLayers.forEach(layer => map.removeLayer(layer));
  routeLayers = [];

  const resultBox = document.getElementById("result");
  if (resultBox) resultBox.innerText = "Loading safest route...";

  const startInput = document.getElementById("start")?.value;
  const endInput = document.getElementById("end")?.value;

  if (!startInput || !endInput) {
    alert("Enter both locations");
    return;
  }

  const start = await getCoordinates(startInput + " Chennai");
  const end = await getCoordinates(endInput + " Chennai");

  if (!start || !end) return;

  const data = await getRoute(start, end);
  if (!data) return;

  let routes = [];

  for (let route of data.features) {

    const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
    const risk = await calculateRouteRisk(coords);

    routes.push({ coords, risk });
  }

  if (routes.length === 0) {
    alert("No routes found");
    return;
  }

  const safest = routes.reduce((a, b) =>
    a.risk < b.risk ? a : b
  );

  // 🔴 draw all routes
  routes.forEach(r => {
    const poly = L.polyline(r.coords, {
      color: "red",
      weight: 4,
      opacity: 0.5
    }).addTo(map);

    routeLayers.push(poly);
  });

  // 🟢 safest route
  const safePoly = L.polyline(safest.coords, {
    color: "green",
    weight: 6
  }).addTo(map);

  routeLayers.push(safePoly);

  map.fitBounds(safePoly.getBounds());

  if (resultBox) {
    resultBox.innerText = "Safest Route Risk: " + safest.risk.toFixed(2);
  }
}


// ----------------------
// 🔥 HEATMAP (RENDER)
// ----------------------
async function showHeatmap() {

  if (!map) return;

  try {

    const res = await fetch(`${BASE_URL}/heatmap`);
    const data = await res.json();

    const heatData = data.map(p => [
      p.lat,
      p.lon,
      p.intensity
    ]);

    if (heatLayer) {
      map.removeLayer(heatLayer);
    }

    heatLayer = L.heatLayer(heatData, {
      radius: 25,
      blur: 15
    }).addTo(map);

  } catch (err) {
    console.error("Heatmap error:", err);
  }
}


// ----------------------
// 🚨 SOS FEATURE
// ----------------------
function triggerSOS() {

  navigator.geolocation.getCurrentPosition(async (pos) => {

    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    try {
      const query = `
      [out:json];
      node["amenity"="police"](around:2000, ${lat}, ${lon});
      out;
      `;

      const res = await fetch(
        "https://overpass-api.de/api/interpreter",
        {
          method: "POST",
          body: query
        }
      );

      const data = await res.json();

      if (data.elements.length > 0) {
        alert("🚓 Police nearby! Calling emergency...");
        window.location.href = "tel:100";
      } else {
        alert("No nearby police station found");
      }

    } catch (err) {
      console.error("SOS error:", err);
    }

  }, () => {
    alert("Location permission denied");
  });
}