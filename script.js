// import { decode, expand } from "https://cdn.jsdelivr.net/npm/pluscodes@3.0.1/dist/index.js";

// Location class
class Location {
  constructor(caption, lat, lng, date, description, imgUrl, withHeart, plusCode) {
    this.caption = caption;
    this.lat = lat;
    this.lng = lng;
    this.date = date;
    this.description = description;
    this.imgUrl = imgUrl;
    this.withHeart = withHeart;
    this.plusCode = plusCode;
  }
}

// 1) Create map
const map = L.map('map');

// 2) Tiles (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// 3) Load places from JSON and create markers
let places = [];
let cluster = L.markerClusterGroup({
  disableClusteringAtZoom: 0
});

// Create custom marker icons
const defaultIcon = L.divIcon({
  className: 'custom-marker-default',
  html: '📍',
  iconSize: [20, 20],
  iconAnchor: [10, 20]
});

const clickedIcon = L.divIcon({
  className: 'custom-marker-clicked',
  html: '📍',
  iconSize: [20, 20],
  iconAnchor: [10, 20]
});

// Track clicked markers
let clickedMarkers = new Set();

// Local storage functions
function saveClickedMarkers() {
  const clickedCaptions = Array.from(clickedMarkers).map(marker => marker._location.caption);
  localStorage.setItem('clickedMarkers', JSON.stringify(clickedCaptions));
}

function loadClickedMarkers() {
  const saved = localStorage.getItem('clickedMarkers');
  return saved ? JSON.parse(saved) : [];
}

function isMarkerClicked(caption) {
  const clickedCaptions = loadClickedMarkers();
  return clickedCaptions.includes(caption);
}

// Function to decode plus code to lat/lng
function decodePlusCode(plusCode) {
  try {   
    // Clean the plus code (remove any city suffix)
    const cleanCode = plusCode.split(' ')[0];
    
    // Decode the plus code using the pluscodes library
    const decoded = OpenLocationCode.decode(cleanCode);
    return {
      lat: decoded.latitudeCenter,
      lng: decoded.longitudeCenter
    };
  } catch (error) {
    console.error('Error decoding plus code:', plusCode, error);
    return null;
  }
}

// Load places from the imported data
function loadPlaces() {
  try {
    places = placesData.map(placeData => {
      let lat = placeData.lat;
      let lng = placeData.lng;
      
      // If lat/lng are null but we have a plus code, decode it
      if ((lat === null || lng === null) && placeData.plusCode) {
        const decoded = decodePlusCode(placeData.plusCode);
        if (decoded) {
          lat = decoded.lat;
          lng = decoded.lng;
        }
      }
      
      // Create Date object from date string if it exists
      let date = null;
      if (placeData.date) {
        date = new Date(placeData.date);
      }
      
      return new Location(
        placeData.caption,
        lat,
        lng,
        date,
        placeData.description,
        placeData.imgUrl,
        placeData.withHeart,
        placeData.plusCode
      );
    });
    
    // Create markers after loading places
    createMarkers();
    
  } catch (error) {
    console.error('Error loading places:', error);
    // Fallback to default view if loading fails
    map.setView([50.4501, 30.5234], 12);
  }
}

// Function to create markers from places data
function createMarkers() {
  // Clear existing markers
  cluster.clearLayers();
  
  places.forEach(location => {
    // Skip if we don't have valid coordinates
    if (!location.lat || !location.lng) {
      console.warn('Skipping location without coordinates:', location.caption);
      return;
    }

    // Check if this marker was previously clicked
    const wasClicked = isMarkerClicked(location.caption);
    const initialIcon = wasClicked ? clickedIcon : defaultIcon;
    
    const marker = L.marker([location.lat, location.lng], { icon: initialIcon });
    
    // Store reference to location for localStorage
    marker._location = location;
    
    // Add to clicked set if it was previously clicked
    if (wasClicked) {
      clickedMarkers.add(marker);
    }

    // Add click event listener to change marker color
    marker.on('click', function() {
      if (!clickedMarkers.has(marker)) {
        // If not clicked, change to clicked color

        marker.setIcon(clickedIcon);
        clickedMarkers.add(marker);
         // Save to localStorage whenever clicked state changes
        saveClickedMarkers();
      }
    });

    // Create popup HTML with Location data
    let popupContent = `<div class="popup-container">`;
    
    // Add heart emoji for special places
    popupContent += `<b>${location.caption}</b><br/>`;
  
    if (location.imgUrl && location.imgUrl !== "туду фото") {
      popupContent += `<img src="${location.imgUrl}" class="popup-image" /><br/>`;
    }
    
    if (location.date) {
      popupContent += `<small class="popup-date">${location.date.toLocaleDateString()}</small><br/>`;
    }
    
    if (location.description) {
      const heartOrNot = location.withHeart ? "❤️" : "";
      popupContent += `<p class="popup-description">${location.description}${heartOrNot}</p>`;
    }
    
    if (location.plusCode) {
      popupContent += `<small class="popup-pluscode">📍 ${location.plusCode}</small>`;
    }
    
    popupContent += `</div>`;
    
    marker.bindPopup(popupContent);
    cluster.addLayer(marker);
  });

  map.addLayer(cluster);

  // Auto-zoom to show all markers
  const validPlaces = places.filter(p => p.lat && p.lng);
  if (validPlaces.length > 0) {
    const bounds = L.latLngBounds(validPlaces.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [20, 20] });
  } else {
    map.setView([50.4501, 30.5234], 12);
  }
}

// Initialize the map by loading places
loadPlaces();