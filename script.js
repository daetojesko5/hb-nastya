function updateRootFont() {
  const dpr = window.devicePixelRatio || 1;
  const scale = window.visualViewport?.scale || 1;

  const effective = dpr / scale; // key signal from your examples

  let rootPx = 3.47826087 * effective + 8.91304348;

  // optional safety clamp (tweak to taste)
  rootPx = Math.max(12, Math.min(rootPx, 45));

  document.documentElement.style.fontSize = `${rootPx.toFixed(2)}px`;
}

updateRootFont();
window.addEventListener("resize", updateRootFont);
window.visualViewport?.addEventListener("resize", updateRootFont)

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

// Create counter element
const counterElement = document.createElement('div');
counterElement.id = 'marker-counter';
counterElement.className = 'marker-counter';
counterElement.textContent = '0/0';
document.body.appendChild(counterElement);

// Create heart icon element
const heartIcon = document.createElement('div');
heartIcon.id = 'heart-icon';
heartIcon.className = 'heart-icon';
heartIcon.innerHTML = '❤️';
heartIcon.title = 'Click for surprise!';
heartIcon.style.display = 'none'; // Hide initially
document.body.appendChild(heartIcon);

// Function to check if all markers are clicked
function checkAllMarkersClicked() {
  const totalCount = places.filter(p => p.lat && p.lng).length;
  const clickedCount = clickedMarkers.size;
  
  if (totalCount > 0 && clickedCount === totalCount) {
    heartIcon.style.removeProperty('display');
  } else {
    heartIcon.style.display = 'none';
  }
}

// Add click handler for heart icon
heartIcon.addEventListener('click', function() {
  showHeartPopup();
});

// Function to show heart popup
function showHeartPopup() {
  // Remove existing popup if any
  const existingPopup = document.querySelector('.heart-popup');
  if (existingPopup) {
    existingPopup.remove();
  }
  
  // Create popup
  const popup = document.createElement('div');
  popup.className = 'heart-popup';
  popup.innerHTML = `
    <div class="heart-popup-content">
      <h3>Любімка, з твоїм днем 💕</h3>
      <img src="images/love.png" class="heart-popup-image" alt="Love" />
      <p>Нехай всі мрії збуваються!</p>
    </div>
  `;
  
  // Add click handler to close when clicking outside
  popup.addEventListener('click', function(e) {
    // Only close if clicking on the overlay (not the content)
    if (e.target === popup) {
      popup.remove();
    }
  });
  
  document.body.appendChild(popup);
}

// 3) Load places from JSON and create markers
let places = [];
let cluster = L.markerClusterGroup({
  disableClusteringAtZoom: 0
});

const iconAnchorY = window.innerWidth < 900 ? 5 : 15;

// Create custom marker icons
const defaultIcon = L.divIcon({
  className: 'custom-marker-default',
  html: '<span>📍</span>',
  iconSize: [30, 60],
  iconAnchor: [15, iconAnchorY]
});

const clickedIcon = L.divIcon({
  className: 'custom-marker-clicked',
  html: '<span>📍</span>',
  iconSize: [30, 60],
  iconAnchor: [15, iconAnchorY]
});

// Track clicked markers
let clickedMarkers = new Set();

// Start background audio on the first marker click (session-only)
let backgroundAudioStarted = false;

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

// Function to update counter display
function updateCounter() {
  const totalCount = places.filter(p => p.lat && p.lng).length;
  const clickedCount = clickedMarkers.size;
  counterElement.textContent = `${clickedCount}/${totalCount}`;
  
  // Check if heart should be visible
  checkAllMarkersClicked();
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
      if (!backgroundAudioStarted) {
        backgroundAudioStarted = true;
        if (typeof window.startBackgroundAudio === 'function') {
          window.startBackgroundAudio();
        } else {
          document.dispatchEvent(new Event('start-background-audio'));
        }
      }

      if (!clickedMarkers.has(marker)) {
        // If not clicked, change to clicked color
        marker.setIcon(clickedIcon);
        clickedMarkers.add(marker);
        // Save to localStorage whenever clicked state changes
        saveClickedMarkers();
        // Update counter display
        updateCounter();
      }
      // else
      // {
      //   // If not clicked, change to clicked color
      //   marker.setIcon(defaultIcon);
      //   clickedMarkers.delete(marker);
      //   // Save to localStorage whenever clicked state changes
      //   saveClickedMarkers();
      //   // Update counter display
      //   updateCounter();
      // }
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
    
    marker.bindPopup(popupContent, {
      className: "big-popup"
    });
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
  
  // Update counter after creating markers
  updateCounter();
}

// Initialize the map by loading places
loadPlaces();

map.on("popupopen", (e) => {
  const popupEl = e.popup.getElement();
  if (!popupEl) return;

  // Wait a tick so Leaflet finishes positioning the popup
  requestAnimationFrame(() => {
    const mapRect = map.getContainer().getBoundingClientRect();
    const popRect = popupEl.getBoundingClientRect();

    const mapCenterX = mapRect.left + mapRect.width / 2;
    const mapCenterY = mapRect.top  + mapRect.height / 2 + 150;

    const popCenterX = popRect.left + popRect.width / 2;
    const popCenterY = popRect.top  + popRect.height / 2;

    // Pan so popup center -> map center
    const dx = popCenterX - mapCenterX;
    const dy = popCenterY - mapCenterY;

    map.panBy([dx, dy], { animate: true });
  });
});