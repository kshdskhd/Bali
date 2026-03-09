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

// === Render Map Pins ===
function renderMapPins() {
    const pinsGroup = document.getElementById('map-pins');
    pinsGroup.innerHTML = '';

    landOptions.forEach(option => {
        if (!option.mapPin) return;
        const { x, y } = option.mapPin;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('map-pin');
        g.setAttribute('data-id', option.id);
        g.onclick = () => showMapInfo(option);

        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('cx', x);
        ring.setAttribute('cy', y);
        ring.setAttribute('r', '12');
        ring.classList.add('map-pin-ring');

        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', x);
        dot.setAttribute('cy', y);
        dot.setAttribute('r', '6');
        dot.classList.add('map-pin-dot');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y - 18);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#2c3e50');
        text.setAttribute('font-size', '8');
        text.setAttribute('font-weight', '600');
        text.setAttribute('class', 'map-label');
        text.textContent = option.shortTitle;

        g.appendChild(ring);
        g.appendChild(dot);
        g.appendChild(text);
        pinsGroup.appendChild(g);
    });
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

function highlightZone(zone) {
    document.querySelectorAll('.zone').forEach(z => z.classList.remove('active'));
    const target = document.querySelector(`.zone[data-zone="${zone}"]`);
    if (target) target.classList.add('active');
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
    renderMapPins();
    initSliderBounds();
    updateSlider('size');
    updateSlider('price');
    updateSlider('psqm');
    renderCards();
    renderComparisonTable();
    handleInitialRoute();
});
