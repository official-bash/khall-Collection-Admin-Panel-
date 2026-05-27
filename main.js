// Application Reactive Core State memory storage
let sheetDataset = [];
let uniqueUcsList = [];
let activeSelectedUc = null;
let currentLanguage = localStorage.getItem('khal_app_lang') || 'ur';

// Admin Share Log state – keyed by srNo, value: { ur: bool, en: bool }
let adminShareLog = {};

// ─── Navigation History Stack ──────────────────────────────────────────────
// Each entry: { tab: 'home'|'addLocation', ucName: null|string }
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
    if (navHistoryStack.length > 0) {
        history.pushState({ nav: 'current' }, '', window.location.href);
        const prev = navHistoryStack.pop();
        isNavigatingBack = true;

        if (prev.tab === 'home') {
            if (prev.uc) {
                activeSelectedUc = null;
                _showHomeTab();
                handleUcCardClick(prev.uc);
            } else {
                activeSelectedUc = null;
                _showHomeTab();
                backToUcGrid();
            }
        } else if (prev.tab === 'addLocation') {
            activeSelectedUc = null;
            _applyTabSwitch('addLocation');
        }

        isNavigatingBack = false;
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

    if (isUrdu) {
        document.body.classList.remove('font-sans');
        document.body.classList.add('font-nastaliq');
    } else {
        document.body.classList.remove('font-nastaliq');
        document.body.classList.add('font-sans');
    }

    document.title = i18n[currentLanguage].title;

    document.getElementById('headerTitle').innerText = i18n[currentLanguage].dashboardTitle;
    document.getElementById('headerSub').innerText = i18n[currentLanguage].townName;
    document.getElementById('totalPointsLabel').innerText = i18n[currentLanguage].totalPoints + ": ";
    document.getElementById('spinnerLoadingText').innerText = i18n[currentLanguage].loading;
    document.getElementById('adminBadgeLabel').innerText = i18n[currentLanguage].adminBadge;

    document.getElementById('omniSearchInput').placeholder = i18n[currentLanguage].searchPlaceholder;
    document.getElementById('ucSectionHeading').innerText = i18n[currentLanguage].ucSectionHeader;
    document.getElementById('backToUcsBtn').innerText = i18n[currentLanguage].backToUcs;

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

    document.getElementById('langText').innerText = isUrdu ? 'English' : 'اردو';

    document.getElementById('navHomeLabel').innerText = isUrdu ? 'ہوم' : 'Home';
    document.getElementById('navAddLabel').innerText = isUrdu ? 'لوکیشن' : 'Add Link';
    document.getElementById('navLogLabel').innerText = isUrdu ? 'لاگ' : 'Log';

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
    if (API_URL.includes("YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE") || ADMIN_LOG_API_URL.includes("YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE")) {
        showToast(i18n[currentLanguage].setupIncomplete, "error");
        document.getElementById('appSpinner').innerHTML = `<div class="empty-state" style="color: var(--clr-secondary); font-weight: 800;">${i18n[currentLanguage].configError}</div>`;
        return;
    }

    const url = API_URL + "?action=getData";

    fetch(url, { redirect: 'follow' })
    .then(response => {
        if (!response.ok) throw new Error("HTTP error: " + response.status);
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

        if (payload.status === "success") {
            sheetDataset = payload.data;
            document.getElementById('totalPointsBadge').innerText = sheetDataset.length;
            updateUcList();

            // Also fetch admin share log in parallel
            fetchAdminShareLog().then(() => {
                document.getElementById('appSpinner').classList.add('hidden');
                switchTab('home');
                renderUcCardsGrid(uniqueUcsList);
                populateFormUcDropdowns();
            });
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

// Fetch the admin share log from the AdminShareLog sheet
function fetchAdminShareLog() {
    const url = ADMIN_LOG_API_URL + "?action=getShareLog";
    return fetch(url, { redirect: 'follow' })
        .then(r => r.text())
        .then(text => {
            try {
                const payload = JSON.parse(text);
                if (payload.status === "success" && Array.isArray(payload.data)) {
                    adminShareLog = {};
                    payload.data.forEach(row => {
                        const srNo = row["نمبر شمار (Sr No)"] || row["srNo"] || "";
                        const lang = (row["زبان (Language)"] || row["lang"] || "").trim().toLowerCase();
                        if (srNo) {
                            if (!adminShareLog[srNo]) adminShareLog[srNo] = { ur: false, en: false };
                            if (lang === 'ur') adminShareLog[srNo].ur = true;
                            if (lang === 'en') adminShareLog[srNo].en = true;
                        }
                    });
                }
            } catch (e) {
                console.warn("Could not parse share log:", e);
            }
        })
        .catch(err => {
            console.warn("Could not load share log:", err);
        });
}

// ─── Admin WhatsApp / Location Actions ─────────────────────────────────────
// NOTE: formatPhoneNumberForWhatsApp() is defined in config.js (loaded first)
// It supports Urdu digits, 0092, 03xx, +92, and all Pakistani formats.

// Admin: Request location from responsible person via direct WhatsApp wa.me
function adminRequestLocation(phone, name) {
    const msg = i18n[currentLanguage].adminLocationRequestMsg.replace('{name}', name);
    const cleanPhone = formatPhoneNumberForWhatsApp(phone);
    if (!cleanPhone) {
        showToast("درست موبائل نمبر دستیاب نہیں ہے / Valid phone number not available", "error");
        return;
    }
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, "_blank");
}

// Admin: Open WhatsApp greeting via direct WhatsApp wa.me
function adminOpenWhatsApp(phone, name) {
    const greeting = i18n[currentLanguage].adminWhatsappGreeting.replace('{name}', name);
    const cleanPhone = formatPhoneNumberForWhatsApp(phone);
    if (!cleanPhone) {
        showToast("درست موبائل نمبر دستیاب نہیں ہے / Valid phone number not available", "error");
        return;
    }
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(greeting)}`;
    window.open(whatsappUrl, "_blank");
}

// Log share action to Google Sheets AdminShareLog tab
function logShareToSheet(point, lang, shareType) {
    const srNo    = point["نمبر شمار"] || "";
    const uc      = point["یو سی"] || "";
    const name    = point["پوائنٹ ذمہ دار"] || point["Point responsible"] || "";
    const mobile  = point["موبائل نمبر"] || "";
    const address = point["پوائنٹ کا ایڈریس"] || point["location points"] || "";

    const logUrl = ADMIN_LOG_API_URL
        + "?action=logShare"
        + "&srNo=" + encodeURIComponent(srNo)
        + "&uc=" + encodeURIComponent(uc)
        + "&name=" + encodeURIComponent(name)
        + "&mobile=" + encodeURIComponent(mobile)
        + "&address=" + encodeURIComponent(address)
        + "&lang=" + encodeURIComponent(lang)
        + "&shareType=" + encodeURIComponent(shareType);

    fetch(logUrl, { redirect: 'follow' })
        .then(r => r.text())
        .then(text => {
            try {
                const res = JSON.parse(text);
                if (res.status === "success") {
                    showToast(i18n[currentLanguage].adminShareLogged, "success");
                    // Update local state
                    if (!adminShareLog[srNo]) adminShareLog[srNo] = { ur: false, en: false };
                    if (lang === 'ur') adminShareLog[srNo].ur = true;
                    if (lang === 'en') adminShareLog[srNo].en = true;
                    // Update share button color
                    updateShareButtonColor(srNo);
                } else {
                    showToast(i18n[currentLanguage].adminShareLogError, "error");
                }
            } catch (e) {
                console.warn("Log parse error:", e);
            }
        })
        .catch(err => {
            console.warn("Log request failed:", err);
            showToast(i18n[currentLanguage].adminShareLogError, "error");
        });
}

// Update the color of the share button for a given srNo
function updateShareButtonColor(srNo) {
    const btn = document.querySelector(`.btn-share[data-sr-no="${srNo}"]`);
    if (!btn) return;
    const logEntry = adminShareLog[String(srNo)];
    if (logEntry && (logEntry.ur || logEntry.en)) {
        btn.classList.remove('not-sent');
        btn.classList.add('sent');
        // Both languages sent
        if (logEntry.ur && logEntry.en) {
            btn.classList.add('fully-sent');
        }
    }
}

// ─── Show Share Log Stats ────────────────────────────────────────────────────

function showShareLogStats() {
    _pushNav(_getCurrentNavState());

    const navHome = document.getElementById('navHomeBtn');
    const navAdd  = document.getElementById('navAddBtn');
    const navLog  = document.getElementById('navLogBtn');
    if (navHome) navHome.classList.remove('active');
    if (navAdd)  navAdd.classList.remove('active');
    if (navLog)  navLog.classList.add('active');

    const totalShared = Object.keys(adminShareLog).length;
    const urShared    = Object.values(adminShareLog).filter(v => v.ur).length;
    const enShared    = Object.values(adminShareLog).filter(v => v.en).length;
    const bothShared  = Object.values(adminShareLog).filter(v => v.ur && v.en).length;
    const totalPoints = sheetDataset.length;

    showToast(
        `شیئر لاگ: کل ${totalPoints} میں سے ${totalShared} پوائنٹس شیئر ہو چکے ہیں (اردو: ${urShared} | EN: ${enShared} | دونوں: ${bothShared})`,
        "info"
    );

    // Switch to home so user still sees the cards
    _showHomeTab();
    document.getElementById('ucGridSection').classList.remove('hidden');
    document.getElementById('pointsListSection').classList.add('hidden');
    if (navHome) navHome.classList.add('active');
    if (navLog)  navLog.classList.remove('active');
}

// ─── UC List & Rendering ────────────────────────────────────────────────────

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

function renderUcCardsGrid(ucs) {
    const gridContainer = document.getElementById('ucCardGrid');
    gridContainer.innerHTML = '';
    updateUcList();

    uniqueUcsList.forEach((ucName, index) => {
        const hubsCount = sheetDataset.filter(row => {
            const rowUc = currentLanguage === 'ur'
                ? (row["یو سی"] || "")
                : (row["uc"] || row["یو سی"] || "");
            return rowUc.trim() === ucName.trim();
        }).length;

        // Count shared points in this UC
        const sharedCount = sheetDataset.filter(row => {
            const rowUc = currentLanguage === 'ur'
                ? (row["یو سی"] || "")
                : (row["uc"] || row["یو سی"] || "");
            const srNo = String(row["نمبر شمار"]);
            return rowUc.trim() === ucName.trim() && adminShareLog[srNo] && (adminShareLog[srNo].ur || adminShareLog[srNo].en);
        }).length;

        const cardNode = document.createElement('div');
        const staggerClass = index < 12 ? ` stagger-${(index % 12) + 1}` : '';
        cardNode.className = `uc-card${staggerClass}`;
        cardNode.onclick = () => handleUcCardClick(ucName);

        const progressPct = hubsCount > 0 ? Math.round((sharedCount / hubsCount) * 100) : 0;
        const progressColor = progressPct === 100 ? '#22c55e' : progressPct > 0 ? '#f59e0b' : '#e11d48';

        cardNode.innerHTML = `
            <div class="uc-card-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px;">
                    <path d="M3 21h18M9 21V9a3 3 0 0 1 6 0v12M4 21V12a2 2 0 0 1 2-2h3M20 21V12a2 2 0 0 0-2-2h-3"/>
                </svg>
            </div>
            <h3 class="uc-card-title">${ucName}</h3>
            <span class="uc-card-badge">${hubsCount} ${i18n[currentLanguage].pointsCount}</span>
            <div class="uc-share-progress" style="margin-top: 6px; font-size: 11px; color: ${progressColor}; font-weight: 700;">
                📤 ${sharedCount}/${hubsCount} شیئر
            </div>
        `;
        gridContainer.appendChild(cardNode);
    });
    document.getElementById('ucGridSection').classList.remove('hidden');
}

function handleUcCardClick(ucName) {
    _pushNav({ tab: 'home', uc: null });
    activeSelectedUc = ucName;
    document.getElementById('ucGridSection').classList.add('hidden');

    const filteredPoints = sheetDataset.filter(row => {
        const rowUc = currentLanguage === 'ur'
            ? (row["یو سی"] || "")
            : (row["uc"] || row["یو سی"] || "");
        return rowUc.trim() === ucName.trim();
    });
    document.getElementById('pointsSectionHeader').innerText = `${i18n[currentLanguage].pointsListHeader}: ${ucName}`;
    renderPointsListMarkup(filteredPoints);
}

function backToUcGrid() {
    document.getElementById('pointsListSection').classList.add('hidden');
    document.getElementById('ucGridSection').classList.remove('hidden');
    document.getElementById('omniSearchInput').value = '';
    document.getElementById('searchStats').classList.add('hidden');
    activeSelectedUc = null;

    const navHome = document.getElementById('navHomeBtn');
    const navLog  = document.getElementById('navLogBtn');
    if (navHome) navHome.classList.add('active');
    if (navLog)  navLog.classList.remove('active');
}

// Parse coordinates out of standard Google Maps URLs
function parseCoordsFromUrl(url) {
    if (!url) return null;

    let match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

    match = url.match(/[?&](q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) return { lat: parseFloat(match[2]), lng: parseFloat(match[3]) };

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

// Render detailed point card list
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
        const cleanPhone = formatPhoneNumberForWhatsApp(point["موبائل نمبر"]);
        const srNo = point["نمبر شمار"];

        const ucName = currentLanguage === 'ur'
            ? (point["یو سی"] || "")
            : (point["uc"] || point["یو سی"] || "");

        const pointName = currentLanguage === 'ur'
            ? (point["پوائنٹ کا نام"] || point["Point Name"] || `پوائنٹ #${srNo}`)
            : (point["Point Name"] || point["پوائنٹ کا نام"] || `Point #${srNo}`);

        const responsiblePerson = currentLanguage === 'ur'
            ? (point["پوائنٹ ذمہ دار"] || "")
            : (point["Point responsible"] || point["پوائنٹ ذمہ دار"] || "");

        const address = currentLanguage === 'ur'
            ? (point["پوائنٹ کا ایڈریس"] || point["location points"] || '')
            : (point["location points"] || point["پوائنٹ کا ایڈریس"] || '');

        let distanceBadgeMarkup = '';
        if (showDistance && point.distance !== undefined && point.distance !== Infinity) {
            const isClosest = index === 0;
            const distanceClass = isClosest ? 'badge-distance closest' : 'badge-distance normal';
            const badgeText = isClosest ? `${i18n[currentLanguage].closestBadge} | ` : '';
            let distanceStr = point.distance < 1
                ? `${Math.round(point.distance * 1000)} ${i18n[currentLanguage].meters}`
                : `${point.distance.toFixed(1)} ${i18n[currentLanguage].kilometers}`;
            distanceBadgeMarkup = `<span class="${distanceClass}">📍 ${badgeText} ${distanceStr} ${i18n[currentLanguage].away}</span>`;
        }

        const pointCard = document.createElement('div');
        const staggerClass = index < 12 ? ` stagger-${(index % 12) + 1}` : '';
        pointCard.className = `point-card${staggerClass}`;

        // ── MAP BUTTON ──────────────────────────────────────────────────────
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
            // ADMIN: No map link → request location via Web Share API
            const safePhone  = cleanPhone.replace(/'/g, "\\'");
            const safeName   = responsiblePerson.replace(/'/g, "\\'");
            mapBtnMarkup = `
                <button onclick="adminRequestLocation('${safePhone}', '${safeName}')" class="btn btn-add-map btn-flex">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    ${i18n[currentLanguage].addMapBtn}
                </button>`;
        }

        // ── WHATSAPP BUTTON ─────────────────────────────────────────────────
        // ADMIN: Use Web Share API with Urdu greeting
        const safePhoneWA = cleanPhone.replace(/'/g, "\\'");
        const safeNameWA  = responsiblePerson.replace(/'/g, "\\'");
        const whatsappBtnMarkup = `
            <button onclick="adminOpenWhatsApp('${safePhoneWA}', '${safeNameWA}')" class="btn btn-whatsapp btn-flex">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.458L0 24zm6.59-3.559c1.674.993 3.336 1.488 5.275 1.489 5.626 0 10.201-4.577 10.204-10.203.002-2.723-1.054-5.283-2.977-7.207C17.228 2.597 14.673 1.54 11.95 1.539 6.323 1.539 1.75 6.117 1.748 11.743c-.001 1.99.52 3.84 1.514 5.461l-.993 3.627 3.778-.99z"/>
                </svg>
                ${i18n[currentLanguage].whatsappBtn}
            </button>`;

        // ── SHARE BUTTON ─────────────────────────────────────────────────────
        const logEntry = adminShareLog[String(srNo)];
        const isSentUR = logEntry && logEntry.ur;
        const isSentEN = logEntry && logEntry.en;
        const isSentAny = isSentUR || isSentEN;
        const isSentBoth = isSentUR && isSentEN;
        let shareBtnClass = `btn btn-share${isSentAny ? ' sent' : ' not-sent'}${isSentBoth ? ' fully-sent' : ''}`;
        let shareLabel = i18n[currentLanguage].shareBtn;
        if (isSentBoth) shareLabel = '✓ ' + shareLabel;
        else if (isSentAny) shareLabel = '◑ ' + shareLabel;

        const shareBtnMarkup = `
            <button onclick="openShareModal('${srNo}')" class="${shareBtnClass}" data-sr-no="${srNo}" title="${i18n[currentLanguage].shareBtn}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v16"/>
                </svg>
                <span>${shareLabel}</span>
            </button>`;

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
                ${whatsappBtnMarkup}
                ${shareBtnMarkup}
            </div>
        `;
        listContainer.appendChild(pointCard);
    });

    document.getElementById('pointsListSection').classList.remove('hidden');
}

// Global Omni Database Search
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
        const addressUrdu   = (row["پوائنٹ کا ایڈریس"] || "").toLowerCase();
        const addressEnglish = (row["location points"] || "").toLowerCase();
        const zimadarName   = (row["پوائنٹ ذمہ دار"] || "").toLowerCase();
        const zimadarNameEn = (row["Point responsible"] || "").toLowerCase();
        const ucCell        = (row["یو سی"] || "").toLowerCase();
        const ucCellEn      = (row["uc"] || "").toLowerCase();

        return addressUrdu.includes(query) ||
               addressEnglish.includes(query) ||
               zimadarName.includes(query) ||
               zimadarNameEn.includes(query) ||
               ucCell.includes(query) ||
               ucCellEn.includes(query);
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

// Contextual shortcut to Add Location form
function triggerDirectAddLocationLink(ucName, srNo) {
    _pushNav(_getCurrentNavState());
    _applyTabSwitch('addLocation');
    document.getElementById('formUcSelect').value = ucName;
    populateFormSerialNumbers();
    document.getElementById('formSrNoSelect').value = srNo;
    showToast(i18n[currentLanguage].toastAutoSelected, "info");
}

// Dynamic select dropdown option populate
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

function populateFormSerialNumbers() {
    const selectedUc = document.getElementById('formUcSelect').value;
    const srDropdown = document.getElementById('formSrNoSelect');
    srDropdown.innerHTML = `<option value="">${i18n[currentLanguage].selectPointDefault}</option>`;
    if (!selectedUc) return;

    const missingMapPoints = sheetDataset.filter(row => {
        const rowUc = currentLanguage === 'ur'
            ? (row["یو سی"] || "")
            : (row["uc"] || row["یو سی"] || "");
        const isMatch  = rowUc.trim() === selectedUc.trim();
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

function submitLocationUpdate() {
    const uc        = document.getElementById('formUcSelect').value;
    const srNo      = document.getElementById('formSrNoSelect').value;
    const userInput = document.getElementById('formMapUrlInput').value.trim();
    const password  = document.getElementById('formPasswordInput').value.trim();

    if (!uc || !srNo || !userInput || !password) {
        showToast(i18n[currentLanguage].toastAllFields, "error");
        return;
    }

    const targetPoint = sheetDataset.find(row => String(row["نمبر شمار"]) === String(srNo));
    if (!targetPoint) {
        showToast("پوائنٹ نہیں ملا / Point not found", "error");
        return;
    }

    const canonicalUc = targetPoint["یو سی"] || uc;
    const isRawCoords = /^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(userInput);
    const isUrl       = userInput.startsWith("http://") || userInput.startsWith("https://");

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
        if (parsed) cordinatesParam = `${parsed.lat},${parsed.lng}`;
    }

    document.getElementById('appSpinner').classList.remove('hidden');
    document.getElementById('addLocationTabScreen').classList.add('opacity-40', 'pointer-events-none');

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
        try { response = JSON.parse(text); } catch (e) { throw new Error("Unexpected server response."); }
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

function _pushNav(state) {
    if (isNavigatingBack) return;
    navHistoryStack.push(state);
    if (navHistoryStack.length > 30) navHistoryStack.shift();
}

function _getCurrentNavState() {
    const addLocScreen = document.getElementById('addLocationTabScreen');
    if (!addLocScreen.classList.contains('hidden')) return { tab: 'addLocation', uc: null };
    if (activeSelectedUc) return { tab: 'home', uc: activeSelectedUc };
    return { tab: 'home', uc: null };
}

function _showHomeTab() {
    const navHome = document.getElementById('navHomeBtn');
    const navAdd  = document.getElementById('navAddBtn');
    const navLog  = document.getElementById('navLogBtn');
    if (navHome) navHome.classList.add('active');
    if (navAdd)  navAdd.classList.remove('active');
    if (navLog)  navLog.classList.remove('active');
    document.getElementById('homeTabScreen').classList.remove('hidden');
    document.getElementById('addLocationTabScreen').classList.add('hidden');
}

function _applyTabSwitch(target) {
    const navHome = document.getElementById('navHomeBtn');
    const navAdd  = document.getElementById('navAddBtn');
    const navLog  = document.getElementById('navLogBtn');
    if (navHome) navHome.classList.remove('active');
    if (navAdd)  navAdd.classList.remove('active');
    if (navLog)  navLog.classList.remove('active');

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

function switchTab(target) {
    if (!isNavigatingBack) _pushNav(_getCurrentNavState());

    if (target === 'home') {
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

// ─── Share Modal ────────────────────────────────────────────────────────────

let activeShareReferenceKey = null;

function openShareModal(referenceKey) {
    activeShareReferenceKey = referenceKey;

    document.getElementById('shareModalTitle').innerText = i18n[currentLanguage].shareModalTitle;
    document.getElementById('shareModalDesc').innerText = i18n[currentLanguage].shareModalDesc;
    document.getElementById('shareOptPosterTitle').innerText = i18n[currentLanguage].shareOptPosterTitle;
    document.getElementById('shareOptPosterDesc').innerText = i18n[currentLanguage].shareOptPosterDesc;
    document.getElementById('shareOptTextTitle').innerText = i18n[currentLanguage].shareOptTextTitle;
    document.getElementById('shareOptTextDesc').innerText = i18n[currentLanguage].shareOptTextDesc;

    // Set default share language toggle
    const langRadio = document.querySelector(`input[name="shareLangToggle"][value="${currentLanguage}"]`);
    if (langRadio) langRadio.checked = true;

    // Color language pills based on share history
    const logEntry = adminShareLog[String(referenceKey)];
    const urLabel = document.querySelector('label[for="shareLangUr"]');
    const enLabel = document.querySelector('label[for="shareLangEn"]');
    if (urLabel) {
        urLabel.classList.toggle('lang-pill-sent', !!(logEntry && logEntry.ur));
        urLabel.classList.toggle('lang-pill-not-sent', !(logEntry && logEntry.ur));
    }
    if (enLabel) {
        enLabel.classList.toggle('lang-pill-sent', !!(logEntry && logEntry.en));
        enLabel.classList.toggle('lang-pill-not-sent', !(logEntry && logEntry.en));
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

    if (option === 'poster') {
        // ── Open a blank trusted window SYNCHRONOUSLY here (inside the click handler)
        // ── so mobile browsers (iOS Safari, Chrome) do NOT block the popup.
        // ── We then pass this window reference to generateAndSharePosterImage which
        // ── updates its URL once the async canvas rendering completes.
        const waWindow = window.open('', '_blank');
        closeShareModal();
        generateAndSharePosterImage('location', activeShareReferenceKey, shareLang, waWindow);
    } else if (option === 'text') {
        // ── Text sharing is instant (no async), close modal and fire immediately.
        closeShareModal();
        shareTextMessage(activeShareReferenceKey, shareLang);
    }
}

// ─── Toast Engine ────────────────────────────────────────────────────────────

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
