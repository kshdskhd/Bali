// === Utility Functions ===
function formatIDR(num) {
    if (num >= 1e12) return `IDR ${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `IDR ${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `IDR ${(num / 1e6).toFixed(0)}M`;
    return `IDR ${num.toLocaleString()}`;
}

function formatUSD(num) {
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(0)}K`;
    return `$${num.toFixed(0)}`;
}

function formatAED(num) {
    if (num >= 1e6) return `AED ${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `AED ${(num / 1e3).toFixed(0)}K`;
    return `AED ${num.toFixed(0)}`;
}

function getPricePerSqm(option) {
    if (option.pricePerSqm) return option.pricePerSqm;
    if (option.pricePerAre) return option.pricePerAre / 100;
    return option.totalPrice / option.landSize;
}

function getTotalPrice(option) {
    return option.totalPrice;
}

function getZoneColorStyle(color) {
    return `background: ${color};`;
}

// === Display State ===
const displayState = {
    currency: 'USD',  // 'USD' or 'AED'
    unit: 'sqm'       // 'sqm' or 'sqft'
};

function formatPrice(idrAmount) {
    if (displayState.currency === 'AED') {
        return formatAED(idrAmount * IDR_TO_AED);
    }
    return formatUSD(idrAmount * IDR_TO_USD);
}

function formatPriceValue(usdAmount) {
    if (displayState.currency === 'AED') {
        return formatAED(usdAmount / IDR_TO_USD * IDR_TO_AED);
    }
    return formatUSD(usdAmount);
}

function formatArea(sqm) {
    if (displayState.unit === 'sqft') {
        return `${Math.round(sqm * SQM_TO_SQFT).toLocaleString()} sqft`;
    }
    return `${sqm.toLocaleString()} sqm`;
}

function getUnitLabel() {
    return displayState.unit === 'sqft' ? 'sqft' : 'sqm';
}

function getCurrencySymbol() {
    return displayState.currency === 'AED' ? 'AED' : '$';
}

function getPricePerUnit(option) {
    const pricePerSqmIDR = getPricePerSqm(option);
    let pricePerUnit;
    if (displayState.unit === 'sqft') {
        pricePerUnit = pricePerSqmIDR / SQM_TO_SQFT;
    } else {
        pricePerUnit = pricePerSqmIDR;
    }
    if (displayState.currency === 'AED') {
        return formatAED(pricePerUnit * IDR_TO_AED);
    }
    return formatUSD(pricePerUnit * IDR_TO_USD);
}

function getTotalInCurrency(option) {
    const totalIDR = getTotalPrice(option);
    if (displayState.currency === 'AED') {
        return formatAED(totalIDR * IDR_TO_AED);
    }
    return formatUSD(totalIDR * IDR_TO_USD);
}

// === Filter State ===
const activeFilters = {
    location: 'all',
    landSizeMin: null,
    landSizeMax: null,
    priceMin: null,
    priceMax: null,
    pricePerSqmMin: null,
    pricePerSqmMax: null
};

// Slider bounds (computed from data on init)
const sliderBounds = {
    sizeMin: 0, sizeMax: 10000,
    priceMin: 0, priceMax: 15000000,
    psqmMin: 0, psqmMax: 1500
};

// === Currency & Unit Toggles ===
function setCurrency(currency) {
    displayState.currency = currency;
    document.querySelectorAll('.toggle-group')[0].querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === currency);
    });
    updateSliderLabels();
    renderCards();
    renderComparisonTable();
    refreshMapMarkers();
}

function setUnit(unit) {
    displayState.unit = unit;
    document.querySelectorAll('.toggle-group')[1].querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === unit);
    });
    // Update slider labels
    document.getElementById('slider-size-unit').textContent = `(${unit})`;
    document.getElementById('slider-psqm-unit-label').textContent = unit;
    // Update slider max for sqft
    initSliderBounds();
    updateSliderLabels();
    renderCards();
    renderComparisonTable();
    refreshMapMarkers();
}

function updateSliderLabels() {
    const cs = displayState.currency;
    document.getElementById('slider-price-unit').textContent = `(${cs})`;
    document.getElementById('slider-psqm-unit').textContent = `(${cs})`;

    // Update displayed values
    updateSlider('size');
    updateSlider('price');
    updateSlider('psqm');
}

// === MapLibre Interactive Map ===
let baliMap = null;
let mapMarkers = [];
let activePopup = null;
let mapInitialized = false;

function initMap() {
    if (mapInitialized) return;
    mapInitialized = true;

    baliMap = new maplibregl.Map({
        container: 'maplibre-map',
        style: 'https://tiles.openfreemap.org/styles/positron',
        center: [115.165, -8.818],
        zoom: 11.8,
        minZoom: 10,
        maxZoom: 17,
        pitch: 0,
        maxBounds: [[114.95, -8.92], [115.35, -8.62]],
        attributionControl: false
    });

    baliMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    baliMap.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    // Disable rotation on mobile
    if (window.innerWidth <= 768) {
        baliMap.dragRotate.disable();
        baliMap.touchZoomRotate.disableRotation();
    }

    baliMap.on('load', () => {
        customizeMapStyle();
        addZoneOverlays();
        addMapMarkers();
    });
}

function customizeMapStyle() {
    const layers = baliMap.getStyle().layers;
    layers.forEach(layer => {
        try {
            // Mute water to soft blue-gray
            if (layer.id.includes('water') && layer.type === 'fill') {
                baliMap.setPaintProperty(layer.id, 'fill-color', '#c8d8e4');
            }
            // Mute land background
            if (layer.type === 'background') {
                baliMap.setPaintProperty(layer.id, 'background-color', '#f0ede6');
            }
            // Soften roads
            if (layer.id.includes('road') && layer.type === 'line') {
                baliMap.setPaintProperty(layer.id, 'line-opacity', 0.5);
            }
            // Mute labels
            if (layer.type === 'symbol' && !layer.id.includes('place')) {
                baliMap.setPaintProperty(layer.id, 'text-opacity', 0.5);
            }
            // Soften buildings
            if (layer.id.includes('building') && layer.type === 'fill') {
                baliMap.setPaintProperty(layer.id, 'fill-color', '#e8e4dc');
            }
            // Soften parks/green areas
            if ((layer.id.includes('park') || layer.id.includes('landuse')) && layer.type === 'fill') {
                baliMap.setPaintProperty(layer.id, 'fill-opacity', 0.3);
            }
        } catch (e) { /* skip layers that can't be modified */ }
    });
}

function addZoneOverlays() {
    // Zone polygons traced from Bali Home Immo reference map
    // Shared vertices ensure zones tile the peninsula with no gaps

    // Shared internal boundary points
    const B1 = [115.122, -8.785]; // Balangan / red-yellow-green junction (north)
    const B2 = [115.130, -8.795]; // red-yellow boundary mid
    const B3 = [115.132, -8.805]; // red-yellow-orange junction
    const B4 = [115.148, -8.798]; // yellow-green-orange junction
    const B5 = [115.160, -8.792]; // yellow-green boundary (east of Balangan)
    const B6 = [115.132, -8.818]; // red-orange boundary
    const B7 = [115.128, -8.832]; // red-orange boundary mid
    const B8 = [115.118, -8.845]; // red-orange boundary (south)
    const B9 = [115.165, -8.808]; // orange-green boundary
    const B10 = [115.178, -8.818]; // orange-green boundary
    const B11 = [115.188, -8.830]; // orange-green boundary
    const B12 = [115.198, -8.840]; // orange-green boundary (Pandawa junction)
    const B13 = [115.210, -8.845]; // orange-green boundary (near Sawangan)

    const zoneGeoJSON = {
        type: 'FeatureCollection',
        features: [
            {
                // RED — Very High Budget: Bingin, Padang Padang, West Uluwatu, Nyang Nyang
                // Entire western coastline strip
                type: 'Feature',
                properties: { zone: 'very-high', color: '#e74c3c', label: 'Very High Budget' },
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [115.118, -8.778], // NW coast near Balangan
                        B1,                // shared: red-yellow-green junction
                        B2,                // shared: red-yellow mid
                        B3,                // shared: red-yellow-orange junction
                        B6,                // shared: red-orange
                        B7,                // shared: red-orange mid
                        B8,                // shared: red-orange south
                        [115.105, -8.852], // Nyang Nyang coast
                        [115.092, -8.848], // SW coast
                        [115.078, -8.838], // Uluwatu temple area
                        [115.075, -8.825], // West Uluwatu coast
                        [115.080, -8.812], // Padang Padang coast
                        [115.088, -8.800], // Bingin coast
                        [115.098, -8.792], // Dreamland coast
                        [115.108, -8.785], // Balangan Beach coast
                        [115.118, -8.778]  // close
                    ]]
                }
            },
            {
                // YELLOW — Medium Budget: Balangan area
                // Crescent band between red (west) and green/orange (east)
                type: 'Feature',
                properties: { zone: 'medium', color: '#f1c40f', label: 'Medium Budget' },
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [115.118, -8.778], // NW coast
                        [115.128, -8.772], // coast heading east
                        [115.140, -8.770], // Kubu Beach area
                        B5,                // shared: yellow-green east boundary
                        B4,                // shared: yellow-green-orange junction
                        B3,                // shared: red-yellow-orange junction
                        B2,                // shared: red-yellow mid
                        B1,                // shared: red-yellow-green junction
                        [115.118, -8.778]  // close
                    ]]
                }
            },
            {
                // ORANGE — High Budget: Pecatu, East Uluwatu, Melasti, Pandawa
                // Central-south region
                type: 'Feature',
                properties: { zone: 'high', color: '#e67e22', label: 'High Budget' },
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        B3,                // shared: red-yellow-orange junction
                        B4,                // shared: yellow-green-orange junction
                        B9,                // shared: orange-green
                        B10,               // shared: orange-green
                        B11,               // shared: orange-green
                        B12,               // shared: orange-green Pandawa
                        B13,               // shared: orange-green Sawangan
                        [115.200, -8.852], // Pandawa Beach coast
                        [115.188, -8.855], // south coast
                        [115.170, -8.858], // Melasti Beach area
                        [115.150, -8.858], // south coast
                        [115.132, -8.855], // south coast heading west
                        [115.118, -8.852], // meets Nyang Nyang
                        B8,                // shared: red-orange south
                        B7,                // shared: red-orange mid
                        B6,                // shared: red-orange
                        B3                 // close
                    ]]
                }
            },
            {
                // GREEN — Affordable Budget: Jimbaran, Nusa Dua, Benoa, Ungasan
                // Entire northeast region
                type: 'Feature',
                properties: { zone: 'affordable', color: '#2ecc71', label: 'Affordable Budget' },
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [115.140, -8.770], // coast north of Balangan
                        [115.150, -8.762], // Honeymoon Beach area
                        [115.162, -8.755], // Jimbaran Bay south
                        [115.172, -8.750], // Jimbaran Bay
                        [115.185, -8.752], // Jimbaran east
                        [115.200, -8.757], // heading to Benoa
                        [115.218, -8.762], // Benoa peninsula
                        [115.235, -8.770], // Tanjung Benoa
                        [115.238, -8.788], // Nusa Dua north
                        [115.235, -8.808], // Nusa Dua east coast
                        [115.230, -8.825], // Nusa Dua south
                        [115.222, -8.838], // Sawangan Beach
                        B13,               // shared: orange-green Sawangan
                        B12,               // shared: orange-green Pandawa
                        B11,               // shared: orange-green
                        B10,               // shared: orange-green
                        B9,                // shared: orange-green
                        B4,                // shared: yellow-green-orange junction
                        B5,                // shared: yellow-green east
                        [115.140, -8.770]  // close
                    ]]
                }
            }
        ]
    };

    baliMap.addSource('zones', { type: 'geojson', data: zoneGeoJSON });

    // Add fills below markers but above base map
    baliMap.addLayer({
        id: 'zone-fills',
        type: 'fill',
        source: 'zones',
        paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.18
        }
    });

    baliMap.addLayer({
        id: 'zone-borders',
        type: 'line',
        source: 'zones',
        paint: {
            'line-color': ['get', 'color'],
            'line-width': 2.5,
            'line-opacity': 0.4,
            'line-dasharray': [5, 3]
        }
    });
}

function createMarkerElement(option) {
    const el = document.createElement('div');
    el.className = 'ml-marker';
    el.dataset.id = option.id;
    el.innerHTML = `
        <div class="marker-pin" style="--zone-color: ${option.zoneColor}">
            <div class="marker-dot"></div>
        </div>
        <div class="marker-label">${option.shortTitle}<br><span style="font-weight:400;color:var(--accent)">${getTotalInCurrency(option)}</span></div>
    `;
    return el;
}

function addMapMarkers() {
    mapMarkers = [];
    landOptions.forEach((option, i) => {
        if (!option.mapCoords) return;

        const el = createMarkerElement(option);

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([option.mapCoords.lng, option.mapCoords.lat])
            .addTo(baliMap);

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            showMapPopup(option);
            // Deselect all, select this
            document.querySelectorAll('.ml-marker').forEach(m => m.classList.remove('marker-active'));
            el.classList.add('marker-active');
        });

        mapMarkers.push({ marker, option, element: el, index: i });
    });
}

function animateMarkersIn() {
    mapMarkers.forEach((m, i) => {
        setTimeout(() => {
            m.element.classList.add('marker-visible');
        }, i * 60);
    });
}

function showMapPopup(option) {
    if (activePopup) activePopup.remove();

    const photoHtml = (option.photos && option.photos.length > 0)
        ? `<div class="map-popup-img" style="background-image:url('${option.photos[0]}')"></div>`
        : '';

    const popupContent = `
        <div class="map-popup">
            ${photoHtml}
            <div class="map-popup-body">
                <div class="map-popup-zone" style="background:${option.zoneColor}">${option.zone}</div>
                <h4>${option.title}</h4>
                <p>${formatArea(option.landSize)} &bull; ${option.ownership.split('(')[0].trim()}</p>
                <div class="map-popup-price">${getTotalInCurrency(option)}</div>
                <button class="map-popup-btn" onclick="viewDetail('${option.id}')">View Details &rarr;</button>
            </div>
        </div>
    `;

    activePopup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: '280px',
        offset: [0, -45],
        className: 'luxury-popup'
    })
    .setLngLat([option.mapCoords.lng, option.mapCoords.lat])
    .setHTML(popupContent)
    .addTo(baliMap);

    // Also update sidebar panel
    showMapInfo(option);
}

function showMapInfo(option) {
    const panel = document.getElementById('map-info-panel');
    const title = document.getElementById('map-info-title');
    const desc = document.getElementById('map-info-desc');
    const btn = document.getElementById('map-info-btn');

    title.textContent = option.title;
    desc.textContent = `${formatArea(option.landSize)} | ${option.zone} | ${getPricePerUnit(option)}/${getUnitLabel()}`;
    btn.dataset.id = option.id;
    panel.classList.remove('hidden');
}

function flyToPlot(optionId) {
    const option = landOptions.find(o => o.id === optionId);
    if (!option || !option.mapCoords) return;

    // Scroll to map section
    document.getElementById('map-section').scrollIntoView({ behavior: 'smooth' });

    setTimeout(() => {
        baliMap.flyTo({
            center: [option.mapCoords.lng, option.mapCoords.lat],
            zoom: 15,
            pitch: 40,
            duration: 2000,
            essential: true
        });

        setTimeout(() => {
            showMapPopup(option);
            // Highlight the marker
            document.querySelectorAll('.ml-marker').forEach(m => m.classList.remove('marker-active'));
            const markerEl = document.querySelector(`.ml-marker[data-id="${option.id}"]`);
            if (markerEl) markerEl.classList.add('marker-active');
        }, 2100);
    }, 500);
}

function highlightZone(zone) {
    // For legend clicks — zoom to zone area
    const zoneCenter = {
        'very-high': { center: [115.115, -8.802], zoom: 14 },
        'high': { center: [115.145, -8.832], zoom: 13 },
        'medium': { center: [115.150, -8.805], zoom: 13.5 },
        'affordable': { center: [115.195, -8.810], zoom: 12.5 }
    };
    const target = zoneCenter[zone];
    if (target && baliMap) {
        baliMap.flyTo({ ...target, duration: 1500, essential: true });
    }
}

// Refresh marker labels when currency/unit changes
function refreshMapMarkers() {
    mapMarkers.forEach(m => {
        const label = m.element.querySelector('.marker-label');
        if (label) {
            label.innerHTML = `${m.option.shortTitle}<br><span style="font-weight:400;color:var(--accent)">${getTotalInCurrency(m.option)}</span>`;
        }
    });
    // Refresh active popup if open
    if (activePopup && activePopup._lngLat) {
        const popupOption = landOptions.find(o =>
            o.mapCoords &&
            Math.abs(o.mapCoords.lng - activePopup._lngLat.lng) < 0.001 &&
            Math.abs(o.mapCoords.lat - activePopup._lngLat.lat) < 0.001
        );
        if (popupOption) showMapPopup(popupOption);
    }
}

// === Range Slider Logic ===
function initSliderBounds() {
    // Compute actual data ranges
    let maxSize = 0, maxPrice = 0, maxPsqm = 0;
    landOptions.forEach(o => {
        const totalUSD = getTotalPrice(o) * IDR_TO_USD;
        const psqmUSD = getPricePerSqm(o) * IDR_TO_USD;
        let size = o.landSize;
        let price = totalUSD;
        let psqm = psqmUSD;

        if (displayState.unit === 'sqft') {
            size = size * SQM_TO_SQFT;
            psqm = psqmUSD / SQM_TO_SQFT;
        }
        if (displayState.currency === 'AED') {
            price = getTotalPrice(o) * IDR_TO_AED;
            psqm = displayState.unit === 'sqft'
                ? getPricePerSqm(o) * IDR_TO_AED / SQM_TO_SQFT
                : getPricePerSqm(o) * IDR_TO_AED;
        }

        if (size > maxSize) maxSize = size;
        if (price > maxPrice) maxPrice = price;
        if (psqm > maxPsqm) maxPsqm = psqm;
    });

    // Round up to nice numbers
    maxSize = Math.ceil(maxSize / 1000) * 1000;
    maxPrice = Math.ceil(maxPrice / 500000) * 500000;
    maxPsqm = Math.ceil(maxPsqm / 100) * 100;

    sliderBounds.sizeMax = maxSize;
    sliderBounds.priceMax = maxPrice;
    sliderBounds.psqmMax = maxPsqm;

    // Update slider input attributes
    const sizeSlider = document.getElementById('slider-size');
    const priceSlider = document.getElementById('slider-price');
    const psqmSlider = document.getElementById('slider-psqm');

    if (sizeSlider) {
        sizeSlider.querySelector('.range-min').max = maxSize;
        sizeSlider.querySelector('.range-max').max = maxSize;
        sizeSlider.querySelector('.range-min').value = 0;
        sizeSlider.querySelector('.range-max').value = maxSize;
        sizeSlider.querySelector('.range-min').step = displayState.unit === 'sqft' ? 500 : 50;
        sizeSlider.querySelector('.range-max').step = displayState.unit === 'sqft' ? 500 : 50;
    }
    if (priceSlider) {
        priceSlider.querySelector('.range-min').max = maxPrice;
        priceSlider.querySelector('.range-max').max = maxPrice;
        priceSlider.querySelector('.range-min').value = 0;
        priceSlider.querySelector('.range-max').value = maxPrice;
        priceSlider.querySelector('.range-min').step = Math.max(10000, Math.round(maxPrice / 200));
        priceSlider.querySelector('.range-max').step = Math.max(10000, Math.round(maxPrice / 200));
    }
    if (psqmSlider) {
        psqmSlider.querySelector('.range-min').max = maxPsqm;
        psqmSlider.querySelector('.range-max').max = maxPsqm;
        psqmSlider.querySelector('.range-min').value = 0;
        psqmSlider.querySelector('.range-max').value = maxPsqm;
        psqmSlider.querySelector('.range-min').step = Math.max(1, Math.round(maxPsqm / 100));
        psqmSlider.querySelector('.range-max').step = Math.max(1, Math.round(maxPsqm / 100));
    }
}

function updateSlider(type) {
    const slider = document.getElementById(`slider-${type}`);
    if (!slider) return;
    const minInput = slider.querySelector('.range-min');
    const maxInput = slider.querySelector('.range-max');
    let minVal = parseFloat(minInput.value);
    let maxVal = parseFloat(maxInput.value);

    // Ensure min doesn't exceed max
    if (minVal > maxVal) {
        if (type === 'size' || type === 'price' || type === 'psqm') {
            const temp = minVal;
            minVal = maxVal;
            maxVal = temp;
        }
    }

    const rangeMax = parseFloat(maxInput.max);
    const fill = slider.querySelector('.range-fill');
    const left = (minVal / rangeMax) * 100;
    const right = (maxVal / rangeMax) * 100;
    fill.style.left = left + '%';
    fill.style.width = (right - left) + '%';

    // Update value labels
    const cs = displayState.currency;
    const sym = cs === 'AED' ? 'AED ' : '$';

    if (type === 'size') {
        const unit = displayState.unit === 'sqft' ? 'sqft' : 'sqm';
        document.getElementById('slider-size-min-val').textContent = Math.round(minVal).toLocaleString() + ' ' + unit;
        document.getElementById('slider-size-max-val').textContent = Math.round(maxVal).toLocaleString() + ' ' + unit;
    } else if (type === 'price') {
        document.getElementById('slider-price-min-val').textContent = sym + formatCompact(minVal);
        document.getElementById('slider-price-max-val').textContent = sym + formatCompact(maxVal);
    } else if (type === 'psqm') {
        document.getElementById('slider-psqm-min-val').textContent = sym + formatCompact(minVal);
        document.getElementById('slider-psqm-max-val').textContent = sym + formatCompact(maxVal);
    }

    applySliderFilters();
}

function formatCompact(num) {
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return Math.round(num / 1e3) + 'K';
    return Math.round(num).toLocaleString();
}

function applySliderFilters() {
    const sizeSlider = document.getElementById('slider-size');
    const priceSlider = document.getElementById('slider-price');
    const psqmSlider = document.getElementById('slider-psqm');

    if (sizeSlider) {
        const sMin = parseFloat(sizeSlider.querySelector('.range-min').value);
        const sMax = parseFloat(sizeSlider.querySelector('.range-max').value);
        activeFilters.landSizeMin = sMin > 0 ? sMin : null;
        activeFilters.landSizeMax = sMax < parseFloat(sizeSlider.querySelector('.range-max').max) ? sMax : null;
    }
    if (priceSlider) {
        const pMin = parseFloat(priceSlider.querySelector('.range-min').value);
        const pMax = parseFloat(priceSlider.querySelector('.range-max').value);
        activeFilters.priceMin = pMin > 0 ? pMin : null;
        activeFilters.priceMax = pMax < parseFloat(priceSlider.querySelector('.range-max').max) ? pMax : null;
    }
    if (psqmSlider) {
        const psMin = parseFloat(psqmSlider.querySelector('.range-min').value);
        const psMax = parseFloat(psqmSlider.querySelector('.range-max').value);
        activeFilters.pricePerSqmMin = psMin > 0 ? psMin : null;
        activeFilters.pricePerSqmMax = psMax < parseFloat(psqmSlider.querySelector('.range-max').max) ? psMax : null;
    }

    renderCards();
}

// === Get Filtered Options ===
function getFilteredOptions() {
    let filtered = landOptions;

    // Location filter
    if (activeFilters.location === 'freehold') {
        filtered = filtered.filter(o => o.ownership.toLowerCase().includes('freehold') || o.ownership.includes('SHM'));
    } else if (activeFilters.location !== 'all') {
        filtered = filtered.filter(o => o.filterTag === activeFilters.location);
    }

    // Land size range (in current display unit)
    if (activeFilters.landSizeMin !== null) {
        filtered = filtered.filter(o => {
            const size = displayState.unit === 'sqft' ? o.landSize * SQM_TO_SQFT : o.landSize;
            return size >= activeFilters.landSizeMin;
        });
    }
    if (activeFilters.landSizeMax !== null) {
        filtered = filtered.filter(o => {
            const size = displayState.unit === 'sqft' ? o.landSize * SQM_TO_SQFT : o.landSize;
            return size <= activeFilters.landSizeMax;
        });
    }

    // Total price range (in current currency)
    if (activeFilters.priceMin !== null) {
        filtered = filtered.filter(o => {
            const total = displayState.currency === 'AED'
                ? getTotalPrice(o) * IDR_TO_AED
                : getTotalPrice(o) * IDR_TO_USD;
            return total >= activeFilters.priceMin;
        });
    }
    if (activeFilters.priceMax !== null) {
        filtered = filtered.filter(o => {
            const total = displayState.currency === 'AED'
                ? getTotalPrice(o) * IDR_TO_AED
                : getTotalPrice(o) * IDR_TO_USD;
            return total <= activeFilters.priceMax;
        });
    }

    // Price per unit range (in current currency and unit)
    if (activeFilters.pricePerSqmMin !== null) {
        filtered = filtered.filter(o => {
            let psqm = getPricePerSqm(o);
            if (displayState.unit === 'sqft') psqm = psqm / SQM_TO_SQFT;
            const price = displayState.currency === 'AED' ? psqm * IDR_TO_AED : psqm * IDR_TO_USD;
            return price >= activeFilters.pricePerSqmMin;
        });
    }
    if (activeFilters.pricePerSqmMax !== null) {
        filtered = filtered.filter(o => {
            let psqm = getPricePerSqm(o);
            if (displayState.unit === 'sqft') psqm = psqm / SQM_TO_SQFT;
            const price = displayState.currency === 'AED' ? psqm * IDR_TO_AED : psqm * IDR_TO_USD;
            return price <= activeFilters.pricePerSqmMax;
        });
    }

    return filtered;
}

// === Reset Filters ===
function resetFilters() {
    activeFilters.location = 'all';
    activeFilters.landSizeMin = null;
    activeFilters.landSizeMax = null;
    activeFilters.priceMin = null;
    activeFilters.priceMax = null;
    activeFilters.pricePerSqmMin = null;
    activeFilters.pricePerSqmMax = null;

    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.filter-btn').classList.add('active');

    initSliderBounds();
    updateSlider('size');
    updateSlider('price');
    updateSlider('psqm');
    renderCards();
}

// === Render Cards ===
function renderCards() {
    const grid = document.getElementById('cards-grid');
    grid.innerHTML = '';

    const filtered = getFilteredOptions();

    const countEl = document.getElementById('results-count');
    if (filtered.length === landOptions.length) {
        countEl.innerHTML = `Showing all <strong>${landOptions.length}</strong> options`;
    } else {
        countEl.innerHTML = `Showing <strong>${filtered.length}</strong> of ${landOptions.length} options`;
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="no-results"><strong>No matching options</strong>Try adjusting your filter criteria</div>`;
        return;
    }

    filtered.forEach(option => {
        const hasPhoto = option.photos && option.photos.length > 0;

        const card = document.createElement('div');
        card.className = 'land-card';
        card.dataset.filter = option.filterTag;
        card.onclick = () => viewDetail(option.id);

        card.innerHTML = `
            <div class="card-header">
                ${hasPhoto
                    ? `<img src="${option.photos[0]}" alt="${option.title}" loading="lazy">`
                    : `<div class="card-header-placeholder">&#127965;</div>`
                }
                <span class="card-zone-badge" style="${getZoneColorStyle(option.zoneColor)}">${option.zone}</span>
                <span class="card-source-badge">${option.source}</span>
                ${option.mapCoords ? `<button class="card-map-btn" onclick="event.stopPropagation(); flyToPlot('${option.id}')" title="Show on map">📍</button>` : ''}
            </div>
            <div class="card-body">
                <div class="card-title">${option.title}</div>
                <div class="card-location">${option.location}</div>
                <div class="card-specs">
                    <div class="card-spec">
                        <span class="card-spec-label">Land Size</span>
                        <span class="card-spec-value">${formatArea(option.landSize)}</span>
                    </div>
                    <div class="card-spec">
                        <span class="card-spec-label">Ownership</span>
                        <span class="card-spec-value">${option.ownership.split('(')[0].trim()}</span>
                    </div>
                    <div class="card-spec">
                        <span class="card-spec-label">Road Access</span>
                        <span class="card-spec-value">${option.roadAccess || 'Available'}</span>
                    </div>
                    <div class="card-spec">
                        <span class="card-spec-label">Price/${getUnitLabel()}</span>
                        <span class="card-spec-value">${getPricePerUnit(option)}</span>
                    </div>
                </div>
                <div class="card-footer">
                    <div class="card-price">
                        ${getTotalInCurrency(option)}
                        <span class="card-price-sub">${formatIDR(getTotalPrice(option))} total</span>
                    </div>
                    <button class="card-cta">View Details</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// === Filter by Location ===
function filterCards(filter) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    activeFilters.location = filter;
    renderCards();
}

// === Comparison Table ===
function renderComparisonTable() {
    const tbody = document.getElementById('compare-tbody');
    tbody.innerHTML = '';

    landOptions.forEach(option => {
        const pricePerSqm = getPricePerSqm(option);
        const pricePerSqmUSD = pricePerSqm * IDR_TO_USD;
        const pricePerSqmAED = pricePerSqm * IDR_TO_AED;
        const totalUSD = getTotalPrice(option) * IDR_TO_USD;
        const pricePerAreDisplay = option.pricePerAre ? formatIDR(option.pricePerAre) : 'N/A';

        const tr = document.createElement('tr');
        tr.onclick = () => viewDetail(option.id);
        tr.innerHTML = `
            <td class="highlight">${option.shortTitle}</td>
            <td>${option.area}</td>
            <td><span class="zone-dot" style="background:${option.zoneColor}"></span>${option.zone.split('(')[0].trim()}</td>
            <td class="highlight">${formatArea(option.landSize)}</td>
            <td>${pricePerAreDisplay}</td>
            <td class="highlight">${getPricePerUnit(option)}</td>
            <td>${displayState.currency === 'AED' ? formatUSD(pricePerSqmUSD) : formatAED(pricePerSqmAED)}</td>
            <td class="highlight">${getTotalInCurrency(option)}</td>
            <td>${option.ownership.split('(')[0].trim()}</td>
        `;
        tbody.appendChild(tr);
    });
}

// === Detail Page ===
function viewDetail(id, skipPush) {
    const option = landOptions.find(o => o.id === id);
    if (!option) return;

    // Push URL state for direct linking & back button
    if (!skipPush) {
        history.pushState({ page: 'detail', id: id }, '', `/plot/${id}`);
    }

    document.getElementById('home-page').classList.add('hidden');
    document.getElementById('detail-page').classList.remove('hidden');
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    document.documentElement.style.scrollBehavior = 'smooth';

    const hero = document.getElementById('detail-hero');
    if (option.photos && option.photos.length > 0) {
        hero.style.background = `url('${option.photos[0]}') center/cover no-repeat`;
    } else {
        hero.style.background = 'linear-gradient(135deg, #1b2e1e, #2a4a30)';
    }

    document.getElementById('detail-badge').textContent = option.zone;
    document.getElementById('detail-badge').style.cssText = getZoneColorStyle(option.zoneColor);
    document.getElementById('detail-title').textContent = option.title;
    document.getElementById('detail-location').textContent = option.location;

    document.getElementById('detail-description').textContent = option.description;

    const specs = document.getElementById('detail-specs');
    const specItems = [
        { label: 'Land Size', value: `${option.landSize.toLocaleString()} sqm (${(option.landSize / 100).toFixed(1)} are) / ${Math.round(option.landSize * SQM_TO_SQFT).toLocaleString()} sqft` },
        { label: 'Ownership', value: option.ownership },
        { label: 'Zoning', value: option.zone },
        { label: 'Road Access', value: option.roadAccess || 'Available' },
    ];
    if (option.facing) specItems.push({ label: 'Facing', value: option.facing });
    if (option.frontWidth) specItems.push({ label: 'Front Width', value: option.frontWidth });
    if (option.shape) specItems.push({ label: 'Shape / Contour', value: option.shape });
    if (option.highlights) {
        specItems.push({ label: 'Key Highlights', value: option.highlights.join(', ') });
    }

    specs.innerHTML = specItems.map(s => `
        <div class="spec-item">
            <div class="spec-item-label">${s.label}</div>
            <div class="spec-item-value">${s.value}</div>
        </div>
    `).join('');

    const nearbySection = document.getElementById('detail-nearby-section');
    const nearbyList = document.getElementById('detail-nearby');
    if (option.nearby && option.nearby.length > 0) {
        nearbySection.classList.remove('hidden');
        nearbyList.innerHTML = option.nearby.map(n => `<li>${n}</li>`).join('');
    } else {
        nearbySection.classList.add('hidden');
    }

    const photosSection = document.getElementById('detail-photos-section');
    const photosGrid = document.getElementById('detail-photos');
    if (option.photos && option.photos.length > 0) {
        photosSection.classList.remove('hidden');
        photosGrid.innerHTML = option.photos.map(p =>
            `<img src="${p}" alt="${option.title}" onclick="openLightbox('${p}')">`
        ).join('');
    } else {
        photosSection.classList.add('hidden');
    }

    // Pricing — always show all 3 currencies
    const pricePerSqm = getPricePerSqm(option);
    const pricePerSqmUSD = pricePerSqm * IDR_TO_USD;
    const pricePerSqmAED = pricePerSqm * IDR_TO_AED;
    const pricePerSqft = pricePerSqmUSD / SQM_TO_SQFT;
    const totalIDR = getTotalPrice(option);
    const totalUSD = totalIDR * IDR_TO_USD;
    const totalAED = totalIDR * IDR_TO_AED;

    if (option.pricePerAre) {
        document.getElementById('detail-price-per-are').innerHTML =
            `${formatIDR(option.pricePerAre)}<span>per are (100 sqm)</span>`;
    } else {
        document.getElementById('detail-price-per-are').innerHTML =
            `${formatIDR(pricePerSqm)}<span>per sqm</span>`;
    }
    document.getElementById('detail-price-sqm-idr').textContent = formatIDR(pricePerSqm);
    document.getElementById('detail-price-sqm-usd').textContent = formatUSD(pricePerSqmUSD);
    document.getElementById('detail-price-sqm-aed').textContent = formatAED(pricePerSqmAED);
    document.getElementById('detail-price-sqft-usd').textContent = formatUSD(pricePerSqft);

    document.getElementById('detail-total-idr').textContent = formatIDR(totalIDR);
    document.getElementById('detail-total-usd').textContent = formatUSD(totalUSD);
    document.getElementById('detail-total-aed').textContent = formatAED(totalAED);

    const rentalSection = document.getElementById('detail-rental-section');
    if (option.rentalPrice) {
        rentalSection.classList.remove('hidden');
        document.getElementById('detail-rental').textContent = formatIDR(option.rentalPrice);
    } else {
        rentalSection.classList.add('hidden');
    }

    const mapCard = document.getElementById('detail-map-card');
    const gmapDiv = document.getElementById('detail-gmap');
    const gmapLink = document.getElementById('detail-gmap-link');

    if (option.mapCoords) {
        mapCard.classList.remove('hidden');
        const { lat, lng } = option.mapCoords;
        gmapDiv.innerHTML = `<iframe src="https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed" allowfullscreen loading="lazy"></iframe>`;
        if (option.mapLink) {
            gmapLink.href = option.mapLink;
            gmapLink.classList.remove('hidden');
        } else {
            gmapLink.href = `https://maps.google.com/?q=${lat},${lng}`;
            gmapLink.classList.remove('hidden');
        }
    } else if (option.mapLink) {
        mapCard.classList.remove('hidden');
        gmapDiv.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:14px;">Map available via link below</div>`;
        gmapLink.href = option.mapLink;
        gmapLink.classList.remove('hidden');
    } else {
        mapCard.classList.add('hidden');
    }

    document.getElementById('detail-source').textContent = option.source;
}

function showHome(event, skipPush) {
    if (event) event.preventDefault();
    if (!skipPush) {
        history.pushState({ page: 'home' }, '', '/');
    }
    document.getElementById('home-page').classList.remove('hidden');
    document.getElementById('detail-page').classList.add('hidden');
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    document.documentElement.style.scrollBehavior = 'smooth';
    // Resize map after container becomes visible again
    if (baliMap) setTimeout(() => baliMap.resize(), 150);
}

// === Lightbox ===
function openLightbox(src) {
    event.stopPropagation();
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    document.getElementById('lightbox').classList.add('hidden');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
});

// === Scroll navbar effect ===
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// === URL Routing ===
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.page === 'detail' && e.state.id) {
        viewDetail(e.state.id, true);
    } else {
        showHome(null, true);
    }
});

function handleInitialRoute() {
    const path = window.location.pathname;
    const match = path.match(/^\/plot\/(.+)$/);
    if (match) {
        const id = decodeURIComponent(match[1]);
        const option = landOptions.find(o => o.id === id);
        if (option) {
            history.replaceState({ page: 'detail', id: id }, '', `/plot/${id}`);
            viewDetail(id, true);
            return;
        }
    }
    // Default: show home
    history.replaceState({ page: 'home' }, '', window.location.pathname === '/' ? '/' : window.location.pathname);
}

// === Initialize ===
document.addEventListener('DOMContentLoaded', () => {
    // Init map with IntersectionObserver for animated entrance
    const mapSection = document.getElementById('map-section');
    const mapObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (!mapInitialized) {
                    initMap();
                    // Wait for map load then animate markers
                    baliMap.on('load', () => {
                        setTimeout(() => animateMarkersIn(), 300);
                    });
                } else {
                    animateMarkersIn();
                }
                mapObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });
    mapObserver.observe(mapSection);

    initSliderBounds();
    updateSlider('size');
    updateSlider('price');
    updateSlider('psqm');
    renderCards();
    renderComparisonTable();
    handleInitialRoute();
});
