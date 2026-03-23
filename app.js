// === View State (active vs archive) ===
let currentView = 'active'; // 'active' or 'archive'

function getActiveData() {
    return currentView === 'archive' ? archivedLandOptions : landOptions;
}

function getAllData() {
    return [...landOptions, ...archivedLandOptions];
}

// Active filter button configs per view
const activeFilterButtons = [
    { label: 'All', tag: 'all' },
    { label: 'Bingin / Dreamland', tag: 'bingin' },
    { label: 'Pecatu / Uluwatu', tag: 'pecatu' },
    { label: 'Balangan', tag: 'balangan' },
    { label: 'Ungasan / Melasti', tag: 'ungasan' },
    { label: 'Pandawa', tag: 'pandawa' },
    { label: 'Freehold Only', tag: 'freehold' },
    { label: 'Leasehold Only', tag: 'leasehold' }
];

const archiveFilterButtons = [
    { label: 'All', tag: 'all' },
    { label: 'Ungasan', tag: 'ungasan' },
    { label: 'Pecatu / Uluwatu', tag: 'pecatu' },
    { label: 'Jimbaran', tag: 'jimbaran' },
    { label: 'Pandawa / Nusa Dua', tag: 'pandawa' },
    { label: 'Bingin', tag: 'bingin' },
    { label: 'Seminyak / Umalas', tag: 'seminyak' },
    { label: 'Freehold Only', tag: 'freehold' }
];

function switchView(view) {
    currentView = view;
    activeFilters.location = 'all';

    // Update tab buttons
    document.querySelectorAll('.view-tab').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase().includes(view === 'archive' ? 'archive' : 'current'));
    });

    // Update section title/subtitle
    const title = document.getElementById('listings-title');
    const subtitle = document.getElementById('listings-subtitle');
    if (view === 'archive') {
        title.textContent = 'Archived Land Options';
        subtitle.textContent = 'Previously listed plots — no longer actively marketed';
    } else {
        title.textContent = 'Available Land Options';
        subtitle.textContent = 'Browse all available plots for development';
    }

    // Rebuild filter buttons
    renderFilterButtons();

    // Re-init sliders and re-render
    mapInitialized = false;
    document.getElementById('map-container').innerHTML = '';
    initMap();
    setTimeout(() => animateMarkersIn(), 300);

    initSliderBounds();
    updateSlider('size');
    updateSlider('price');
    updateSlider('psqm');
    renderCards();
    renderComparisonTable();
}

function renderFilterButtons() {
    const container = document.getElementById('filter-row-location');
    const buttons = currentView === 'archive' ? archiveFilterButtons : activeFilterButtons;
    container.innerHTML = buttons.map((b, i) =>
        `<button class="filter-btn${i === 0 ? ' active' : ''}" onclick="filterCards('${b.tag}')">${b.label}</button>`
    ).join('');
}

function toggleArchive(event) {
    event.preventDefault();
    const newView = currentView === 'archive' ? 'active' : 'archive';
    switchView(newView);
    document.getElementById('listings').scrollIntoView({ behavior: 'smooth' });
}

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

// === Custom SVG Map ===
let mapMarkers = [];
let activePopup = null;
let activePopupOption = null;
let mapInitialized = false;

const MAP_BOUNDS = { west: 115.065, east: 115.245, north: -8.735, south: -8.865 };
const SVG_W = 1800, SVG_H = 1300;

function gpsToSvg(lng, lat) {
    return {
        x: (lng - MAP_BOUNDS.west) / (MAP_BOUNDS.east - MAP_BOUNDS.west) * SVG_W,
        y: (MAP_BOUNDS.north - lat) / (MAP_BOUNDS.north - MAP_BOUNDS.south) * SVG_H
    };
}

function gpsToPercent(lng, lat) {
    return {
        left: (lng - MAP_BOUNDS.west) / (MAP_BOUNDS.east - MAP_BOUNDS.west) * 100,
        top: (MAP_BOUNDS.north - lat) / (MAP_BOUNDS.north - MAP_BOUNDS.south) * 100
    };
}

function coordsToPoints(coords) {
    return coords.map(([lng, lat]) => { const p = gpsToSvg(lng, lat); return `${p.x},${p.y}`; }).join(' ');
}

function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
}

function initMap() {
    if (mapInitialized) return;
    mapInitialized = true;
    activePopup = null;
    activePopupOption = null;

    const container = document.getElementById('map-container');
    const svg = svgEl('svg', { viewBox: `0 0 ${SVG_W} ${SVG_H}`, id: 'svg-map', preserveAspectRatio: 'xMidYMid meet' });

    // Ocean background
    svg.appendChild(svgEl('rect', { width: SVG_W, height: SVG_H, fill: '#c8d8e4' }));

    // Land mass
    drawCoastline(svg);

    // Zone overlays
    addZoneOverlays(svg);

    // Place labels
    drawLabels(svg);

    container.appendChild(svg);

    // Pins layer (HTML overlay)
    const pinsLayer = document.createElement('div');
    pinsLayer.className = 'map-pins-layer';
    pinsLayer.id = 'map-pins-layer';
    container.appendChild(pinsLayer);

    addMapMarkers();

    // Click map background to dismiss popup
    svg.addEventListener('click', () => dismissPopup());
}

function drawCoastline(svg) {
    const coast = [
        [115.148, -8.738], [115.140, -8.752], [115.135, -8.762], [115.128, -8.772],
        [115.118, -8.778], [115.108, -8.785], [115.098, -8.792], [115.088, -8.800],
        [115.080, -8.812], [115.075, -8.825], [115.078, -8.838], [115.082, -8.848],
        [115.092, -8.855], [115.110, -8.860], [115.132, -8.858], [115.150, -8.860],
        [115.170, -8.858], [115.188, -8.855], [115.200, -8.852], [115.210, -8.845],
        [115.222, -8.838], [115.230, -8.825], [115.235, -8.808], [115.238, -8.788],
        [115.235, -8.770], [115.228, -8.760], [115.218, -8.752], [115.200, -8.746],
        [115.188, -8.741], [115.178, -8.738], [115.148, -8.738]
    ];
    svg.appendChild(svgEl('polygon', { points: coordsToPoints(coast), fill: '#f0ede6', stroke: '#d5d0c6', 'stroke-width': '2' }));
}

function addZoneOverlays(svg) {
    const B1=[115.122,-8.785], B2=[115.130,-8.795], B3=[115.132,-8.805],
          B4=[115.148,-8.798], B5=[115.160,-8.792], B6=[115.132,-8.818],
          B7=[115.110,-8.830], B8=[115.090,-8.845], B9=[115.150,-8.808],
          B10=[115.170,-8.818], B11=[115.172,-8.830], B12=[115.198,-8.840], B13=[115.210,-8.845];

    const zones = [
        { name:'very-high', color:'#e74c3c', coords:[
            [115.118,-8.778],B1,B2,B3,B6,B7,B8,[115.082,-8.852],[115.092,-8.848],
            [115.078,-8.838],[115.075,-8.825],[115.080,-8.812],[115.088,-8.800],
            [115.098,-8.792],[115.108,-8.785],[115.118,-8.778]] },
        { name:'medium', color:'#f1c40f', coords:[
            [115.118,-8.778],[115.128,-8.772],[115.140,-8.770],B5,B4,B3,B2,B1,[115.118,-8.778]] },
        { name:'high', color:'#e67e22', coords:[
            B3,B4,B9,B10,B11,B12,B13,[115.200,-8.852],[115.188,-8.855],[115.170,-8.858],
            [115.150,-8.858],[115.132,-8.855],[115.085,-8.852],B8,B7,B6,B3] },
        { name:'affordable', color:'#2ecc71', coords:[
            [115.140,-8.770],[115.150,-8.762],[115.162,-8.755],[115.172,-8.750],
            [115.185,-8.752],[115.200,-8.757],[115.218,-8.762],[115.235,-8.770],
            [115.238,-8.788],[115.235,-8.808],[115.230,-8.825],[115.222,-8.838],
            B13,B12,B11,B10,B9,B4,B5,[115.140,-8.770]] }
    ];

    const g = svgEl('g', { id: 'zone-overlays' });
    zones.forEach(z => {
        g.appendChild(svgEl('polygon', {
            points: coordsToPoints(z.coords), fill: z.color,
            'fill-opacity': '0.18', stroke: z.color, 'stroke-width': '2.5',
            'stroke-opacity': '0.4', 'stroke-dasharray': '10,6', 'data-zone': z.name
        }));
    });
    svg.appendChild(g);
}

function drawLabels(svg) {
    const labels = [
        { t:'Jimbaran', p:[115.175,-8.758], s:15, w:600 },
        { t:'Ungasan', p:[115.162,-8.820], s:14, w:600 },
        { t:'Pecatu', p:[115.125,-8.822], s:14, w:600 },
        { t:'Nusa Dua', p:[115.225,-8.800], s:14, w:600 },
        { t:'Bingin', p:[115.108,-8.795], s:12, w:500 },
        { t:'Uluwatu', p:[115.085,-8.832], s:12, w:500 },
        { t:'Pandawa', p:[115.188,-8.848], s:12, w:500 },
        { t:'Tanjung Benoa', p:[115.230,-8.770], s:11, w:400, c:'#8a8a80' },
        { t:'Balangan', p:[115.118,-8.775], s:10, w:400, c:'#8a8a80', i:true },
        { t:'Dreamland', p:[115.095,-8.790], s:10, w:400, c:'#8a8a80', i:true },
        { t:'Melasti', p:[115.155,-8.854], s:10, w:400, c:'#8a8a80', i:true },
        { t:'Padang Padang', p:[115.075,-8.808], s:10, w:400, c:'#8a8a80', i:true },
        { t:'Sawangan', p:[115.215,-8.840], s:10, w:400, c:'#8a8a80', i:true },
    ];
    const g = svgEl('g', { id: 'map-labels' });
    labels.forEach(l => {
        const { x, y } = gpsToSvg(l.p[0], l.p[1]);
        const txt = svgEl('text', {
            x, y, 'text-anchor': 'middle', 'font-family': "'DM Sans', sans-serif",
            'font-size': l.s, 'font-weight': l.w, fill: l.c || '#3d3d38', 'pointer-events': 'none'
        });
        if (l.i) txt.setAttribute('font-style', 'italic');
        txt.textContent = l.t;
        g.appendChild(txt);
    });
    svg.appendChild(g);
}

function createMarkerElement(option) {
    const el = document.createElement('div');
    el.className = 'map-pin-marker';
    el.dataset.id = option.id;
    el.innerHTML = `
        <div class="pin-head" style="--pin-color: ${option.zoneColor}">
            <div class="pin-inner"></div>
        </div>
        <div class="pin-label">${option.shortTitle}<br><span style="font-weight:400;color:var(--accent)">${getTotalInCurrency(option)}</span></div>
    `;
    return el;
}

function addMapMarkers() {
    const pinsLayer = document.getElementById('map-pins-layer');
    mapMarkers = [];
    getActiveData().forEach((option, i) => {
        if (!option.mapCoords) return;
        const el = createMarkerElement(option);
        const pos = gpsToPercent(option.mapCoords.lng, option.mapCoords.lat);
        el.style.left = pos.left + '%';
        el.style.top = pos.top + '%';
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            showMapPopup(option);
            document.querySelectorAll('.map-pin-marker').forEach(m => m.classList.remove('pin-active'));
            el.classList.add('pin-active');
        });
        pinsLayer.appendChild(el);
        mapMarkers.push({ option, element: el, index: i });
    });
}

function animateMarkersIn() {
    mapMarkers.forEach((m, i) => {
        setTimeout(() => m.element.classList.add('pin-visible'), i * 60);
    });
}

function dismissPopup() {
    if (activePopup) { activePopup.remove(); activePopup = null; activePopupOption = null; }
    document.querySelectorAll('.map-pin-marker').forEach(m => m.classList.remove('pin-active'));
}

function showMapPopup(option) {
    dismissPopup();
    const container = document.getElementById('map-container');
    const pos = gpsToPercent(option.mapCoords.lng, option.mapCoords.lat);
    const photoHtml = (option.photos && option.photos.length > 0)
        ? `<div class="map-popup-img" style="background-image:url('${option.photos[0]}')"></div>` : '';

    const popup = document.createElement('div');
    popup.className = 'map-popup-overlay';
    popup.id = 'active-map-popup';
    popup.style.left = pos.left + '%';
    popup.style.top = pos.top + '%';
    popup.innerHTML = `
        <div class="map-popup-card">
            <button class="popup-close" onclick="dismissPopup()">&times;</button>
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
    popup.addEventListener('click', (e) => e.stopPropagation());
    container.appendChild(popup);
    activePopup = popup;
    activePopupOption = option;
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
    const option = getActiveData().find(o => o.id === optionId);
    if (!option || !option.mapCoords) return;
    document.getElementById('map-section').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => {
        showMapPopup(option);
        document.querySelectorAll('.map-pin-marker').forEach(m => m.classList.remove('pin-active'));
        const markerEl = document.querySelector(`.map-pin-marker[data-id="${option.id}"]`);
        if (markerEl) markerEl.classList.add('pin-active');
    }, 600);
}

function highlightZone(zone) {
    document.querySelectorAll('#zone-overlays polygon').forEach(poly => {
        poly.setAttribute('fill-opacity', poly.dataset.zone === zone ? '0.35' : '0.08');
        poly.setAttribute('stroke-opacity', poly.dataset.zone === zone ? '0.8' : '0.2');
    });
    setTimeout(() => {
        document.querySelectorAll('#zone-overlays polygon').forEach(poly => {
            poly.setAttribute('fill-opacity', '0.18');
            poly.setAttribute('stroke-opacity', '0.4');
        });
    }, 3000);
}

function refreshMapMarkers() {
    mapMarkers.forEach(m => {
        const label = m.element.querySelector('.pin-label');
        if (label) {
            label.innerHTML = `${m.option.shortTitle}<br><span style="font-weight:400;color:var(--accent)">${getTotalInCurrency(m.option)}</span>`;
        }
    });
    if (activePopupOption) showMapPopup(activePopupOption);
}

// === Range Slider Logic ===
function initSliderBounds() {
    // Compute actual data ranges
    let maxSize = 0, maxPrice = 0, maxPsqm = 0;
    getActiveData().forEach(o => {
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
    let filtered = getActiveData();

    // Location filter
    if (activeFilters.location === 'freehold') {
        filtered = filtered.filter(o => o.ownership.toLowerCase().includes('freehold') || o.ownership.includes('SHM'));
    } else if (activeFilters.location === 'leasehold') {
        filtered = filtered.filter(o => o.ownership.toLowerCase().includes('leasehold'));
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

    const data = getActiveData();
    const countEl = document.getElementById('results-count');
    const viewLabel = currentView === 'archive' ? ' archived' : '';
    if (filtered.length === data.length) {
        countEl.innerHTML = `Showing all <strong>${data.length}</strong>${viewLabel} options`;
    } else {
        countEl.innerHTML = `Showing <strong>${filtered.length}</strong> of ${data.length}${viewLabel} options`;
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

    getActiveData().forEach(option => {
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
    const option = getAllData().find(o => o.id === id);
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
    // Dismiss any open popup when returning home
    dismissPopup();
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
        const option = getAllData().find(o => o.id === id);
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
    // Render filter buttons for initial view
    renderFilterButtons();

    // Init map with IntersectionObserver for animated entrance
    const mapSection = document.getElementById('map-section');
    const mapObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (!mapInitialized) {
                    initMap();
                    setTimeout(() => animateMarkersIn(), 300);
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
