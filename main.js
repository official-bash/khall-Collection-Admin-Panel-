// Application Reactive Core State memory storage
let sheetDataset = [];
let uniqueUcsList = [];
let activeSelectedUc = null;
let currentLanguage = localStorage.getItem('khal_app_lang') || 'en';

// ─── Navigation History Stack ──────────────────────────────────────────────
// Each entry: { tab: 'home'|'addLocation'|'nearest', ucName: null|string }
let navHistoryStack = [];
let isNavigatingBack = false; // guard to avoid push during popstate

// Life Cycle Hook Initialization
window.addEventListener('DOMContentLoaded', () => {
    applyLanguage();
    fetchDatasetFromGoogleSheet();

    // Push initial dummy state so back-button has something to pop to
    history.pushState({ nav: 'home', uc: null }, '', window.location.href);
});

// Intercept browser / device back button
window.addEventListener('popstate', (event) => {
    // If there's history in our stack, go back in-app
    if (navHistoryStack.length > 0) {
        // Re-push so the browser URL state stays the same (single-page app)
        history.pushState({ nav: 'current' }, '', window.location.href);

        const prev = navHistoryStack.pop();
        isNavigatingBack = true;

        if (prev.tab === 'home') {
            if (prev.uc) {
                // Go back to a UC detail view
                activeSelectedUc = null; // reset so switchTab doesn't interfere
                _showHomeTab();
                handleUcCardClick(prev.uc);
            } else {
                // Go back to the UC grid
                activeSelectedUc = null;
                _showHomeTab();
                backToUcGrid();
            }
        } else if (prev.tab === 'addLocation') {
            activeSelectedUc = null;
            _applyTabSwitch('addLocation');
        } else if (prev.tab === 'nearest') {
            activeSelectedUc = null;
            _showHomeTab();
        }

        isNavigatingBack = false;
    } else {
        // Nothing in our stack – let the browser handle it (exits PWA / closes tab)
        // Do nothing extra — natural behaviour
    }
});

// Header sticky scroll shadow effect
window.addEventListener('scroll', () => {
    const header = document.querySelector('.app-header');
    if (header) {
        if (window.scrollY > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
});

// Toggle Application Language Setting
function toggleLanguage() {
    currentLanguage = currentLanguage === 'ur' ? 'en' : 'ur';
    localStorage.setItem('khal_app_lang', currentLanguage);
    applyLanguage();
}

// Apply selected language translations recursively
function applyLanguage() {
    const isUrdu = currentLanguage === 'ur';
    document.documentElement.dir = isUrdu ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLanguage;

    // Adjust main font weight and family dynamically
    if (isUrdu) {
        document.body.classList.remove('font-sans');
        document.body.classList.add('font-nastaliq');
    } else {
        document.body.classList.remove('font-nastaliq');
        document.body.classList.add('font-sans');
    }

    // Update Page Title
    document.title = i18n[currentLanguage].title;

    // Simple text labels translation
    document.getElementById('headerTitle').innerText = i18n[currentLanguage].dashboardTitle;
    document.getElementById('headerSub').innerText = i18n[currentLanguage].townName;
    document.getElementById('totalPointsLabel').innerText = i18n[currentLanguage].totalPoints + ": ";
    document.getElementById('spinnerLoadingText').innerText = i18n[currentLanguage].loading;

    // Search Bar i18n
    document.getElementById('omniSearchInput').placeholder = i18n[currentLanguage].searchPlaceholder;
    document.getElementById('ucSectionHeading').innerText = i18n[currentLanguage].ucSectionHeader;
    document.getElementById('backToUcsBtn').innerText = i18n[currentLanguage].backToUcs;
    document.getElementById('nearestBtnLabel').innerText = i18n[currentLanguage].nearestBtn;

    // Form Content i18n
    document.getElementById('formTitleText').innerText = i18n[currentLanguage].formTitle;
    document.getElementById('formSubtitleText').innerText = i18n[currentLanguage].formSubtitle;
    document.getElementById('formUcSelectLabel').innerText = i18n[currentLanguage].selectUcLabel;
    document.getElementById('formSrNoSelectLabel').innerText = i18n[currentLanguage].selectPointLabel;
    document.getElementById('formMapUrlInputLabel').innerText = i18n[currentLanguage].mapLinkLabel;
    document.getElementById('formPasswordInputLabel').innerText = i18n[currentLanguage].securityLabel;
    document.getElementById('formPasswordInput').placeholder = i18n[currentLanguage].securityPlaceholder;
    document.getElementById('formSubmitBtnLabel').innerText = i18n[currentLanguage].submitBtn;

    // Poster dynamic translations
    document.getElementById('posterMainTitle').innerText = i18n[currentLanguage].posterTitle;
    document.getElementById('posterSubTitle').innerText = i18n[currentLanguage].posterSubtitle;
    document.getElementById('posterBrandTitle').innerText = i18n[currentLanguage].posterDawat;
    document.getElementById('posterActionTitle').innerText = i18n[currentLanguage].posterCall;
    document.getElementById('posterFooterText').innerText = i18n[currentLanguage].posterFooter;

    // Language Toggle Text Update
    document.getElementById('langText').innerText = isUrdu ? 'English' : 'اردو';

    // Navbar Labels Update
    document.getElementById('navHomeLabel').innerText = isUrdu ? 'ہوم' : 'Home';
    document.getElementById('navAddLabel').innerText = isUrdu ? 'لوکیشن' : 'Add Link';
    document.getElementById('navNearestLabel').innerText = isUrdu ? 'قریبی' : 'Nearest';

    // Re-render components with translated static attributes
    if (sheetDataset.length > 0) {
        renderUcCardsGrid(uniqueUcsList);
        populateFormUcDropdowns();
        if (activeSelectedUc) {
            handleUcCardClick(activeSelectedUc);
        } else {
            const query = document.getElementById('omniSearchInput').value.trim();
            if (query) {
                handleSearch();
            }
        }
    }
}

// Fetch primary campaign list from App Script Endpoint securely (using GET action)
function fetchDatasetFromGoogleSheet() {
    if (API_URL.includes("YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE")) {
        showToast(i18n[currentLanguage].setupIncomplete, "error");
        document.getElementById('appSpinner').innerHTML = `<div class="empty-state" style="color: var(--clr-secondary); font-weight: 800;">${i18n[currentLanguage].configError}</div>`;
        return;
    }

    const url = API_URL + "?action=getData";

    fetch(url, { redirect: 'follow' })
    .then(response => {
        if (!response.ok) {
            throw new Error("HTTP error: " + response.status);
        }
        return response.text();
    })
    .then(text => {
        let payload;
        try {
            payload = JSON.parse(text);
        } catch (parseErr) {
            console.error("JSON Parse Error. Raw response:", text.substring(0, 500));
            throw new Error("سرور سے غیر متوقع جواب آیا۔ / Unexpected response from server.");
        }

        if(payload.status === "success") {
            sheetDataset = payload.data;
            document.getElementById('totalPointsBadge').innerText = sheetDataset.length;
            
            // Compile unique list of UCs
            updateUcList();

            // Render UI components asynchronously
            document.getElementById('appSpinner').classList.add('hidden');
            switchTab('home');
            renderUcCardsGrid(uniqueUcsList);
            populateFormUcDropdowns();
        } else {
            throw new Error(payload.message || "Unknown error from Apps Script");
        }
    })
    .catch(err => {
        console.error("Critical Fetch Error: ", err);
        showToast(i18n[currentLanguage].connectionError, "error");
        document.getElementById('appSpinner').innerHTML = `<div class="empty-state" style="color: var(--clr-secondary); font-weight: 800;">${err.message || i18n[currentLanguage].connectionError}</div>`;
    });
}

// Compile unique UC list based on current language
function updateUcList() {
    const allUcs = sheetDataset.map(row => {
        if (currentLanguage === 'ur') {
            return row["یو سی"] ? row["یو سی"].trim() : "";
        } else {
            return (row["uc"] || row["یو سی"] || "").trim();
        }
    }).filter(Boolean);
    uniqueUcsList = [...new Set(allUcs)];
}

// Render Homepage UC Category Cards UI elements
function renderUcCardsGrid(ucs) {
    const gridContainer = document.getElementById('ucCardGrid');
    gridContainer.innerHTML = '';

    // Ensure the unique list matches the language preference
    updateUcList();

    uniqueUcsList.forEach((ucName, index) => {
        const hubsCount = sheetDataset.filter(row => {
            const rowUc = currentLanguage === 'ur'
                ? (row["یو سی"] || "")
                : (row["uc"] || row["یو سی"] || "");
            return rowUc.trim() === ucName.trim();
        }).length;

        const cardNode = document.createElement('div');
        const staggerClass = index < 12 ? ` stagger-${(index % 12) + 1}` : '';
        cardNode.className = `uc-card${staggerClass}`;
        cardNode.onclick = () => handleUcCardClick(ucName);
        cardNode.innerHTML = `
            <div class="uc-card-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px;">
                    <path d="M3 21h18M9 21V9a3 3 0 0 1 6 0v12M4 21V12a2 2 0 0 1 2-2h3M20 21V12a2 2 0 0 0-2-2h-3"/>
                </svg>
            </div>
            <h3 class="uc-card-title">${ucName}</h3>
            <span class="uc-card-badge">${hubsCount} ${i18n[currentLanguage].pointsCount}</span>
        `;
        gridContainer.appendChild(cardNode);
    });
    document.getElementById('ucGridSection').classList.remove('hidden');
}

// Handler triggering deep drill list display
function handleUcCardClick(ucName) {
    // Push current state before drilling down
    _pushNav({ tab: 'home', uc: null });

    activeSelectedUc = ucName;
    document.getElementById('ucGridSection').classList.add('hidden');
    
    // Extract the filtered points under the selected UC
    const filteredPoints = sheetDataset.filter(row => {
        const rowUc = currentLanguage === 'ur'
            ? (row["یو سی"] || "")
            : (row["uc"] || row["یو سی"] || "");
        return rowUc.trim() === ucName.trim();
    });
    document.getElementById('pointsSectionHeader').innerText = `${i18n[currentLanguage].pointsListHeader}: ${ucName}`;
    
    renderPointsListMarkup(filteredPoints);
}

// Return state machine focus tracking view frame context
function backToUcGrid() {
    document.getElementById('pointsListSection').classList.add('hidden');
    document.getElementById('ucGridSection').classList.remove('hidden');
    document.getElementById('omniSearchInput').value = '';
    document.getElementById('searchStats').classList.add('hidden');
    activeSelectedUc = null;
    
    // Reset active nav tab state to home
    const navHome = document.getElementById('navHomeBtn');
    const navNearest = document.getElementById('navNearestBtn');
    if (navHome) navHome.classList.add('active');
    if (navNearest) navNearest.classList.remove('active');
}

// Parse coordinates out of standard Google Maps URLs
function parseCoordsFromUrl(url) {
    if (!url) return null;
    
    // Pattern 1: @lat,lng
    let match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) {
        return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    // Pattern 2: q=lat,lng or query=lat,lng
    match = url.match(/[?&](q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) {
        return { lat: parseFloat(match[2]), lng: parseFloat(match[3]) };
    }

    // Pattern 3: any sequence of "lat,lng" floats
    match = url.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && lat !== 0 && lng !== 0) {
            return { lat, lng };
        }
    }
    return null;
}

// Haversine Distance formula implementation
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

// Geolocation Proximity Engine
function findNearestPoints() {
    // Push current state before switching to nearest
    _pushNav(_getCurrentNavState());

    const navHome = document.getElementById('navHomeBtn');
    const navAdd = document.getElementById('navAddBtn');
    const navNearest = document.getElementById('navNearestBtn');
    if (navHome) navHome.classList.remove('active');
    if (navAdd) navAdd.classList.remove('active');
    if (navNearest) navNearest.classList.add('active');

    // Always ensure home tab is visible (fixes bug when called from addLocation tab)
    const homeScreen = document.getElementById('homeTabScreen');
    const addLocScreen = document.getElementById('addLocationTabScreen');
    homeScreen.classList.remove('hidden');
    addLocScreen.classList.add('hidden');
    activeSelectedUc = null;

    if (!navigator.geolocation) {
        showToast(i18n[currentLanguage].gpsUnsupported, "error");
        if (navHome) navHome.classList.add('active');
        if (navNearest) navNearest.classList.remove('active');
        return;
    }

    showToast(i18n[currentLanguage].gpsAcquiring, "info");

    navigator.geolocation.getCurrentPosition(position => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        // Calculate distance to all points containing coordinates
        const pointsWithDistance = sheetDataset.map(point => {
            let coords = null;
            if (point["cordinates"]) {
                coords = parseCoordsFromUrl(point["cordinates"].trim());
            }
            if (!coords && point["Google Map Link"]) {
                coords = parseCoordsFromUrl(point["Google Map Link"].trim());
            }
            if (coords) {
                const distance = calculateDistance(userLat, userLng, coords.lat, coords.lng);
                return { ...point, distance };
            }
            return { ...point, distance: Infinity };
        }).filter(point => point.distance !== Infinity);

        if (pointsWithDistance.length === 0) {
            showToast(i18n[currentLanguage].noCoordsPoints, "error");
            if (navHome) navHome.classList.add('active');
            if (navNearest) navNearest.classList.remove('active');
            return;
        }

        // Sort points by distance ascending
        pointsWithDistance.sort((a, b) => a.distance - b.distance);

        // Get top 5 closest points
        const nearestPoints = pointsWithDistance.slice(0, 5);

        // Show results in the home tab's points list
        document.getElementById('ucGridSection').classList.add('hidden');
        document.getElementById('pointsListSection').classList.remove('hidden');
        document.getElementById('pointsSectionHeader').innerText = i18n[currentLanguage].nearestPointsHeader;

        renderPointsListMarkup(nearestPoints, true);
    }, error => {
        console.error("Geolocation Error: ", error);
        let msg = i18n[currentLanguage].gpsError;
        if (error.code === error.PERMISSION_DENIED) {
            msg = i18n[currentLanguage].gpsDenied;
        }
        showToast(msg, "error");
        
        // Fall back to manual UC search
        _showHomeTab();
        backToUcGrid();
        
        const searchInput = document.getElementById('omniSearchInput');
        if (searchInput) {
            searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            searchInput.focus();
        }
    }, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
    });
}

// Render localized detailed point components cards lists layout grid system
function renderPointsListMarkup(pointsList, showDistance = false) {
    const listContainer = document.getElementById('pointsContainerList');
    listContainer.innerHTML = '';

    if (pointsList.length === 0) {
        listContainer.innerHTML = `<p class="empty-state">${i18n[currentLanguage].noPoints}</p>`;
        document.getElementById('pointsListSection').classList.remove('hidden');
        return;
    }

    pointsList.forEach((point, index) => {
        let mapLink = point["Google Map Link"] ? point["Google Map Link"].trim() : "";
        if (!mapLink && point["cordinates"]) {
            const cleanCoords = point["cordinates"].trim();
            if (/^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(cleanCoords)) {
                mapLink = "https://maps.google.com/?q=" + cleanCoords;
            } else if (cleanCoords.startsWith("http://") || cleanCoords.startsWith("https://")) {
                mapLink = cleanCoords;
            }
        }
        const cleanPhone = point["موبائل نمبر"] ? point["موبائل نمبر"].replace(/[^0-9]/g, "") : "";
        const srNo = point["نمبر شمار"];
        
        // Get bilingual UC name
        const ucName = currentLanguage === 'ur'
            ? (point["یو سی"] || "")
            : (point["uc"] || point["یو سی"] || "");

        // Get bilingual Point Name
        const pointName = currentLanguage === 'ur'
            ? (point["پوائنٹ کا نام"] || point["Point Name"] || `پوائنٹ #${srNo}`)
            : (point["Point Name"] || point["پوائنٹ کا نام"] || `Point #${srNo}`);

        // Get bilingual Point Responsible
        const responsiblePerson = currentLanguage === 'ur'
            ? (point["پوائنٹ ذمہ دار"] || "")
            : (point["Point responsible"] || point["پوائنٹ ذمہ دار"] || "");

        // Get bilingual Point Address
        const address = currentLanguage === 'ur' 
            ? (point["پوائنٹ کا ایڈریس"] || point["location points"] || '') 
            : (point["location points"] || point["پوائنٹ کا ایڈریس"] || '');

        // Setup dynamic distance badges
        let distanceBadgeMarkup = '';
        if (showDistance && point.distance !== undefined && point.distance !== Infinity) {
            const isClosest = index === 0;
            const distanceClass = isClosest ? 'badge-distance closest' : 'badge-distance normal';
            const badgeText = isClosest ? `${i18n[currentLanguage].closestBadge} | ` : '';
            
            let distanceStr = '';
            if (point.distance < 1) {
                const meters = Math.round(point.distance * 1000);
                distanceStr = `${meters} ${i18n[currentLanguage].meters}`;
            } else {
                distanceStr = `${point.distance.toFixed(1)} ${i18n[currentLanguage].kilometers}`;
            }
            
            distanceBadgeMarkup = `
                <span class="${distanceClass}">
                    📍 ${badgeText} ${distanceStr} ${i18n[currentLanguage].away}
                </span>`;
        }

        const pointCard = document.createElement('div');
        const staggerClass = index < 12 ? ` stagger-${(index % 12) + 1}` : '';
        pointCard.className = `point-card${staggerClass}`;
        
        let mapBtnMarkup = '';
        if (mapLink) {
            const mapBtnText = i18n[currentLanguage].getDirections || i18n[currentLanguage].mapBtn;
            mapBtnMarkup = `
                <a href="${mapLink}" target="_blank" class="btn btn-map btn-flex">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                        <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
                    </svg>
                    ${mapBtnText}
                </a>`;
        } else {
            mapBtnMarkup = `
                <button onclick="triggerDirectAddLocationLink('${ucName}', '${srNo}')" class="btn btn-add-map btn-flex">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    ${i18n[currentLanguage].addMapBtn}
                </button>`;
        }

        pointCard.innerHTML = `
            <div class="point-card-header">
                <div class="point-card-badges">
                    <span class="badge-serial">${i18n[currentLanguage].serial} #${srNo}</span>
                    <span class="badge-uc">${ucName}</span>
                </div>
                ${distanceBadgeMarkup}
            </div>
            <h4 class="point-card-name">${pointName}</h4>
            
            <div class="point-card-info">
                <div class="point-info-row">
                    <span class="point-info-label">${currentLanguage === 'ur' ? 'پتہ:' : 'Address:'}</span> 
                    <span class="point-info-value">${address}</span>
                </div>
                <div class="point-info-row">
                    <span class="point-info-label">${i18n[currentLanguage].responsible}:</span> 
                    <span class="point-info-value">${responsiblePerson}</span>
                </div>
                <div class="point-info-row" dir="ltr">
                    <span class="point-info-label">📞 :</span>
                    <span class="point-info-value">${point["موبائل نمبر"]}</span>
                </div>
            </div>

            <div class="point-card-actions">
                ${mapBtnMarkup}
                <a href="https://wa.me/${cleanPhone}" target="_blank" class="btn btn-whatsapp btn-flex">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.458L0 24zm6.59-3.559c1.674.993 3.336 1.488 5.275 1.489 5.626 0 10.201-4.577 10.204-10.203.002-2.723-1.054-5.283-2.977-7.207C17.228 2.597 14.673 1.54 11.95 1.539 6.323 1.539 1.75 6.117 1.748 11.743c-.001 1.99.52 3.84 1.514 5.461l-.993 3.627 3.778-.99zm11.378-7.7c-.3-.15-1.774-.875-2.049-.976-.276-.1-.476-.15-.676.15-.2.3-.775.976-.95 1.176-.175.2-.35.225-.65.075-.3-.15-1.267-.467-2.413-1.49-.893-.797-1.496-1.78-1.672-2.08-.175-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.676-1.625-.926-2.225-.244-.589-.491-.51-.676-.519-.174-.008-.374-.01-.574-.01-.2 0-.525.075-.8.375-.275.3-1.05 1.025-1.05 2.5s1.075 2.9 1.225 3.1c.15.2 2.115 3.23 5.124 4.53.716.31 1.274.495 1.71.635.72.23 1.375.197 1.894.12.577-.087 1.774-.725 2.024-1.425.25-.7.25-1.3 1.75-1.425-.075-.125-.275-.2-.575-.35z"/>
                    </svg>
                    ${i18n[currentLanguage].whatsappBtn}
                </a>
                <button onclick="openShareModal('${point["نمبر شمار"]}')" class="btn btn-share" title="${i18n[currentLanguage].shareBtn}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v16"/>
                    </svg>
                    <span>${i18n[currentLanguage].shareBtn}</span>
                </button>
            </div>
        `;
        listContainer.appendChild(pointCard);
    });

    document.getElementById('pointsListSection').classList.remove('hidden');
}

// Global Omni Database Search logic calculation
function handleSearch() {
    const query = document.getElementById('omniSearchInput').value.trim().toLowerCase();
    const statsContainer = document.getElementById('searchStats');
    
    if (!query) {
        statsContainer.classList.add('hidden');
        if (activeSelectedUc) {
            handleUcCardClick(activeSelectedUc);
        } else {
            backToUcGrid();
        }
        return;
    }

    const hits = sheetDataset.filter(row => {
        const addressUrdu = (row["پوائنٹ کا ایڈریس"] || "").toLowerCase();
        const addressEnglish = (row["location points"] || "").toLowerCase();
        const zimadarName = (row["پوائنٹ ذمہ دار"] || "").toLowerCase();
        const zimadarNameEnglish = (row["Point responsible"] || "").toLowerCase();
        const ucCell = (row["یو سی"] || "").toLowerCase();
        const ucCellEnglish = (row["uc"] || "").toLowerCase();
        
        return addressUrdu.includes(query) || 
               addressEnglish.includes(query) || 
               zimadarName.includes(query) ||
               zimadarNameEnglish.includes(query) ||
               ucCell.includes(query) ||
               ucCellEnglish.includes(query);
    });

    document.getElementById('ucGridSection').classList.add('hidden');
    document.getElementById('pointsSectionHeader').innerText = `${i18n[currentLanguage].searchResults} (${hits.length} ${i18n[currentLanguage].foundPoints})`;
    
    let summaryText = i18n[currentLanguage].searchSummary
        .replace("{total}", sheetDataset.length)
        .replace("{count}", hits.length);

    statsContainer.innerText = summaryText;
    statsContainer.classList.remove('hidden');

    renderPointsListMarkup(hits);
}

// Contextual Quick shortcut bridge route map linking to update menu option
function triggerDirectAddLocationLink(ucName, srNo) {
    // Push current home/UC state before jumping to addLocation
    _pushNav(_getCurrentNavState());
    _applyTabSwitch('addLocation');
    document.getElementById('formUcSelect').value = ucName;
    populateFormSerialNumbers();
    document.getElementById('formSrNoSelect').value = srNo;
    
    showToast(i18n[currentLanguage].toastAutoSelected, "info");
}

// Dynamic select dropdown option populate mapping matrix
function populateFormUcDropdowns() {
    const ucDropdown = document.getElementById('formUcSelect');
    ucDropdown.innerHTML = `<option value="">${i18n[currentLanguage].selectUcDefault}</option>`;

    uniqueUcsList.forEach(uc => {
        const opt = document.createElement('option');
        opt.value = uc;
        opt.innerText = uc;
        ucDropdown.appendChild(opt);
    });
}

// Populate nested conditional dropdown based on selected parent category list
function populateFormSerialNumbers() {
    const selectedUc = document.getElementById('formUcSelect').value;
    const srDropdown = document.getElementById('formSrNoSelect');
    srDropdown.innerHTML = `<option value="">${i18n[currentLanguage].selectPointDefault}</option>`;

    if (!selectedUc) return;

    const missingMapPoints = sheetDataset.filter(row => {
        const rowUc = currentLanguage === 'ur'
            ? (row["یو سی"] || "")
            : (row["uc"] || row["یو سی"] || "");
        const isMatch = rowUc.trim() === selectedUc.trim();
        const hasNoMap = (!row["Google Map Link"] || row["Google Map Link"].trim() === "") && 
                         (!row["cordinates"] || row["cordinates"].trim() === "");
        return isMatch && hasNoMap;
    });

    if (missingMapPoints.length === 0) {
        srDropdown.innerHTML = `<option value="">${i18n[currentLanguage].allPointsUpdated}</option>`;
        return;
    }

    missingMapPoints.forEach(point => {
        const opt = document.createElement('option');
        opt.value = point["نمبر شمار"];
        const address = currentLanguage === 'ur' 
            ? (point["پوائنٹ کا ایڈریس"] || point["location points"] || '')
            : (point["location points"] || point["پوائنٹ کا ایڈریس"] || '');
        opt.innerText = `${i18n[currentLanguage].serial} ${point["نمبر شمار"]} - ${address}`;
        srDropdown.appendChild(opt);
    });
}

// Submit form parameters using GET action
function submitLocationUpdate() {
    const uc = document.getElementById('formUcSelect').value;
    const srNo = document.getElementById('formSrNoSelect').value;
    const userInput = document.getElementById('formMapUrlInput').value.trim();
    const password = document.getElementById('formPasswordInput').value.trim();

    if (!uc || !srNo || !userInput || !password) {
        showToast(i18n[currentLanguage].toastAllFields, "error");
        return;
    }

    // Find the selected point row in our dataset using unique Serial Number
    const targetPoint = sheetDataset.find(row => String(row["نمبر شمار"]) === String(srNo));
    if (!targetPoint) {
        showToast("پوائنٹ نہیں ملا / Point not found", "error");
        return;
    }

    // Always send the canonical Urdu UC name to the Apps Script to match the spreadsheet cell exactly
    const canonicalUc = targetPoint["یو سی"] || uc;

    const isRawCoords = /^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(userInput);
    const isUrl = userInput.startsWith("http://") || userInput.startsWith("https://");

    if (!isRawCoords && !isUrl) {
        showToast(i18n[currentLanguage].toastValidUrl, "error");
        return;
    }

    let mapLinkParam = "";
    let cordinatesParam = "";

    if (isRawCoords) {
        cordinatesParam = userInput;
        mapLinkParam = "https://maps.google.com/?q=" + userInput;
    } else {
        mapLinkParam = userInput;
        const parsed = parseCoordsFromUrl(userInput);
        if (parsed) {
            cordinatesParam = `${parsed.lat},${parsed.lng}`;
        }
    }

    document.getElementById('appSpinner').classList.remove('hidden');
    document.getElementById('addLocationTabScreen').classList.add('opacity-40', 'pointer-events-none');

    // Constructing clean query params for GET request
    const updateUrl = API_URL
        + "?action=updateLocation"
        + "&uc=" + encodeURIComponent(canonicalUc)
        + "&srNo=" + encodeURIComponent(srNo)
        + "&mapLink=" + encodeURIComponent(mapLinkParam)
        + "&cordinates=" + encodeURIComponent(cordinatesParam)
        + "&password=" + encodeURIComponent(password);

    fetch(updateUrl, { redirect: 'follow' })
    .then(res => {
        if (!res.ok) throw new Error("HTTP error: " + res.status);
        return res.text();
    })
    .then(text => {
        let response;
        try {
            response = JSON.parse(text);
        } catch (e) {
            console.error("JSON Parse Error on update. Raw:", text.substring(0, 500));
            throw new Error("سرور سے غیر متوقع جواب آیا۔ / Unexpected server response.");
        }
        document.getElementById('appSpinner').classList.add('hidden');
        document.getElementById('addLocationTabScreen').classList.remove('opacity-40', 'pointer-events-none');

        if (response.status === "success") {
            showToast(i18n[currentLanguage].toastUpdated, "success");
            document.getElementById('formMapUrlInput').value = '';
            document.getElementById('formPasswordInput').value = '';
            fetchDatasetFromGoogleSheet();
        } else {
            showToast(response.message || "اپڈیٹ کرنے میں خرابی آئی ہے / Error updating location", "error");
        }
    })
    .catch(err => {
        console.error(err);
        document.getElementById('appSpinner').classList.add('hidden');
        document.getElementById('addLocationTabScreen').classList.remove('opacity-40', 'pointer-events-none');
        showToast(i18n[currentLanguage].connectionError, "error");
    });
}

// ─── Internal Navigation Helpers ──────────────────────────────────────────

// Push a state onto the in-app history stack (skipped during back navigation)
function _pushNav(state) {
    if (isNavigatingBack) return;
    navHistoryStack.push(state);
    // Keep stack bounded
    if (navHistoryStack.length > 30) navHistoryStack.shift();
}

// Read the current navigation state for pushing before a transition
function _getCurrentNavState() {
    const homeScreen = document.getElementById('homeTabScreen');
    const addLocScreen = document.getElementById('addLocationTabScreen');
    if (!addLocScreen.classList.contains('hidden')) {
        return { tab: 'addLocation', uc: null };
    }
    if (activeSelectedUc) {
        return { tab: 'home', uc: activeSelectedUc };
    }
    return { tab: 'home', uc: null };
}

// Show the home tab DOM without modifying history
function _showHomeTab() {
    const navHome = document.getElementById('navHomeBtn');
    const navAdd = document.getElementById('navAddBtn');
    const navNearest = document.getElementById('navNearestBtn');
    if (navHome) navHome.classList.add('active');
    if (navAdd) navAdd.classList.remove('active');
    if (navNearest) navNearest.classList.remove('active');
    document.getElementById('homeTabScreen').classList.remove('hidden');
    document.getElementById('addLocationTabScreen').classList.add('hidden');
}

// Low-level tab switch (no history push)
function _applyTabSwitch(target) {
    const navHome = document.getElementById('navHomeBtn');
    const navAdd = document.getElementById('navAddBtn');
    const navNearest = document.getElementById('navNearestBtn');
    if (navHome) navHome.classList.remove('active');
    if (navAdd) navAdd.classList.remove('active');
    if (navNearest) navNearest.classList.remove('active');

    if (target === 'addLocation') {
        if (navAdd) navAdd.classList.add('active');
        document.getElementById('addLocationTabScreen').classList.remove('hidden');
        document.getElementById('homeTabScreen').classList.add('hidden');
        populateFormUcDropdowns();
    } else {
        if (navHome) navHome.classList.add('active');
        document.getElementById('homeTabScreen').classList.remove('hidden');
        document.getElementById('addLocationTabScreen').classList.add('hidden');
        if (activeSelectedUc) {
            document.getElementById('ucGridSection').classList.add('hidden');
            document.getElementById('pointsListSection').classList.remove('hidden');
        } else {
            document.getElementById('ucGridSection').classList.remove('hidden');
            document.getElementById('pointsListSection').classList.add('hidden');
        }
    }
}

// Tab viewport layout context swapper (public – used by navbar & code)
function switchTab(target) {
    // Push current state for back-button
    if (!isNavigatingBack) {
        _pushNav(_getCurrentNavState());
    }

    if (target === 'home') {
        // Navbar Home always resets to UC grid
        activeSelectedUc = null;
        _showHomeTab();
        document.getElementById('ucGridSection').classList.remove('hidden');
        document.getElementById('pointsListSection').classList.add('hidden');
        document.getElementById('omniSearchInput').value = '';
        document.getElementById('searchStats').classList.add('hidden');
    } else if (target === 'addLocation') {
        _applyTabSwitch('addLocation');
    }
}

// Modal and Text Sharing options controllers
let activeShareReferenceKey = null;

function openShareModal(referenceKey) {
    activeShareReferenceKey = referenceKey;
    
    // Apply current language translations
    document.getElementById('shareModalTitle').innerText = i18n[currentLanguage].shareModalTitle;
    document.getElementById('shareModalDesc').innerText = i18n[currentLanguage].shareModalDesc;
    document.getElementById('shareOptPosterTitle').innerText = i18n[currentLanguage].shareOptPosterTitle;
    document.getElementById('shareOptPosterDesc').innerText = i18n[currentLanguage].shareOptPosterDesc;
    document.getElementById('shareOptTextTitle').innerText = i18n[currentLanguage].shareOptTextTitle;
    document.getElementById('shareOptTextDesc').innerText = i18n[currentLanguage].shareOptTextDesc;

    // Set default share language toggle
    const langRadio = document.querySelector(`input[name="shareLangToggle"][value="${currentLanguage}"]`);
    if (langRadio) {
        langRadio.checked = true;
    }

    const modal = document.getElementById('shareOptionsModal');
    modal.classList.add('active');
}

function closeShareModal() {
    const modal = document.getElementById('shareOptionsModal');
    modal.classList.remove('active');
}

function handleShareOption(option) {
    const checkedRadio = document.querySelector('input[name="shareLangToggle"]:checked');
    const shareLang = checkedRadio ? checkedRadio.value : currentLanguage;
    closeShareModal();
    setTimeout(() => {
        if (option === 'poster') {
            generateAndSharePosterImage('location', activeShareReferenceKey, shareLang);
        } else if (option === 'text') {
            shareTextMessage(activeShareReferenceKey, shareLang);
        }
    }, 300);
}

// Custom Toast Engine notifications rendering controller using style.css classes
function showToast(msg, type = "success") {
    const shelf = document.getElementById('toastNotificationShelf');
    if (!shelf) return;
    
    const block = document.createElement('div');
    block.className = `toast ${type}`;
    
    let svgIcon = '';
    if (type === 'success') {
        svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; flex-shrink: 0;"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'error') {
        svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; flex-shrink: 0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>`;
    } else {
        svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; flex-shrink: 0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }
    
    block.innerHTML = `<span>${svgIcon}</span><span class="flex-1">${msg}</span>`;
    
    shelf.appendChild(block);
    
    setTimeout(() => {
        block.classList.add('dismissing');
        setTimeout(() => block.remove(), 300);
    }, 4000);
}

